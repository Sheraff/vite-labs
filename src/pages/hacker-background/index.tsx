import type { RouteMeta } from "#router"

import { Head } from "#components/Head"
import { useEffect, useRef } from "react"

import styles from "./styles.module.css"

export const meta: RouteMeta = {
	title: "Hacker Background",
	image: "./screen.png",
	tags: ["animation", "ascii"],
}

export default function HackerBackground() {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext("2d")
		if (!ctx) return
		const onResize = () => {
			canvas.width = window.innerWidth * devicePixelRatio
			canvas.height = window.innerHeight * devicePixelRatio
		}
		onResize()
		window.addEventListener("resize", onResize)
		const mouse = { x: -Infinity, y: -Infinity }
		const reference = {
			em: parseFloat(getComputedStyle(document.documentElement).fontSize) * devicePixelRatio,
			lh: parseFloat(getComputedStyle(document.documentElement).lineHeight) * devicePixelRatio,
		}
		const onMouseMove = (e: PointerEvent) => {
			const event = e.getPredictedEvents().at(0) || e
			mouse.x = event.clientX * devicePixelRatio
			mouse.y = event.clientY * devicePixelRatio
		}
		window.addEventListener("pointermove", onMouseMove, { passive: true })
		const clear = start(ctx, mouse, reference)
		return () => {
			window.removeEventListener("pointermove", onMouseMove)
			window.removeEventListener("resize", onResize)
			clear()
		}
	}, [])

	return (
		<div className={styles.main}>
			<Head />

			<canvas id="canvas" ref={canvasRef} className={styles.canvas}></canvas>
		</div>
	)
}

const CHARS = [
	"·",
	"-",
	"=",
	"+",
	"*",
	"#",
	"%",
	// '&',
	// '║',
	// '■',
	"█",
]

const cubicEaseInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const sineEaseOut = (x: number) => 1 - Math.cos((x * Math.PI) / 2)
const circEaseOut = (x: number) => 1 - Math.sqrt(1 - Math.pow(x, 2))
const quinticEaseIn = (x: number) => x * x * x * x * x

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const getColor = (index: number, alpha: number = 1) => {
	// oklch(0.15 0.18 244)
	// oklch(0.35 0.18 328)
	const ratio = index / (CHARS.length - 1)
	const t = sineEaseOut(ratio)
	const light = lerp(0.15, 0.35, t)
	const hue = lerp(244, 328, ratio)
	return `oklch(${light} 0.18 ${hue} / ${alpha})`
}

function start(ctx: CanvasRenderingContext2D, mouse: { x: number; y: number }, reference: { em: number; lh: number }) {
	const columns = Math.floor(ctx.canvas.width / reference.em)
	const rows = Math.floor(ctx.canvas.height / reference.lh)

	const influence = Math.min(ctx.canvas.width, ctx.canvas.height) / 6

	let prevX1 = 0
	let prevX2 = columns
	let prevY1 = 0
	let prevY2 = rows

	ctx.font = `${reference.em}px monospace`

	let init = false

	const grid = Array.from({ length: rows }, () => Array.from({ length: columns }, () => CHARS[0]))

	const clearChar = (row: number, col: number) => {
		ctx.clearRect((col - 0.7) * reference.em, (row - 0.23) * reference.lh, reference.em, reference.lh)
	}

	const drawChar = (row: number, col: number, index: number) => {
		if (index > 0) {
			const gradient = ctx.createRadialGradient(
				(col - 0.2) * reference.em,
				(row + 0.3) * reference.lh,
				0,
				(col - 0.2) * reference.em,
				(row + 0.3) * reference.lh,
				reference.em,
			)
			const opacity = lerp(0.4, 0.8, index / (CHARS.length - 1))
			gradient.addColorStop(0, getColor(index, opacity))
			gradient.addColorStop(1, "transparent")
			ctx.fillStyle = gradient
			ctx.fillRect((col - 0.7) * reference.em, (row - 0.23) * reference.lh, reference.em, reference.lh)
		}
		ctx.fillStyle = getColor(index)
		const char = CHARS[index]
		ctx.fillText(char, (col - 0.5) * reference.em, (row + 0.5) * reference.lh)
	}

	let rafId = requestAnimationFrame(function loop() {
		rafId = requestAnimationFrame(loop)

		if (!init) {
			for (let row = 0; row <= rows; row++) {
				for (let col = 0; col <= columns; col++) {
					drawChar(row, col, 0)
				}
			}
			init = true
			return
		}

		const influenceX1 = Math.max(Math.floor((mouse.x - influence) / reference.em), 0)
		const influenceX2 = Math.min(Math.ceil((mouse.x + influence) / reference.em), columns)
		const influenceY1 = Math.max(Math.floor((mouse.y - influence) / reference.lh), 0)
		const influenceY2 = Math.min(Math.ceil((mouse.y + influence) / reference.lh), rows)

		const minX = Math.min(influenceX1, prevX1)
		const maxX = Math.max(influenceX2, prevX2)
		const minY = Math.min(influenceY1, prevY1)
		const maxY = Math.max(influenceY2, prevY2)

		for (let row = 0; row < grid.length; row++) {
			const gridRow = grid[row]
			for (let col = 0; col < gridRow.length; col++) {
				const current = gridRow?.[col] || CHARS[0]
				const reachable = row >= minY && row <= maxY && col >= minX && col <= maxX
				if (reachable) {
					const distance = Math.hypot(col * reference.em - mouse.x, row * reference.lh - mouse.y)
					if (distance < influence) {
						const normalized = 1 - distance / influence
						const charIndex = Math.floor(sineEaseOut(normalized) * (CHARS.length - 1)) + 1
						const currentIndex = CHARS.indexOf(current)
						if (charIndex === currentIndex) continue
						if (charIndex > currentIndex) {
							const nextIndex = Math.min(charIndex, currentIndex + 1)
							const upcay = Math.random() < nextIndex / 20
							if (upcay) {
								clearChar(row, col)
								drawChar(row, col, nextIndex)
								gridRow[col] = CHARS[nextIndex]
							}
							continue
						}
					}
				}
				if (current !== CHARS[0]) {
					const index = CHARS.indexOf(current)
					const decay = Math.random() < index / 100
					if (decay) {
						clearChar(row, col)
						const nextIndex = index - 1
						const next = CHARS[nextIndex]
						gridRow[col] = next
						drawChar(row, col, nextIndex)
					}
				}
			}
		}

		prevX1 = influenceX1
		prevX2 = influenceX2
		prevY1 = influenceY1
		prevY2 = influenceY2

		if (Math.random() < 0.2) {
			const col = Math.floor(Math.random() * columns)
			const row = Math.floor(Math.random() * rows)
			const nextIndex = CHARS.length - 1
			clearChar(row, col)
			drawChar(row, col, nextIndex)
			grid[row][col] = CHARS[nextIndex]
		}
	})
	return () => cancelAnimationFrame(rafId)
}
