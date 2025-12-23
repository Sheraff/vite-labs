import type { RouteMeta } from "#router"

import { Head } from "#components/Head"
import { useEffect, useRef } from "react"

import styles from "./styles.module.css"

export const meta: RouteMeta = {
	title: "Imperative Geometry",
	tags: ["canvas"],
	image: './screen.png'
}

export default function ImperativeGeometryPage() {
	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<div className={styles.content}>
				<Two />
				<Three />
				<Four />
			</div>
		</div>
	)
}

function Two() {
	const canvas = useRef<HTMLCanvasElement | null>(null)
	useEffect(
		() =>
			new Drawing(canvas.current!)
				.moveTo(0, 0)
				.lineTo(0, 450)
				.moveTo(-20, 30)
				.lineTo(0, 0)
				.lineTo(20, 30)
				.moveTo(-20, 420)
				.lineTo(0, 450)
				.lineTo(20, 420)
				.moveTo(-20, 60)
				.lineTo(20, 60)
				.moveTo(-20, 70)
				.lineTo(20, 70)
				.moveTo(0, 90)
				.arc(20, -Math.PI / 2, (3 * Math.PI) / 2)
				.moveTo(-30, 170)
				.equilateral(60)
				.moveTo(0, 147)
				.arc(40, -Math.PI / 2, (3 * Math.PI) / 2)
				.moveTo(0, 240)
				.arc(20, -Math.PI / 2, (3 * Math.PI) / 2)
				.moveTo(-40, 310)
				.arc(80, (-2 * Math.PI) / 3, -Math.PI / 3)
				.moveTo(-40, 330)
				.arc(80, (-2 * Math.PI) / 3, -Math.PI / 3)
				.moveTo(-30, 350)
				.lineTo(30, 380)
				.moveTo(-30, 380)
				.lineTo(30, 350)
				.play(),
		[],
	)
	return <canvas ref={canvas} />
}

function Three() {
	const canvas = useRef<HTMLCanvasElement | null>(null)
	useEffect(
		() =>
			new Drawing(canvas.current!)
				// big triangle
				.moveTo(0, 0)
				.equilateral(200)
				// small triangle
				.moveTo(40, -20)
				.equilateral(120)
				// big diamond
				.moveTo(100, -20)
				.lineTo(130, 0)
				.lineTo(100, 53)
				.lineTo(70, 0)
				.lineTo(100, -20)
				// small diamond
				.lineTo(115, 0)
				.lineTo(100, 53)
				.lineTo(85, 0)
				.lineTo(100, -20)
				// bottom triangle
				.moveTo(85, 120)
				.equilateral(30)
				.moveTo(100, 120)
				.lineTo(100, 400)
				.moveTo(85, 180)
				.lineTo(115, 180)
				.moveTo(85, 190)
				.lineTo(115, 190)
				// dashed circle
				.moveTo(100, 230)
				.arc(20, -Math.PI / 2, (3 * Math.PI) / 2)
				.moveTo(100, 210)
				.arc(40, -Math.PI / 2 + (Math.PI / 8) * 0, -Math.PI / 2 + (Math.PI / 8) * 1)
				.arcMoveTo(40, -Math.PI / 2 + (Math.PI / 8) * 1, -Math.PI / 2 + (Math.PI / 8) * 2)
				.arc(40, -Math.PI / 2 + (Math.PI / 8) * 2, -Math.PI / 2 + (Math.PI / 8) * 3)
				.arcMoveTo(40, -Math.PI / 2 + (Math.PI / 8) * 3, -Math.PI / 2 + (Math.PI / 8) * 4)
				.arc(40, -Math.PI / 2 + (Math.PI / 8) * 4, -Math.PI / 2 + (Math.PI / 8) * 5)
				.arcMoveTo(40, -Math.PI / 2 + (Math.PI / 8) * 5, -Math.PI / 2 + (Math.PI / 8) * 6)
				.arc(40, -Math.PI / 2 + (Math.PI / 8) * 6, -Math.PI / 2 + (Math.PI / 8) * 7)
				.arcMoveTo(40, -Math.PI / 2 + (Math.PI / 8) * 7, -Math.PI / 2 + (Math.PI / 8) * 8)
				.arc(40, -Math.PI / 2 + (Math.PI / 8) * 8, -Math.PI / 2 + (Math.PI / 8) * 9)
				.arcMoveTo(40, -Math.PI / 2 + (Math.PI / 8) * 9, -Math.PI / 2 + (Math.PI / 8) * 10)
				.arc(40, -Math.PI / 2 + (Math.PI / 8) * 10, -Math.PI / 2 + (Math.PI / 8) * 11)
				.arcMoveTo(40, -Math.PI / 2 + (Math.PI / 8) * 11, -Math.PI / 2 + (Math.PI / 8) * 12)
				.arc(40, -Math.PI / 2 + (Math.PI / 8) * 12, -Math.PI / 2 + (Math.PI / 8) * 13)
				.arcMoveTo(40, -Math.PI / 2 + (Math.PI / 8) * 13, -Math.PI / 2 + (Math.PI / 8) * 14)
				.arc(40, -Math.PI / 2 + (Math.PI / 8) * 14, -Math.PI / 2 + (Math.PI / 8) * 15)
				.moveTo(115, 400)
				.equilateral(30, (-2 * Math.PI) / 3, true)
				.play(),
		[],
	)
	return <canvas ref={canvas} />
}

