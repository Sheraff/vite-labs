import type { RouteMeta } from "#router"
import styles from './styles.module.css'
import { Head } from "#components/Head"
import { useEffect, useRef, useState, type CSSProperties } from "react"

export const meta: RouteMeta = {
	title: 'Polka Fireflies',
	image: './screen.png'

}

const SIDE = 50

export default function PolkaFirefliesPage() {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current!

		const size = Math.min(window.innerWidth, window.innerHeight) * devicePixelRatio
		canvas.width = size
		canvas.height = size
		canvas.style.width = `${size / devicePixelRatio}px`
		canvas.style.height = `${size / devicePixelRatio}px`
		const ctx = canvas.getContext("2d")!

		const values = new Float32Array(SIDE * SIDE)
		const cooldown = new Uint8Array(SIDE * SIDE)
		let lastTime = 0

		const queue = [] as Array<[time: number, callback: () => void]>
		function enqueue(callback: () => void, delay: number) {
			const time = lastTime + delay
			queue.push([time, callback])
			queue.sort((a, b) => a[0] - b[0])
		}
		const processQueue = () => {
			let i = 0
			for (; i < queue.length; i++) {
				const [time, callback] = queue[i]
				if (time <= lastTime) {
					callback()
				} else {
					break
				}
			}
			if (i > 0) {
				queue.splice(0, i)
			}
		}

		function updateCell(index: number, amount: number) {
			if (values[index] > 1) return
			if (cooldown[index] > 0) return
			values[index] += amount
			if (values[index] < 1) return
			const propagate = values[index] * 0.8
			enqueue(() => {
				if (index % SIDE !== 0) updateCell(index - 1, propagate)
				if (index % SIDE !== SIDE - 1) updateCell(index + 1, propagate)
				if (index - SIDE >= 0) updateCell(index - SIDE, propagate)
				if (index + SIDE < SIDE * SIDE) updateCell(index + SIDE, propagate)
			}, 100)
			cooldown[index] = 1
			enqueue(() => {
				values[index] = 0
				enqueue(() => {
					cooldown[index] = 0
				}, Math.random() * 1000 + 100)
			}, 700)
		}

		let updateId = requestAnimationFrame(function up(time) {
			updateId = requestAnimationFrame(up)

			const delta = time - lastTime
			lastTime = time
			if (delta === time) return // first frame

			// Randomly light up some cells
			const count = Math.floor(Math.random() * SIDE * delta * 0.05)
			for (let i = 0; i < count; i++) {
				const index = Math.floor(Math.random() * SIDE * SIDE)
				updateCell(index, Math.random() * 0.3)
			}

			// Decay all cells
			for (let i = 0; i < SIDE * SIDE; i++) {
				if (values[i] > 0 && values[i] < 1) {
					values[i] -= 0.0002 * delta
					if (values[i] < 0) values[i] = 0
				}
			}

			processQueue()
		})

		let drawId = requestAnimationFrame(function draw() {
			drawId = requestAnimationFrame(draw)
			ctx.clearRect(0, 0, size, size)
			for (let y = 0; y < SIDE; y++) {
				for (let x = 0; x < SIDE; x++) {
					const index = y * SIDE + x
					const intensity = Math.min(values[index], 1)
					const radius = (size / SIDE) * 0.4 * (intensity * 0.5 + 0.5)
					const yellow = [90.749, 0.14483, 94.754]
					const green = [82.386, 0.19922, 137.587]
					const l = yellow[0] * intensity + green[0] * (1 - intensity)
					const c = yellow[1] * intensity + green[1] * (1 - intensity)
					const h = yellow[2] * intensity + green[2] * (1 - intensity)
					ctx.fillStyle = `oklch(${l}% ${c} ${h} / ${intensity})`
					ctx.beginPath()
					ctx.arc(
						(x + 0.5) * (size / SIDE),
						(y + 0.5) * (size / SIDE),
						radius,
						0,
						Math.PI * 2
					)
					ctx.fill()
				}
			}
		})

		return () => {
			cancelAnimationFrame(updateId)
			cancelAnimationFrame(drawId)
		}
	})

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<canvas ref={canvasRef} />
		</div>
	)
}