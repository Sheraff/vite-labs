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

		const values = Array.from({ length: SIDE * SIDE }, () => 0)
		const cooldown = Array.from({ length: SIDE * SIDE }, () => 0)

		function updateCell(index: number, amount: number) {
			if (values[index] > 1) return
			if (cooldown[index] > 0) return
			values[index] += amount
			if (values[index] < 1) return
			setTimeout(() => {
				const propagate = values[index] * 0.5
				if (index % SIDE !== 0) updateCell(index - 1, propagate)
				if (index % SIDE !== SIDE - 1) updateCell(index + 1, propagate)
				if (index - SIDE >= 0) updateCell(index - SIDE, propagate)
				if (index + SIDE < SIDE * SIDE) updateCell(index + SIDE, propagate)
			}, 100)
			setTimeout(() => {
				values[index] = 0
				cooldown[index] = 1
				setTimeout(() => {
					cooldown[index] = 0
				}, Math.random() * 1000 + 100)
			}, 500)
		}

		let updateId = requestAnimationFrame(function up() {
			updateId = requestAnimationFrame(up)

			// Randomly light up some cells
			const count = Math.floor(Math.random() * SIDE * 2)
			for (let i = 0; i < count; i++) {
				const index = Math.floor(Math.random() * SIDE * SIDE)
				updateCell(index, Math.random() * 0.3 + 0.1)
			}

			// Decay all cells
			for (let i = 0; i < SIDE * SIDE; i++) {
				if (values[i] > 0 && values[i] < 1) {
					values[i] -= 0.01
					if (values[i] < 0) values[i] = 0
				}
			}
		})

		let drawId = requestAnimationFrame(function draw() {
			drawId = requestAnimationFrame(draw)
			ctx.clearRect(0, 0, size, size)
			for (let y = 0; y < SIDE; y++) {
				for (let x = 0; x < SIDE; x++) {
					const index = y * SIDE + x
					const intensity = Math.min(values[index], 1)
					const radius = (size / SIDE) * 0.4 * (intensity * 0.5 + 0.5)
					ctx.fillStyle = `rgba(255, 223, 100, ${intensity})`
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