function Four() {
	const canvas = useRef<HTMLCanvasElement | null>(null)
	useEffect(() => {
		const d = new Drawing(canvas.current!).moveTo(0, 0)

		const partial = Math.E
		for (let i = 0; i < 193; i++) {
			if (i % 2 === 0) {
				d.arc(200, (i * Math.PI) / partial, ((i + 1) * Math.PI) / partial)
			} else {
				d.arc(200, (i * Math.PI) / partial + Math.PI, ((i + 1) * Math.PI) / partial + Math.PI)
			}
		}

		return d.play(1000)
	}, [])
	return <canvas ref={canvas} />
}

class Drawing {
	ctx
	speed = 200 // pixels per second
	padding = 20

	#plan: Array<(() => Generator<undefined, void, number>) | (() => void)> = []
	#history: Array<() => void> = []
	#bounds = { minX: Infinity, minY: Infinity, maxX: 0, maxY: 0 }
	#position = { x: 0, y: 0 }
	#scale = 1
	#offset = { x: 0, y: 0 }

	constructor(canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext("2d")
		if (!ctx) throw new Error("Failed to get 2D context")
		this.ctx = ctx
		ctx.canvas.width = canvas.clientWidth * devicePixelRatio
		ctx.canvas.height = canvas.clientHeight * devicePixelRatio
		ctx.scale(devicePixelRatio, devicePixelRatio)
		ctx.lineWidth = 2
		ctx.strokeStyle = "white"
	}

	#transform(x: number, y: number): { x: number; y: number } {
		return {
			x: (x - this.#bounds.minX) * this.#scale + this.#offset.x,
			y: (y - this.#bounds.minY) * this.#scale + this.#offset.y,
		}
	}

	moveTo(x: number, y: number): this {
		this.#position.x = x
		this.#position.y = y
		this.#plan.push(() => this.#moveTo(x, y))
		return this
	}
	#moveTo(x: number, y: number) {
		const transformed = this.#transform(x, y)
		this.#position.x = transformed.x
		this.#position.y = transformed.y
	}

