import styles from './styles.module.css'
import { Head } from "#components/Head"
import type { RouteMeta } from "#router"
import { useEffect, useRef } from "react"

export const meta: RouteMeta = {
	title: 'Deterministic Plinko',
	image: './screen.png',
	tags: ['game', 'physics', 'simulation']
}

/**
 * a plinko game without any randomness / chance / variability,
 * so that the outcome is known before the ball is dropped.
 * 
 * We color the ball before dropping it based on where we
 * know it will land.
 */
export default function DeterministicPlinkoPage() {
	const ref = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = ref.current
		if (!canvas) return
		const ctx = canvas.getContext("2d")
		if (!ctx) return

		canvas.width = window.innerWidth * devicePixelRatio
		canvas.height = window.innerHeight * devicePixelRatio

		return start(ctx)
	}, [])

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<canvas ref={ref}>
				Your browser does not support the HTML5 canvas tag.
			</canvas>
		</div>
	)
}

type Ball = {
	color: string,
	startTime: number,
	positions: number[]
}

function start(ctx: CanvasRenderingContext2D) {
	const width = ctx.canvas.width / devicePixelRatio
	const height = ctx.canvas.height / devicePixelRatio

	const OBSTACLE_RADIUS = 8
	const OBSTACLE_SPACING = { x: 70, y: 70 }
	const BALL_RADIUS = 16

	const STATIC_TIMESTEP = 1 / 60

	const balls: Ball[] = []

	const obstacles = Array.from({
		*[Symbol.iterator]() {
			for (let y = OBSTACLE_SPACING.y; y < height; y += OBSTACLE_SPACING.y) {
				const offset_x = OBSTACLE_RADIUS + ((y / OBSTACLE_SPACING.y) % 2 === 0 ? 0 : OBSTACLE_SPACING.x / 2)
				for (let x = offset_x; x < width; x += OBSTACLE_SPACING.x) {
					// avoid situations where the ball can get stuck between an obstacle and the wall
					if (x > BALL_RADIUS * 2 && x < BALL_RADIUS * 2 + OBSTACLE_RADIUS) continue
					if (x < width - BALL_RADIUS * 2 && x > width - (BALL_RADIUS * 2 + OBSTACLE_RADIUS)) continue
					// valid obstacle
					yield { x, y }
				}
			}
		}
	})

	const last_y = obstacles.at(-1)!.y
	const buckets = Array.from({
		*[Symbol.iterator]() {
			yield 0
			const first_of_last_row = obstacles.findIndex(o => o.y === last_y)
			let start = obstacles[first_of_last_row + 1]!.x
			if (start < OBSTACLE_SPACING.x + BALL_RADIUS) start = obstacles[first_of_last_row + 2]!.x
			for (let x = start; x <= width - OBSTACLE_RADIUS * 2; x += OBSTACLE_SPACING.x * 2) {
				yield x
			}
		}
	}).map((x, i, { length }) => {
		const hue = Math.round((i / length) * 360)
		return { x, hue }
	})

	for (const bucket of buckets) {
		if (bucket.x < OBSTACLE_RADIUS * 2 || bucket.x > width - OBSTACLE_RADIUS * 2) continue // avoid miniature buckets at edges
		obstacles.push({ x: bucket.x, y: height - (height - last_y) / 2 })
		obstacles.push({ x: bucket.x, y: height })
	}

	const START_Y = OBSTACLE_SPACING.y / 2
	const mouse = {
		x: 0,
		y: 0,
		hue: 0,
	}

	let lastTime = 0

	let rafId = requestAnimationFrame(function loop(time) {
		rafId = requestAnimationFrame(loop)

		lastTime = time

		ctx.clearRect(0, 0, width, height)

		// draw buckets
		for (let i = 0; i < buckets.length; i++) {
			const bucket = buckets[i]!
			const nextBucket = buckets[i + 1]
			const w = nextBucket ? nextBucket.x - bucket.x : width - bucket.x
			ctx.fillStyle = `hsl(${bucket.hue}, 100%, 20%)`
			ctx.fillRect(bucket.x, last_y, w, height - last_y)
		}

		// draw obstacles
		ctx.fillStyle = '#222222'
		for (const obstacle of obstacles) {
			ctx.beginPath()
			ctx.arc(obstacle.x, obstacle.y, OBSTACLE_RADIUS, 0, Math.PI * 2)
			ctx.fill()
		}

		// draw balls
		for (let i = balls.length - 1; i >= 0; i--) {
			const ball = balls[i]!
			const timeSinceStart = (lastTime - ball.startTime) / 1000
			const index = Math.floor(timeSinceStart / STATIC_TIMESTEP) * 2
			if (index >= ball.positions.length) {
				balls.splice(i, 1)
				continue
			}
			const x = ball.positions[index]!
			const y = ball.positions[index + 1]!
			ctx.fillStyle = ball.color
			ctx.beginPath()
			ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2)
			ctx.fill()
		}

		// draw mouse
		ctx.fillStyle = `hsl(${mouse.hue}, 100%, 30%)`
		ctx.beginPath()
		ctx.arc(mouse.x, mouse.y, BALL_RADIUS, 0, Math.PI * 2)
		ctx.fill()
	})

	const controller = new AbortController()
	window.addEventListener('pointermove', (e) => {
		const rect = ctx.canvas.getBoundingClientRect()
		mouse.x = (e.clientX - rect.left) * (ctx.canvas.width / rect.width)
		mouse.y = (e.clientY - rect.top) * (ctx.canvas.height / rect.height)
		const positions = simulateBall(mouse.x, mouse.y, BALL_RADIUS, obstacles, OBSTACLE_RADIUS, height, width, STATIC_TIMESTEP)
		const last_x = positions.at(-2)!
		const hue = xToBucket(last_x, buckets).hue
		mouse.hue = hue
		if (e.buttons === 1) {
			balls.push({
				color: `hsl(${hue}, 100%, 30%)`,
				startTime: lastTime,
				positions,
			})
		}
	}, { signal: controller.signal })

	window.addEventListener('pointerdown', (e) => {
		const positions = simulateBall(mouse.x, mouse.y, BALL_RADIUS, obstacles, OBSTACLE_RADIUS, height, width, STATIC_TIMESTEP)
		const last_x = positions.at(-2)!
		const hue = xToBucket(last_x, buckets).hue
		balls.push({
			color: `hsl(${hue}, 100%, 30%)`,
			startTime: lastTime,
			positions,
		})
	}, { signal: controller.signal })

	return () => {
		cancelAnimationFrame(rafId)
		controller.abort()
	}
}

