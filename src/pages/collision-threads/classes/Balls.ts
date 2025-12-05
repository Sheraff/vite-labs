import { COUNT, GRAVITY, DELAY_BETWEEN_BALLS, MAX_BALL_RADIUS, MIN_BALL_RADIUS, COLORS } from "../utils/constants"
import * as FloatAtomics from "../utils/FloatAtomics"
import { randomFloat, randomInt } from "../utils/random"
import { makeSharedStruct } from "./sharedStruct"

export type Balls = ReturnType<typeof makeBalls>
export type SerializedBalls = ReturnType<Balls["serialize"]>
export function makeBalls(side: number) {
	const base = makeSharedStruct({
		counters: [Uint16Array, 2],
		x: [Uint32Array, COUNT],
		prevX: [Uint32Array, COUNT],
		accelerationX: [Int32Array, COUNT],
		y: [Uint32Array, COUNT],
		prevY: [Uint32Array, COUNT],
		accelerationY: [Int32Array, COUNT],
		r: [Uint8Array, COUNT],
		alive: [Uint8Array, COUNT],
		color: [Uint8Array, COUNT],
	})

	const container = {
		x: side / 2,
		y: side / 2,
		r: side / 2 - 100,
	}

	const internal = {
		get count() {
			return base.counters[0]
		},
		set count(number) {
			base.counters[0] = number
		},
		get lastBall() {
			return base.counters[1]
		},
		set lastBall(index) {
			base.counters[1] = index
		},
	}

	function initValues() {
		internal.count = COUNT
		internal.lastBall = 0
		base.x.fill(0)
		base.prevX.fill(0)
		base.accelerationX.fill(0)
		base.y.fill(0)
		base.prevY.fill(0)
		base.accelerationY.fill(0)
		base.r.fill(0)
		base.alive.fill(0)
	}

	let drawUi = true
	function draw(
		{
			main,
			ui,
		}: {
			main: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
			ui: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
		},
		dt: number,
	) {
		if (drawUi) {
			ui.fillStyle = "gray"
			ui.beginPath()
			ui.arc(container.x, container.y, container.r, 0, 2 * Math.PI)
			ui.fill()

			ui.fillStyle = "black"
			const max = (side / 1000) * MAX_BALL_RADIUS
			const x = container.x
			const y = container.y - container.r + 2 * max
			ui.beginPath()
			ui.arc(x, y, max, 0, 2 * Math.PI)
			ui.fill()

			drawUi = false
		}
		for (let i = 0; i < internal.count; i++) {
			if (Atomics.load(base.alive, i) === 0) {
				continue
			}
			const x = FloatAtomics.load(base.x, i)
			const y = FloatAtomics.load(base.y, i)
			const r = Atomics.load(base.r, i)
			const color = COLORS[Atomics.load(base.color, i)]
			main.fillStyle = color
			main.beginPath()
			main.arc(x, y, r, 0, Math.PI * 2)
			main.fill()
		}
	}

	function step(dt: number, entities: any) {
		addBall(dt)
		applyGravity()
		applyConstraints()
		solveCollisions()
		updatePosition(dt)
	}

	let lastBallDelay = 0
	function addBall(dt: number) {
		lastBallDelay -= dt
		if (lastBallDelay > 0 || internal.lastBall >= internal.count) {
			return
		}
		const i = internal.lastBall
		internal.lastBall += 1
		lastBallDelay = DELAY_BETWEEN_BALLS / 1000
		const min = (side / 1000) * MIN_BALL_RADIUS
		const max = (side / 1000) * MAX_BALL_RADIUS
		const x = side / 2
		const y = container.y - container.r + 2 * max
		const prevDx = randomInt(0, 1) ? -Math.round(side / 3) : Math.round(side / 3)
		const prevDy = randomInt(0, 1) ? -Math.round(side / 20) : Math.round(side / 5)
		FloatAtomics.store(base.x, i, x)
		FloatAtomics.store(base.prevX, i, x - dt * prevDx)
		FloatAtomics.store(base.y, i, y)
		FloatAtomics.store(base.prevY, i, y + dt * prevDy)
		Atomics.store(base.r, i, randomInt(min, max))
		Atomics.store(base.alive, i, 1)
		Atomics.store(base.color, i, randomInt(0, COLORS.length - 1))
	}

	const relativeGravity = [(GRAVITY[0] * side) / 1000, (GRAVITY[1] * side) / 1000]
	function applyGravity() {
		accelerate(relativeGravity[0], relativeGravity[1])
	}

	function solveCollisions() {
		for (let i = 0; i < internal.lastBall - 1; i++) {
			const x1 = FloatAtomics.load(base.x, i)
			const y1 = FloatAtomics.load(base.y, i)
			const r1 = Atomics.load(base.r, i)
			for (let j = i + 1; j < internal.lastBall; j++) {
				const r2 = Atomics.load(base.r, j)
				const minDistance = r1 + r2
				const x2 = FloatAtomics.load(base.x, j)
				const dx = x1 - x2
				if (dx > minDistance || dx < -minDistance) {
					continue
				}
				const y2 = FloatAtomics.load(base.y, j)
				const dy = y1 - y2
				if (dy > minDistance || dy < -minDistance) {
					continue
				}
				const distance = Math.hypot(dx, dy)
				if (distance < minDistance) {
					const xRatio = dx / distance
					const yRatio = dy / distance
					const delta = minDistance - distance
					const mass = r1 + r2
					const r1Ratio = r2 / mass
					const r2Ratio = r1 / mass
					FloatAtomics.add(base.x, i, xRatio * 0.5 * delta * r1Ratio)
					FloatAtomics.add(base.y, i, yRatio * 0.5 * delta * r1Ratio)
					FloatAtomics.sub(base.x, j, xRatio * 0.5 * delta * r2Ratio)
					FloatAtomics.sub(base.y, j, yRatio * 0.5 * delta * r2Ratio)
				}
			}
		}
	}

	function applyConstraints() {
		for (let i = 0; i < internal.lastBall; i++) {
			const x = FloatAtomics.load(base.x, i)
			const y = FloatAtomics.load(base.y, i)
			const r = Atomics.load(base.r, i)
			const xToContainer = x - container.x
			const yToContainer = y - container.y
			const distanceToContainer = Math.hypot(xToContainer, yToContainer)
			const minDistance = container.r - r
			if (distanceToContainer > minDistance) {
				const xRatio = xToContainer / distanceToContainer
				const yRatio = yToContainer / distanceToContainer
				FloatAtomics.store(base.x, i, container.x + xRatio * minDistance)
				FloatAtomics.store(base.y, i, container.y + yRatio * minDistance)
			}
		}
	}

	function updatePosition(dt: number) {
		for (let i = 0; i < internal.lastBall; i++) {
			const x = FloatAtomics.load(base.x, i)
			const prevX = FloatAtomics.exchange(base.prevX, i, x)
			const accelerationX = FloatAtomics.exchange(base.accelerationX, i, 0)
			const velocityX = x - prevX
			FloatAtomics.add(base.x, i, velocityX + accelerationX * dt ** 2)

			const y = FloatAtomics.load(base.y, i)
			const prevY = FloatAtomics.exchange(base.prevY, i, y)
			const accelerationY = FloatAtomics.exchange(base.accelerationY, i, 0)
			const velocityY = y - prevY
			FloatAtomics.add(base.y, i, velocityY + accelerationY * dt ** 2)
		}
	}

	function accelerate(x: number, y: number) {
		for (let i = 0; i < internal.count; i++) {
			FloatAtomics.add(base.accelerationX, i, x)
			FloatAtomics.add(base.accelerationY, i, y)
		}
	}

	const balls = Object.assign(base, {
		side,
		container,
		initValues,
		draw,
		step,
		getLastBall: () => internal.lastBall,
	})
	return balls
}
