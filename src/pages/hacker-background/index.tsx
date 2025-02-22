import { useEffect, useRef } from "react"
import styles from './styles.module.css'
import { Head } from "~/components/Head"
import type { RouteMeta } from "~/router"

export const meta: RouteMeta = {
	title: 'Hacker Background',
}

export default function HackerBackground() {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return
		const onResize = () => {
			canvas.width = window.innerWidth * devicePixelRatio
			canvas.height = window.innerHeight * devicePixelRatio
		}
		onResize()
		window.addEventListener('resize', onResize)
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
		window.addEventListener('pointermove', onMouseMove, { passive: true })
		const clear = start(ctx, mouse, reference)
		return () => {
			window.removeEventListener('pointermove', onMouseMove)
			window.removeEventListener('resize', onResize)
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

const CHARS = ['·', '-', '+', '*', '#', '%', '█']

// const easing = (x: number) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
const easing = (x: number) => 1 - Math.cos((x * Math.PI) / 2)
// const easing = (x: number) => 1 - Math.sqrt(1 - Math.pow(x, 2))
// const easing = (x: number) => x * x * x * x * x

function start(
	ctx: CanvasRenderingContext2D,
	mouse: { x: number, y: number },
	reference: { em: number, lh: number }
) {
	const columns = Math.floor(ctx.canvas.width / reference.em)
	const rows = Math.floor(ctx.canvas.height / reference.lh)

	const influence = Math.min(ctx.canvas.width, ctx.canvas.height) / 6

	let prevX1 = 0
	let prevX2 = columns
	let prevY1 = 0
	let prevY2 = rows

	ctx.fillStyle = 'rgba(100, 0, 100)'
	ctx.font = `${reference.em}px monospace`

	let init = false

	const grid = Array.from({ length: rows }, () => Array.from({ length: columns }, () => CHARS[0]))

	let rafId = requestAnimationFrame(function loop() {
		rafId = requestAnimationFrame(loop)

		if (!init) {
			for (let row = 0; row <= rows; row++) {
				for (let col = 0; col <= columns; col++) {
					ctx.fillText(CHARS[0], (col - 0.5) * reference.em, (row + 0.5) * reference.lh)
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
						const charIndex = Math.floor(easing(normalized) * (CHARS.length - 1)) + 1
						const currentIndex = CHARS.indexOf(current)
						if (charIndex >= currentIndex) {
							ctx.clearRect((col - 0.5) * reference.em, (row - 0.25) * reference.lh, reference.em, reference.lh)
							ctx.fillText(CHARS[charIndex], (col - 0.5) * reference.em, (row + 0.5) * reference.lh)
							gridRow[col] = CHARS[charIndex]
							continue
						}
					}
				}
				if (current !== CHARS[0]) {
					const index = CHARS.indexOf(current)
					const decay = Math.random() < index / 100
					if (decay) {
						ctx.clearRect((col - 0.5) * reference.em, (row - 0.25) * reference.lh, reference.em, reference.lh)
						const next = CHARS[index - 1]
						gridRow[col] = next
						ctx.fillText(next, (col - 0.5) * reference.em, (row + 0.5) * reference.lh)
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
			const index = CHARS.length - 1
			ctx.clearRect((col - 0.5) * reference.em, (row - 0.25) * reference.lh, reference.em, reference.lh)
			ctx.fillText(CHARS[index], (col - 0.5) * reference.em, (row + 0.5) * reference.lh)
			grid[row][col] = CHARS[index]
		}


	})
	return () => cancelAnimationFrame(rafId)
}