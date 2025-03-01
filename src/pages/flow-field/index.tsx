import type { RouteMeta } from "~/router"
import styles from './styles.module.css'
import { Head } from "~/components/Head"
import { useEffect, useRef } from "react"
import FieldWorker from './field.worker?worker'
import type { Incoming as FieldIncoming } from './field.worker'
import { reverseFieldMap } from "@flow-field/utils"

export const meta: RouteMeta = {
	title: 'Flow Field',
	image: './screen.png'
}

const SIDE = 64
const workerCount = 16 // 1 | 4 | 16 | 64

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

		const workersPerRow = Math.sqrt(workerCount)
		const workerSide = SIDE / workersPerRow
		const layers = workerSide * workerSide
		const layerLength = layers * workerCount

		const GridType = Uint8Array
		const gridBuffer = new SharedArrayBuffer(length * GridType.BYTES_PER_ELEMENT)
		const maxCost = 2 ** (GridType.BYTES_PER_ELEMENT * 8) - 1
		const grid = new GridType(gridBuffer).fill(0)

		const IntegrationType = Uint8Array
		const integrationBuffer = new SharedArrayBuffer(length * IntegrationType.BYTES_PER_ELEMENT * layers)
		const maxIntegration = 2 ** (IntegrationType.BYTES_PER_ELEMENT * 8) - 1
		new IntegrationType(integrationBuffer).fill(maxIntegration)

		const FieldType = Uint8Array
		const fieldBuffer = new SharedArrayBuffer(length * FieldType.BYTES_PER_ELEMENT * layers)
		new FieldType(fieldBuffer).fill(0)

		// const goal = { x: Math.round(SIDE / 2), y: Math.round(SIDE / 2) }
		const goal = { x: 15, y: 5 }

		const workers = Array.from({ length: workerCount }, () => new FieldWorker())
		function postFieldWorker<I extends FieldIncoming["type"]>(
			worker: Worker,
			type: I,
			data: Extract<FieldIncoming, { type: I }>["data"],
			transfer?: Transferable[]
		) {
			worker.postMessage({ type, data }, { transfer })
		}

		for (let wy = 0; wy < workersPerRow; wy++) {
			for (let wx = 0; wx < workersPerRow; wx++) {
				const worker = workers[wy * workersPerRow + wx]
				const x1 = workerSide * wx
				const x2 = workerSide * (wx + 1) - 1
				const y1 = workerSide * wy
				const y2 = workerSide * (wy + 1) - 1
				postFieldWorker(worker, 'init', {
					field: fieldBuffer,
					grid: gridBuffer,
					integration: integrationBuffer,
					side: SIDE,
					range: [x1, x2, y1, y2],
					index: wy * workersPerRow + wx,
					wx,
					wy
				})
			}
		}

		const getWorker = (x: number, y: number) => workers[Math.floor(y / workerSide) * workersPerRow + Math.floor(x / workerSide)]
		postFieldWorker(getWorker(goal.x, goal.y), 'query', goal)

		let lastTime = 0
		let rafId = requestAnimationFrame(function loop(time) {
			rafId = requestAnimationFrame(loop)

			const prev = lastTime
			const dt = time - lastTime
			lastTime = time
			if (!prev) return

			ctx.clearRect(0, 0, side, side)
			const colorMaxInt = Math.min(maxIntegration, SIDE * SIDE / 2)

			const goalWorkerX = Math.floor(goal.x / workerSide)
			const goalWorkerY = Math.floor(goal.y / workerSide)
			const withinWorkerX = goal.x - goalWorkerX * workerSide
			const withinWorkerY = goal.y - goalWorkerY * workerSide
			const offset = (withinWorkerY * workerSide + withinWorkerX) * layerLength

			const goalField = new Uint8Array(fieldBuffer, offset, layerLength)
			const goalIntegration = new Uint8Array(integrationBuffer, offset, layerLength)

			for (let y = 0; y < SIDE; y++) {
				const row = y * SIDE
				const wy = Math.floor(y / workerSide)
				for (let x = 0; x < SIDE; x++) {
					const index = row + x
					const wx = Math.floor(x / workerSide)
					const isInGoalWorkerCell = wx === goalWorkerX && wy === goalWorkerY

					// draw background (cell cost)
					if (isInGoalWorkerCell) {
						const cost = grid[index]
						const int = goalIntegration[index] / colorMaxInt * 360
						ctx.fillStyle = `hsl(${int}, 50%, ${cost / maxCost * 50 + 50}%)`
						ctx.fillRect(x * px, y * px, px, px)
					} else {
						const cost = grid[index]
						const int = colorMaxInt
						ctx.fillStyle = `hsl(${int}, 50%, ${cost / maxCost * 50 + 50}%)`
						ctx.fillRect(x * px, y * px, px, px)
					}

					// draw direction (flow field)
					if (isInGoalWorkerCell) {
						ctx.strokeStyle = 'black'
						ctx.fillStyle = 'black'
						const [dx, dy] = readField(goalField, x, y)
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

		function readField(array: Uint8Array, x: number, y: number) {
			const index = y * SIDE + x
			const value = array[index]
			return reverseFieldMap[value]
		}

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
			const next = down ? maxCost : 0
			const prev = grid[index]
			if (prev !== undefined && prev !== next) {
				grid[index] = next
				postFieldWorker(getWorker(x, y), 'clear', undefined)
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
					postFieldWorker(getWorker(x, y), 'clear', undefined)
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
			postFieldWorker(getWorker(x, y), 'query', goal)
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
