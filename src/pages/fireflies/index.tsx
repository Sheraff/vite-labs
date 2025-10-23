import type { RouteMeta } from "#router"
import styles from './styles.module.css'
import { Head } from "#components/Head"
import { useEffect, useRef, useState, type CSSProperties } from "react"
import { StaticTreeNode } from "#particle-life/StaticTreeNode"

export const meta: RouteMeta = {
	title: 'Fireflies',
	image: './screen.png'
}

export default function FirefliesPage() {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current!

		const width = window.innerWidth * devicePixelRatio
		const height = window.innerHeight * devicePixelRatio
		canvas.width = width
		canvas.height = height
		canvas.style.width = `${window.innerWidth}px`
		canvas.style.height = `${window.innerHeight}px`
		const ctx = canvas.getContext("2d")!

		const count = Math.round(width * height * 0.001)
		const flySize = 4
		const vision = 100

		const x = new Float32Array(count)
		const y = new Float32Array(count)
		const angle = new Float32Array(count)
		const speed = new Float32Array(count)
		const values = new Float32Array(count)
		const cooldown = new Uint8Array(count)

		const tree = new StaticTreeNode(
			0,
			0,
			width,
			height,
			x,
			y,
			8
		)
		for (let i = 0; i < count; i++) {
			x[i] = Math.random() * width
			y[i] = Math.random() * height
			angle[i] = Math.random() * Math.PI * 2
			speed[i] = Math.random() * 0.01 + 0.005
			values[i] = (Math.random()) * 0.8
			tree.insert(i)
		}

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
			if (values[index] >= 1) return
			if (cooldown[index] > 0) return
			values[index] = Math.min(1, values[index] + amount)
			if (values[index] < 1) return
			const neighbors = tree.query(x[index], y[index], vision)
			enqueue(() => {
				for (const nIndex of neighbors) {
					if (nIndex === index) continue
					const distance = Math.hypot(x[nIndex] - x[index], y[nIndex] - y[index])
					if (distance > vision) continue
					const attenuation = Math.max(0, 1 - distance / vision) * 0.6
					updateCell(nIndex, attenuation)
				}
			}, 80)
			cooldown[index] = 1
			enqueue(() => {
				values[index] = 0
				enqueue(() => {
					cooldown[index] = 0
				}, Math.random() * 1000 + 500)
			}, 1000)
		}

		let frameCount = 0
		let updateId = requestAnimationFrame(function up(time) {
			updateId = requestAnimationFrame(up)

			const delta = time - lastTime
			lastTime = time
			if (delta === time) return // first frame
			frameCount++

			// Randomly light up some cells
			const rand = Math.floor(Math.random() * count * delta * 0.004)
			for (let i = 0; i < rand; i++) {
				const index = Math.floor(Math.random() * count)
				updateCell(index, easeInCubic(Math.random()) * 0.2)
			}

			// Decay all cells
			for (let i = 0; i < count; i++) {
				if (values[i] > 0 && values[i] < 1) {
					values[i] -= 0.0001 * delta
					if (values[i] < 0) values[i] = 0
				}
			}

			// update positions
			for (let i = 0; i < count; i++) {
				angle[i] += (Math.random() - 0.5) * 0.01 * delta

				x[i] += Math.cos(angle[i]) * speed[i] * delta
				y[i] += Math.sin(angle[i]) * speed[i] * delta

				// "bounce" off walls
				if (x[i] < 0) {
					x[i] = 0
					angle[i] = Math.PI - angle[i]
				} else if (x[i] > width) {
					x[i] = width
					angle[i] = Math.PI - angle[i]
				}
				if (y[i] < 0) {
					y[i] = 0
					angle[i] = -angle[i]
				} else if (y[i] > height) {
					y[i] = height
					angle[i] = -angle[i]
				}

			}

			// update tree
			if (frameCount % 10 === 0) {
				for (let i = 0; i < count; i++) {
					tree.update(i)
				}
			}

			processQueue()
		})

		let drawId = requestAnimationFrame(function draw() {
			drawId = requestAnimationFrame(draw)
			ctx.clearRect(0, 0, canvas.width, canvas.height)
			for (let i = 0; i < count; i++) {
				const intensity = values[i]
				const off = cooldown[i] > 0 && intensity === 0
				const radius = flySize * (intensity * 0.5 + 0.5)
				if (off) {
					ctx.fillStyle = 'oklch(15.963% 0.04264 135.797)'
				} else {
					const eased = easeInCubic(intensity)
					const yellow = [90.749, 0.14483, 94.754]
					const green = [82.386, 0.19922, 137.587]
					const l = yellow[0] * eased + green[0] * (1 - eased)
					const c = yellow[1] * eased + green[1] * (1 - eased)
					const h = yellow[2] * eased + green[2] * (1 - eased)
					ctx.fillStyle = `oklch(${l}% ${c} ${h} / ${eased * 0.8 + 0.2})`
				}
				ctx.beginPath()
				ctx.arc(
					x[i],
					y[i],
					radius,
					0,
					Math.PI * 2
				)
				ctx.fill()
				// if (intensity > 0.8) {
				// 	ctx.strokeStyle = 'white'
				// 	ctx.beginPath()
				// 	ctx.arc(
				// 		x[i],
				// 		y[i],
				// 		vision,
				// 		0,
				// 		Math.PI * 2
				// 	)
				// 	ctx.stroke()
				// }
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

function easeInCubic(x: number): number {
	return x * x * x
}