function xToBucket<Bucket extends { x: number }>(x: number, buckets: Bucket[]): Bucket {
	if (x < buckets[0]!.x) {
		return buckets[0]!
	}
	for (let i = 0; i < buckets.length - 1; i++) {
		if (buckets[i]!.x <= x && x < buckets[i + 1]!.x) {
			return buckets[i]!
		}
	}
	return buckets[buckets.length - 1]!
}

function simulateBall(x: number, y: number, r: number, obstacles: { x: number; y: number }[], obstacleRadius: number, height: number, width: number, dt: number) {
	const positions: number[] = []
	positions.push(x, y)

	const gravity = 9.81 * 100 // pixels per second squared
	const damping = 0.98 // air resistance factor
	let vx = 0
	let vy = 0

	while (y - r < height) {
		vy += gravity * dt

		x += vx * dt
		y += vy * dt

		// apply damping
		vx *= damping
		vy *= damping

		// check for wall collisions
		if (x - r < 0) {
			x = r
			vx = -vx
		} else if (x + r > width) {
			x = width - r
			vx = -vx
		}

		// check for collisions with obstacles
		const minDistance = obstacleRadius + r
		for (const obstacle of obstacles) {
			const dx = obstacle.x - x
			const dy = obstacle.y - y
			const distance = Math.sqrt(dx * dx + dy * dy)
			if (distance >= minDistance) continue

			// resolve collision
			const overlap = minDistance - distance
			const angle = Math.atan2(dy, dx)
			vx -= Math.cos(angle) * overlap / dt
			vy -= Math.sin(angle) * overlap / dt
		}

		positions.push(x, y)

		if (positions.length > 8000) break // safety break to avoid infinite loops
	}

	return positions
}
