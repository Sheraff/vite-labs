import type { RouteMeta } from "~/router"
import styles from './styles.module.css'
import { Head } from "~/components/Head"
import { useEffect, useRef } from "react"

export const meta: RouteMeta = {
	title: 'Flow Field',
}

const SIDE = 30

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

		const GridType = Uint8Array
		const gridBuffer = new ArrayBuffer(length * GridType.BYTES_PER_ELEMENT)
		const maxCost = 2 ** (GridType.BYTES_PER_ELEMENT * 8) - 1
		const grid = new GridType(gridBuffer).fill(0)

		const IntegrationType = Uint16Array
		const integrationBuffer = new ArrayBuffer(length * IntegrationType.BYTES_PER_ELEMENT)
		const maxIntegration = 2 ** (IntegrationType.BYTES_PER_ELEMENT * 8) - 1
		const integration = new IntegrationType(integrationBuffer).fill(maxIntegration)

		const FieldType = Uint8Array
		const fieldBuffer = new ArrayBuffer(length * FieldType.BYTES_PER_ELEMENT)
		const field = new FieldType(fieldBuffer).fill(0)

		const goal = { x: Math.round(SIDE / 2), y: Math.round(SIDE / 2) }

		let lastTime = 0
		let rafId = requestAnimationFrame(function loop(time) {
			rafId = requestAnimationFrame(loop)

			const prev = lastTime
			const dt = time - lastTime
			lastTime = time
			if (!prev) return

			ctx.clearRect(0, 0, side, side)
			const colorMaxInt = Math.min(maxIntegration, SIDE * SIDE / 2)

			for (let y = 0; y < SIDE; y++) {
				const row = y * SIDE
				for (let x = 0; x < SIDE; x++) {
					const index = row + x
					// if (index > 8) continue

					// draw background (cell cost)
					const cost = grid[index]
					const int = integration[index] / colorMaxInt * 360
					// ctx.fillStyle = `hsl(${int}, 50%, ${cost / maxCost * 100}%)`
					ctx.fillStyle = `hsl(${int}, 50%, ${cost / maxCost * 50 + 50}%)`
					// ctx.fillStyle = `oklch(${cost / maxCost * 50 + 50}% 50% ${int})`
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
						const endX = centerX + xRatio * length
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
					let min = maxIntegration
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
							if (cost === maxCost) continue
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
			integration.fill(maxIntegration)
			const queue = [goal.x, goal.y]
			integration[goal.y * SIDE + goal.x] = 0
			// debugger
			while (queue.length > 0) {
				const x = queue.shift()!
				const y = queue.shift()!
				const index = y * SIDE + x
				const value = integration[index]
				west: {
					if (x === 0) break west
					const neighbor = index - 1
					const cost = grid[neighbor] || 1
					if (cost !== maxCost) {
						const next = value + cost
						const prev = integration[neighbor]
						if (next < prev) {
							integration[neighbor] = next
							queue.push(x - 1, y)
						}
					}
				}
				east: {
					if (x === SIDE - 1) break east
					const neighbor = index + 1
					const cost = grid[neighbor] || 1
					if (cost !== maxCost) {
						const next = value + cost
						const prev = integration[neighbor]
						if (next < prev) {
							integration[neighbor] = next
							queue.push(x + 1, y)
						}
					}
				}
				north: {
					if (y === 0) break north
					const neighbor = index - SIDE
					const cost = grid[neighbor] || 1
					if (cost !== maxCost) {
						const next = value + cost
						const prev = integration[neighbor]
						if (next < prev) {
							integration[neighbor] = next
							queue.push(x, y - 1)
						}
					}
				}
				south: {
					if (y === SIDE - 1) break south
					const neighbor = index + SIDE
					const cost = grid[neighbor] || 1
					if (cost !== maxCost) {
						const next = value + cost
						const prev = integration[neighbor]
						if (next < prev) {
							integration[neighbor] = next
							queue.push(x, y + 1)
						}
					}
				}
			}
			const after = performance.now()
			console.log('computeIntegration', after - before)
			computeField()
			// const summary = integration.reduce<Record<number, number>>((acc, cur) => {
			// 	if (acc[cur] === undefined) acc[cur] = 0
			// 	acc[cur]++
			// 	return acc
			// }, {})
			// console.log('summary', summary)
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

		canvas.addEventListener('pointermove', (event) => {
			if (down === false) return
			moved = true
			let changed = false
			for (const e of event.getCoalescedEvents()) {
				const { x, y } = eventToPosition(e)
				const index = y * SIDE + x
				const next = down ? maxCost : 0
				const prev = grid[index]
				if (prev !== undefined && prev !== next) {
					grid[index] = next
					changed = true
				}
			}
			if (changed) {
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
				const next = prev === 0 ? maxCost : 0
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
			if (grid[y * SIDE + x] === maxCost) return
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
		'-1': 0,
		'0': 1,
		'1': 2,
	},
	0: {
		'-1': 3,
		'0': 4,
		'1': 5,
	},
	1: {
		'-1': 6,
		'0': 7,
		'1': 8,
	},
}

const reverseFieldMap: Record<number, [x: number, y: number]> = {
	0: [-1, -1],
	1: [-1, 0],
	2: [-1, 1],
	3: [0, -1],
	4: [0, 0],
	5: [0, 1],
	6: [1, -1],
	7: [1, 0],
	8: [1, 1],
}