	lineTo(x: number, y: number): this {
		this.#bounds.minX = Math.min(this.#bounds.minX, this.#position.x, x)
		this.#bounds.minY = Math.min(this.#bounds.minY, this.#position.y, y)
		this.#bounds.maxX = Math.max(this.#bounds.maxX, this.#position.x, x)
		this.#bounds.maxY = Math.max(this.#bounds.maxY, this.#position.y, y)
		this.#plan.push(() => this.#lineTo(x, y))
		this.#position.x = x
		this.#position.y = y
		return this
	}
	*#lineTo(x: number, y: number): Generator<undefined, void, number> {
		const state = { t: 0 }
		const x1 = this.#position.x
		const y1 = this.#position.y
		const transformed = this.#transform(x, y)
		const dist = Math.hypot(transformed.x - x1, transformed.y - y1)
		const totalTime = dist / this.speed
		while (state.t < totalTime) {
			const dt = yield
			state.t += dt
			const t = Math.min(state.t / totalTime, 1)
			const cx = x1 + (transformed.x - x1) * t
			const cy = y1 + (transformed.y - y1) * t
			this.ctx.beginPath()
			this.ctx.moveTo(x1, y1)
			this.ctx.lineTo(cx, cy)
			this.ctx.stroke()
		}
		this.#position.x = transformed.x
		this.#position.y = transformed.y
		this.#history.push(() => {
			this.ctx.beginPath()
			this.ctx.moveTo(x1, y1)
			this.ctx.lineTo(transformed.x, transformed.y)
			this.ctx.stroke()
		})
	}

	arc(radius: number, startAngle: number, endAngle: number): this {
		const x = this.#position.x
		const y = this.#position.y

		// Calculate center of the arc
		const cx = x - radius * Math.cos(startAngle)
		const cy = y - radius * Math.sin(startAngle)

		// Calculate end position
		const endX = cx + radius * Math.cos(endAngle)
		const endY = cy + radius * Math.sin(endAngle)

		// Normalize angles to [0, 2π]
		const normalizeAngle = (angle: number) => (angle + 2 * Math.PI) % (2 * Math.PI)

		const normStart = normalizeAngle(startAngle)
		const normEnd = normalizeAngle(endAngle)
		const isCounterClockwise = endAngle - startAngle < 0

		// Check if arc crosses cardinal directions (0, π/2, π, 3π/2)
		const crossesAngle = (angle: number) => {
			if (isCounterClockwise) {
				return normStart >= angle && normEnd <= angle
			} else {
				return (
					(normStart <= angle && normEnd >= angle) || (normStart > normEnd && (normStart <= angle || normEnd >= angle))
				)
			}
		}

		// Start with start and end points
		let minX = Math.min(x, endX)
		let maxX = Math.max(x, endX)
		let minY = Math.min(y, endY)
		let maxY = Math.max(y, endY)

		// Check cardinal directions
		if (crossesAngle(0)) maxX = Math.max(maxX, cx + radius) // Right (0)
		if (crossesAngle(Math.PI / 2)) maxY = Math.max(maxY, cy + radius) // Bottom (π/2)
		if (crossesAngle(Math.PI)) minX = Math.min(minX, cx - radius) // Left (π)
		if (crossesAngle((3 * Math.PI) / 2)) minY = Math.min(minY, cy - radius) // Top (3π/2)

		this.#bounds.minX = Math.min(this.#bounds.minX, minX)
		this.#bounds.minY = Math.min(this.#bounds.minY, minY)
		this.#bounds.maxX = Math.max(this.#bounds.maxX, maxX)
		this.#bounds.maxY = Math.max(this.#bounds.maxY, maxY)

		this.#plan.push(() => this.#arc(radius, startAngle, endAngle))
		this.#position.x = endX
		this.#position.y = endY
		return this
	}
	*#arc(radius: number, startAngle: number, endAngle: number): Generator<undefined, void, number> {
		const state = { t: 0 }
		const scaledRadius = radius * this.#scale
		const centerX = this.#position.x - scaledRadius * Math.cos(startAngle)
		const centerY = this.#position.y - scaledRadius * Math.sin(startAngle)
		const angleDiff = endAngle - startAngle
		const arcLength = Math.abs(angleDiff) * scaledRadius
		const totalTime = arcLength / this.speed
		const direction = angleDiff < 0
		while (state.t < totalTime) {
			const dt = yield
			state.t += dt
			const t = Math.min(state.t / totalTime, 1)
			const angle = startAngle + angleDiff * t
			this.ctx.beginPath()
			this.ctx.moveTo(this.#position.x, this.#position.y)
			this.ctx.arc(centerX, centerY, scaledRadius, startAngle, angle, direction)
			this.ctx.stroke()
		}
		this.#position.x = centerX + scaledRadius * Math.cos(endAngle)
		this.#position.y = centerY + scaledRadius * Math.sin(endAngle)
		this.#history.push(() => {
			this.ctx.beginPath()
			this.ctx.arc(centerX, centerY, scaledRadius, startAngle, endAngle, direction)
			this.ctx.stroke()
		})
	}

	arcMoveTo(radius: number, startAngle: number, endAngle: number): this {
		const x = this.#position.x
		const y = this.#position.y

		// Calculate center of the arc
		const cx = x - radius * Math.cos(startAngle)
		const cy = y - radius * Math.sin(startAngle)

		// Calculate end position
		const endX = cx + radius * Math.cos(endAngle)
		const endY = cy + radius * Math.sin(endAngle)

		this.#position.x = endX
		this.#position.y = endY
		this.#plan.push(() => this.#moveTo(endX, endY))
		return this
	}

	equilateral(sideLength: number, rotate: number = 0, counterClockwise: boolean = false): this {
		const angleIncrement = ((2 * Math.PI) / 3) * (counterClockwise ? -1 : 1)
		for (let i = 0; i < 3; i++) {
			const angle = rotate + i * angleIncrement
			const x = this.#position.x + sideLength * Math.cos(angle)
			const y = this.#position.y + sideLength * Math.sin(angle)
			this.lineTo(x, y)
		}
		return this
	}

	*#play(): Generator<undefined, void, number> {
		for (const step of this.#plan) {
			const gen = step()
			if (gen) yield* gen
		}
	}
	play(speed = 200): () => void {
		const controller = new AbortController()

		// Calculate scale and offset for object-fit: contain
		const boundsWidth = this.#bounds.maxX - this.#bounds.minX
		const boundsHeight = this.#bounds.maxY - this.#bounds.minY
		const canvasWidth = this.ctx.canvas.width / devicePixelRatio - this.padding * 2
		const canvasHeight = this.ctx.canvas.height / devicePixelRatio - this.padding * 2

		this.#scale = Math.min(canvasWidth / boundsWidth, canvasHeight / boundsHeight)

		const scaledWidth = boundsWidth * this.#scale
		const scaledHeight = boundsHeight * this.#scale
		this.#offset.x = this.padding + (canvasWidth - scaledWidth) / 2
		this.#offset.y = this.padding + (canvasHeight - scaledHeight) / 2

		this.#position.x = 0
		this.#position.y = 0
		const generator = this.#play()

		if (speed > 0 && speed !== Infinity) {
			this.speed = speed
			let lastTime = performance.now()
			const frame = (time: number) => {
				if (controller.signal.aborted) return
				const delta = time - lastTime
				lastTime = time
				if (delta === time) return
				this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)
				for (const redraw of this.#history) redraw()
				generator.next(delta / 1000)
				requestAnimationFrame(frame)
			}
			requestAnimationFrame(frame)
		} else {
			while (!generator.next(Infinity).done) {
				/* empty */
			}
		}
		return () => controller.abort()
	}
}
