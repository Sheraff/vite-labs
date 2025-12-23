import type { RouteMeta } from "#router"

import { Head } from "#components/Head"
import { useEffect, useRef } from "react"

import styles from "./styles.module.css"

export const meta: RouteMeta = {
	title: "Imperative Geometry",
	tags: ["canvas", "wip"],
}

export default function ImperativeGeometryPage() {
	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<div className={styles.content}>
				<One />
			</div>
		</div>
	)
}

function One() {
	const canvas = useRef<HTMLCanvasElement | null>(null)
	useEffect(
		() =>
			new Drawing(canvas.current!)
				.moveTo(150, 150)
				.lineTo(300, 150)
				// .arc(50, 0, Math.PI)
				.arc(50, -Math.PI, 0)
				.lineTo(300, 350)
				.arc(50, 0, Math.PI)
				.lineTo(150, 350)
				.arc(50, -Math.PI, 0)
				.moveTo(150, 150)
				.lineTo(150, 500)
				.play(),
		[],
	)
	return <canvas ref={canvas} />
}

class Drawing {
	ctx
	speed // pixels per second
	padding = 20

	#plan: Array<(() => Generator<undefined, void, number>) | (() => void)> = []
	#history: Array<() => void> = []
	#bounds = { minX: Infinity, minY: Infinity, maxX: 0, maxY: 0 }
	#position = { x: 0, y: 0 }
	#scale = 1
	#offset = { x: 0, y: 0 }

	constructor(canvas: HTMLCanvasElement, speed: number = 100) {
		this.speed = speed
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

	*#play(): Generator<undefined, void, number> {
		for (const step of this.#plan) {
			const gen = step()
			if (gen) yield* gen
		}
	}
	play(): () => void {
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

		let lastTime = performance.now()
		const frame = (time: number) => {
			if (controller.signal.aborted) return
			const delta = time - lastTime
			lastTime = time
			if (delta === time) return
			this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)
			// this.ctx.beginPath()
			// this.ctx.rect(
			// 	this.#bounds.minX - this.padding,
			// 	this.#bounds.minY - this.padding,
			// 	this.#bounds.maxX - this.#bounds.minX + this.padding * 2,
			// 	this.#bounds.maxY - this.#bounds.minY + this.padding * 2,
			// )
			// this.ctx.stroke()
			// this.ctx.clip()
			for (const redraw of this.#history) redraw()
			generator.next(delta / 1000)
			requestAnimationFrame(frame)
		}
		requestAnimationFrame(frame)
		return () => controller.abort()
	}
}
