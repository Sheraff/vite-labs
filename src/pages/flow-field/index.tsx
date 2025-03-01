import type { RouteMeta } from "~/router"
import styles from './styles.module.css'
import { Head } from "~/components/Head"
import { useEffect, useRef } from "react"

export const meta: RouteMeta = {
	title: 'Flow Field',
}

const SIDE = 20

export default function FlowFieldPage() {
	const ref = useRef<HTMLCanvasElement | null>(null)

	useEffect(() => {
		const base = Math.min(window.innerWidth, window.innerHeight)
		const side = base * devicePixelRatio
		const length = SIDE * SIDE
		const px = side / SIDE
		const pointerLength = px / 2

		const canvas = ref.current
		if (!canvas) return
		canvas.width = side
		canvas.height = side
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		const gridBuffer = new ArrayBuffer(length * Uint8Array.BYTES_PER_ELEMENT)
		const grid = new Uint8Array(gridBuffer).fill(0)
		const integrationBuffer = new ArrayBuffer(length * Uint8Array.BYTES_PER_ELEMENT)
		const integration = new Uint8Array(integrationBuffer).fill(0xffffff)
		const fieldBuffer = new ArrayBuffer(length * Uint8Array.BYTES_PER_ELEMENT)
		const field = new Uint8Array(fieldBuffer).fill(0)

		const goal = { x: Math.round(SIDE / 2), y: Math.round(SIDE / 2) }

		let lastTime = 0
		let rafId = requestAnimationFrame(function loop(time) {
			rafId = requestAnimationFrame(loop)

			const prev = lastTime
			const dt = time - lastTime
			lastTime = time
			if (!prev) return

			ctx.clearRect(0, 0, side, side)

			// field[0] = 0x00
			// field[1] = 0x01
			// field[2] = 0x02
			// field[3] = 0x03
			// field[4] = 0x04
			// field[5] = 0x05
			// field[6] = 0x06
			// field[7] = 0x07
			// field[8] = 0x08

			const maxIntegration = Math.max(...integration)

			// console.log('maxIntegration', maxIntegration)

			for (let y = 0; y < SIDE; y++) {
				const row = y * SIDE
				for (let x = 0; x < SIDE; x++) {
					const index = row + x
					// if (index > 8) continue

					// draw background (cell cost)
					const cost = grid[index]
					const int = integration[index] / maxIntegration * 360
					// ctx.fillStyle = `hsl(${int}, 50%, ${cost / 255 * 100}%)`
					ctx.fillStyle = `hsl(${int}, 50%, ${cost / 255 * 50 + 50}%)`
					// ctx.fillStyle = `oklch(${cost / 255 * 50 + 50}% 50% ${int})`
					ctx.fillRect(x * px, y * px, px, px)

					// draw direction (flow field)
					ctx.strokeStyle = 'black'
					ctx.fillStyle = 'black'
					const [dx, dy] = readField(x, y)
					if (dx === 0 && dy === 0) {
						ctx.beginPath()
						ctx.arc(x * px + px / 2, y * px + px / 2, pointerLength / 4, 0, Math.PI * 2)
						ctx.fill()
					} else {
						const angle = Math.atan2(dy, dx)
						const length = pointerLength / 2
						const centerX = x * px + px / 2
						const centerY = y * px + px / 2
						const xRatio = Math.cos(angle)
						const yRatio = Math.sin(angle)
						const endX = centerX + xRatio * length // End point in direction of flow
						const endY = centerY + yRatio * length
						const startX = centerX - xRatio * length
						const startY = centerY - yRatio * length
						ctx.beginPath()
						ctx.moveTo(startX, startY)
						ctx.lineTo(endX, endY)
						ctx.stroke()
						ctx.beginPath()
						ctx.arc(endX, endY, length / 2, 0, Math.PI * 2)
						ctx.fill()
					}

					// draw walls (grid)
					ctx.strokeStyle = 'white'
					ctx.strokeRect(x * px, y * px, px, px)

					// draw goal
					if (x === goal.x && y === goal.y) {
						ctx.fillStyle = 'red'
						ctx.beginPath()
						ctx.arc(x * px + px / 2, y * px + px / 2, px / 4, 0, Math.PI * 2)
						ctx.fill()
					}
				}
			}
			// cancelAnimationFrame(rafId)
		})

		function readField(x: number, y: number) {
			const index = y * SIDE + x
			const value = field[index]
			return reverseFieldMap[value]
		}

		function computeField() {
			const before = performance.now()
			for (let y = 0; y < SIDE; y++) {
				const row = y * SIDE
				for (let x = 0; x < SIDE; x++) {
					const index = row + x
					if (x === goal.x && y === goal.y) {
						field[index] = fieldMap[0][0]
						continue
					}
					let min = 0xffffff
					let minx = 0
					let miny = 0
					for (let i = -1; i <= 1; i++) {
						for (let j = -1; j <= 1; j++) {
							if (i === 0 && j === 0) continue
							const dx = x + i
							if (dx < 0 || dx >= SIDE) continue
							const dy = y + j
							if (dy < 0 || dy >= SIDE) continue
							const cost = grid[dy * SIDE + dx]
							if (cost === 255) continue
							const value = integration[dy * SIDE + dx]
							if (value < min) {
								min = value
								minx = i
								miny = j
							}
						}
					}
					field[index] = fieldMap[minx][miny]
				}
			}
			const after = performance.now()
			console.log('computeField', after - before)
		}

		function computeIntegration() {
			const before = performance.now()
			integration.fill(0xffffff)
			const queue = [goal.x, goal.y]
			integration[goal.y * SIDE + goal.x] = 0
			while (queue.length > 0) {
				const x = queue.shift()!
				const y = queue.shift()!
				const index = y * SIDE + x
				const value = integration[index]
				west: {
					if (x <= 0) break
					const cost = grid[index - 1] || 1
					if (cost !== 255) {
						const next = value + cost
						const prev = integration[index - 1]
						if (next < prev) {
							integration[index - 1] = next
							queue.push(x - 1, y)
						}
					}
				}
				east: {
					if (x >= SIDE - 1) break
					const cost = grid[index + 1] || 1
					if (cost !== 255) {
						const next = value + cost
						const prev = integration[index + 1]
						if (next < prev) {
							integration[index + 1] = next
							queue.push(x + 1, y)
						}
					}
				}
				north: {
					if (y <= 0) break
					const cost = grid[index - SIDE] || 1
					if (cost !== 255) {
						const next = value + cost
						const prev = integration[index - SIDE]
						if (next < prev) {
							integration[index - SIDE] = next
							queue.push(x, y - 1)
						}
					}
				}
				south: {
					if (y >= SIDE - 1) break
					const cost = grid[index + SIDE] || 1
					if (cost !== 255) {
						const next = value + cost
						const prev = integration[index + SIDE]
						if (next < prev) {
							integration[index + SIDE] = next
							queue.push(x, y + 1)
						}
					}
				}
			}
			const after = performance.now()
			console.log('computeIntegration', after - before)
			computeField()
			const summary = integration.reduce<Record<number, number>>((acc, cur) => {
				if (acc[cur] === undefined) acc[cur] = 0
				acc[cur]++
				return acc
			}, {})
			console.log('summary', summary)
		}
		computeIntegration()

		const controller = new AbortController()

		const eventToPosition = (e: PointerEvent | MouseEvent) => {
			const { left, top } = canvas.getBoundingClientRect()
			const x = Math.floor((e.clientX - left) / base * SIDE)
			const y = Math.floor((e.clientY - top) / base * SIDE)
			return { x, y }
		}

		let down: false | 0 | 1 = false
		let moved = false
		canvas.addEventListener('pointerdown', (e) => {
			if (e.button !== 0) return
			if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
			const { x, y } = eventToPosition(e)
			const value = grid[y * SIDE + x]
			down = value === 0 ? 1 : 0
		}, { signal: controller.signal })

		canvas.addEventListener('pointermove', (e) => {
			if (down === false) return
			moved = true
			const { x, y } = eventToPosition(e)
			const index = y * SIDE + x
			const next = down ? 255 : 0
			const prev = grid[index]
			if (prev !== undefined && prev !== next) {
				grid[index] = next
				computeIntegration()
			}
		}, { signal: controller.signal })

		canvas.addEventListener('click', (e) => {
			if (e.button !== 0) return
			if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
			down = false
			if (!moved) {
				const { x, y } = eventToPosition(e)
				const index = y * SIDE + x
				const prev = grid[index]
				const next = prev === 0 ? 255 : 0
				if (prev !== undefined && prev !== next) {
					grid[index] = next
					computeIntegration()
				}
			}
			moved = false
		}, { signal: controller.signal })


		// canvas.addEventListener('contextmenu', (e) => {
		// 	e.preventDefault()
		// 	down = false
		// 	moved = false
		// 	const { x, y } = eventToPosition(e)
		// 	goal.x = x
		// 	goal.y = y
		// 	console.log('set goal', x, y)
		// 	computeIntegration()
		// }, { signal: controller.signal })

		canvas.addEventListener('pointermove', (e) => {
			const { x, y } = eventToPosition(e)
			if (x === goal.x && y === goal.y) return
			goal.x = x
			goal.y = y
			computeIntegration()
		}, { signal: controller.signal })

		return () => {
			cancelAnimationFrame(rafId)
			controller.abort()
		}
	}, [])

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<canvas width="1000" height="1000" ref={ref}>
				Your browser does not support the HTML5 canvas tag.
			</canvas>
		</div>
	)
}

const fieldMap: Record<number, Record<number, number>> = {
	'-1': {
		'-1': 0x00,
		'0': 0x01,
		'1': 0x02,
	},
	0: {
		'-1': 0x03,
		'0': 0x04,
		'1': 0x05,
	},
	1: {
		'-1': 0x06,
		'0': 0x07,
		'1': 0x08,
	},
}

const reverseFieldMap: Record<number, [x: number, y: number]> = {
	0x00: [-1, -1],
	0x01: [-1, 0],
	0x02: [-1, 1],
	0x03: [0, -1],
	0x04: [0, 0],
	0x05: [0, 1],
	0x06: [1, -1],
	0x07: [1, 0],
	0x08: [1, 1],
}