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
				.line(150, 150, 300, 150)
				.circle(300, 250, 50)
				.line(300, 350, 150, 350)
				.circle(150, 250, 50)
				.triangle(225, 250, 100, -Math.PI / 2)
				.play(),
		[],
	)
	return <canvas ref={canvas} />
}

class Drawing {
	ctx
	speed // pixels per second
	padding = 20

	#plan: Array<() => Generator<undefined, void, number>> = []
	#history: Array<() => void> = []
	#bounds = {minX: Infinity, minY: Infinity, maxX: 0, maxY: 0}

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

	line(x1: number, y1: number, x2: number, y2: number): this {
		this.#bounds.minX = Math.min(this.#bounds.minX, x1, x2)
		this.#bounds.minY = Math.min(this.#bounds.minY, y1, y2)
		this.#bounds.maxX = Math.max(this.#bounds.maxX, x1, x2)
		this.#bounds.maxY = Math.max(this.#bounds.maxY, y1, y2)
		this.#plan.push(() => this.#line(x1, y1, x2, y2))
		return this
	}
	*#line(x1: number, y1: number, x2: number, y2: number): Generator<undefined, void, number> {
		const state = { t: 0 }
		const dist = Math.hypot(x2 - x1, y2 - y1)
		const totalTime = dist / this.speed
		while (state.t < totalTime) {
			const dt = yield
			state.t += dt
			const t = Math.min(state.t / totalTime, 1)
			const x = x1 + (x2 - x1) * t
			const y = y1 + (y2 - y1) * t
			this.ctx.beginPath()
			this.ctx.moveTo(x1, y1)
			this.ctx.lineTo(x, y)
			this.ctx.stroke()
		}
		this.#history.push(() => {
			this.ctx.beginPath()
			this.ctx.moveTo(x1, y1)
			this.ctx.lineTo(x2, y2)
			this.ctx.stroke()
		})
	}

	circle(cx: number, cy: number, radius: number): this {
		this.#bounds.minX = Math.min(this.#bounds.minX, cx - radius)
		this.#bounds.minY = Math.min(this.#bounds.minY, cy - radius)
		this.#bounds.maxX = Math.max(this.#bounds.maxX, cx + radius)
		this.#bounds.maxY = Math.max(this.#bounds.maxY, cy + radius)
		this.#plan.push(() => this.#circle(cx, cy, radius))
		return this
	}
	*#circle(cx: number, cy: number, radius: number): Generator<undefined, void, number> {
		const state = { t: 0 }
		const circumference = 2 * Math.PI * radius
		const totalTime = circumference / this.speed
		while (state.t < totalTime) {
			const dt = yield
			state.t += dt
			const t = Math.min(state.t / totalTime, 1)
			const angle = t * 2 * Math.PI
			this.ctx.beginPath()
			this.ctx.moveTo(cx + radius, cy)
			this.ctx.arc(cx, cy, radius, 0, angle)
			this.ctx.stroke()
		}
		this.#history.push(() => {
			this.ctx.beginPath()
			this.ctx.arc(cx, cy, radius, 0, 2 * Math.PI)
			this.ctx.stroke()
		})
	}

	triangle(x: number, y: number, side: number, rotation: number = 0): this {
		this.#bounds.minX = Math.min(this.#bounds.minX, x - side, x + side, x)
		this.#bounds.minY = Math.min(this.#bounds.minY, y - side, y + side, y)
		this.#bounds.maxX = Math.max(this.#bounds.maxX, x + side, x - side, x)
		this.#bounds.maxY = Math.max(this.#bounds.maxY, y + side, y - side, y)
		this.#plan.push(() => this.#triangle(x, y, side, rotation))
		return this
	}
	*#triangle(x: number, y: number, side: number, rotation: number = 0): Generator<undefined, void, number> {
		yield* this.#line(
			x,
			y,
			x + side * Math.cos(rotation + (2 * Math.PI) / 3),
			y + side * Math.sin(rotation + (2 * Math.PI) / 3),
		)
		yield* this.#line(
			x + side * Math.cos(rotation + (2 * Math.PI) / 3),
			y + side * Math.sin(rotation + (2 * Math.PI) / 3),
			x + side * Math.cos(rotation + (4 * Math.PI) / 3),
			y + side * Math.sin(rotation + (4 * Math.PI) / 3),
		)
		yield* this.#line(
			x + side * Math.cos(rotation + (4 * Math.PI) / 3),
			y + side * Math.sin(rotation + (4 * Math.PI) / 3),
			x,
			y,
		)
	}

	*#play(): Generator<undefined, void, number> {
		for (const step of this.#plan) {
			yield* step()
		}
	}
	play(): () => void {
		const controller = new AbortController()
		const generator = this.#play()

		let lastTime = performance.now()
		const frame = (time: number) => {
			if (controller.signal.aborted) return
			const delta = time - lastTime
			lastTime = time
			if (delta === time) return
			this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)
			this.ctx.beginPath()
			this.ctx.rect(
				this.#bounds.minX - this.padding,
				this.#bounds.minY - this.padding,
				this.#bounds.maxX - this.#bounds.minX + this.padding * 2,
				this.#bounds.maxY - this.#bounds.minY + this.padding * 2,
			)
			this.ctx.stroke()
			this.ctx.clip()
			for (const redraw of this.#history) redraw()
			generator.next(delta / 1000)
			requestAnimationFrame(frame)
		}
		requestAnimationFrame(frame)
		return () => controller.abort()
	}
}
