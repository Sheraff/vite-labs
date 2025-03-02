import type { RouteMeta } from "~/router"
import styles from './styles.module.css'
import { Head } from "~/components/Head"
import { useEffect, useRef } from "react"
import FieldWorker from './field.worker?worker'
import type { Incoming as FieldIncoming } from './field.worker'
import { reverseFieldMap } from "@flow-field/utils"
import { type Graph, type Path, createGraphContext } from "./fragmented-a-star"

export const meta: RouteMeta = {
	title: 'Flow Field',
	image: './screen.png'
}

const SIDE = 128
const workersPerRow = 16

if (SIDE % workersPerRow !== 0) {
	throw new Error(`SIDE must be divisible by workersPerRow, maybe try SIDE=${SIDE - (SIDE % workersPerRow)}, workersPerRow=${workersPerRow}`)
}

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

		const workerCount = workersPerRow ** 2
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

		{
			// random obstacles
			const count = Math.random() * SIDE / 2 + SIDE / 2
			for (let i = 0; i < count; i++) {
				const largeSide = Math.random() > 0.5
				const x1 = Math.floor(Math.random() * SIDE)
				const x2 = Math.floor(Math.random() * SIDE / (largeSide ? 30 : 8)) + x1
				const y1 = Math.floor(Math.random() * SIDE)
				const y2 = Math.floor(Math.random() * SIDE / (largeSide ? 8 : 30)) + y1
				for (let y = y1; y < y2; y++) {
					const row = y * SIDE
					for (let x = x1; x < x2; x++) {
						grid[row + x] = maxCost
					}
				}
			}
		}

		const goal = { x: 15, y: 5 }
		const from = { x: 0, y: 0 }
		do {
			from.x = Math.floor(Math.random() * SIDE)
			from.y = Math.floor(Math.random() * SIDE)
		} while (grid[from.y * SIDE + from.x] === maxCost)

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

		const graph: Graph = new Map()
		const path: Path = []

		const { computeGraph, pathFinding } = createGraphContext(
			workersPerRow,
			SIDE,
			workerSide,
			maxCost,
			grid,
			graph,
		)

		computeGraph()
		pathFinding(path, from, goal)

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

			// draw graph islands
			for (let y = 0; y < workersPerRow; y++) {
				for (let x = 0; x < workersPerRow; x++) {
					// draw sections (workers)
					ctx.strokeStyle = 'purple'
					ctx.lineWidth = 4 * devicePixelRatio
					ctx.strokeRect(x * workerSide * px, y * workerSide * px, workerSide * px, workerSide * px)
					ctx.lineWidth = 1

					const node = graph.get(y * workersPerRow + x)!
					const islands = node.islands.values()
					for (let i = 0; i < node.islands.size; i++) {
						const island = islands.next().value!
						const hue = 360 / node.islands.size * i
						ctx.fillStyle = `oklch(50% 50% ${hue})`
						for (const tile of island.tiles) {
							const ty = Math.floor(tile / SIDE)
							const tx = tile % SIDE
							ctx.fillRect(tx * px, ty * px, px, px)
						}
					}
				}
			}

			// draw flow field
			for (let y = goalWorkerY * workerSide; y < (goalWorkerY + 1) * workerSide; y++) {
				const row = y * SIDE
				for (let x = goalWorkerX * workerSide; x < (goalWorkerX + 1) * workerSide; x++) {
					const index = row + x

					const cost = grid[index]
					const int = goalIntegration[index] / colorMaxInt * 360
					ctx.fillStyle = `hsl(${int}, 50%, ${cost / maxCost * 50 + 50}%)`
					ctx.fillRect(x * px, y * px, px, px)

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
			}

			// for (let y = 0; y < SIDE; y++) {
			// 	const row = y * SIDE
			// 	const wy = Math.floor(y / workerSide)
			// 	for (let x = 0; x < SIDE; x++) {
			// 		const index = row + x
			// 		const wx = Math.floor(x / workerSide)
			// 		const isInGoalWorkerCell = wx === goalWorkerX && wy === goalWorkerY

			// 		// draw background (cell cost)
			// 		if (isInGoalWorkerCell) {
			// 			const cost = grid[index]
			// 			const int = goalIntegration[index] / colorMaxInt * 360
			// 			ctx.fillStyle = `hsl(${int}, 50%, ${cost / maxCost * 50 + 50}%)`
			// 			ctx.fillRect(x * px, y * px, px, px)
			// 		} else {
			// 			const cost = grid[index]
			// 			const int = colorMaxInt
			// 			ctx.fillStyle = `hsl(${int}, 50%, ${cost / maxCost * 50 + 50}%)`
			// 			ctx.fillRect(x * px, y * px, px, px)
			// 		}

			// 		// draw direction (flow field)
			// 		if (isInGoalWorkerCell) {
			// 			ctx.strokeStyle = 'black'
			// 			ctx.fillStyle = 'black'
			// 			const [dx, dy] = readField(goalField, x, y)
			// 			if (dx === 0 && dy === 0) {
			// 				ctx.beginPath()
			// 				ctx.arc(x * px + px / 2, y * px + px / 2, pointerLength / 4, 0, Math.PI * 2)
			// 				ctx.fill()
			// 			} else {
			// 				const angle = Math.atan2(dy, dx)
			// 				const length = pointerLength / 2
			// 				const centerX = x * px + px / 2
			// 				const centerY = y * px + px / 2
			// 				const xRatio = Math.cos(angle)
			// 				const yRatio = Math.sin(angle)
			// 				const endX = centerX + xRatio * length
			// 				const endY = centerY + yRatio * length
			// 				const startX = centerX - xRatio * length
			// 				const startY = centerY - yRatio * length
			// 				ctx.beginPath()
			// 				ctx.moveTo(startX, startY)
			// 				ctx.lineTo(endX, endY)
			// 				ctx.stroke()
			// 				ctx.beginPath()
			// 				ctx.arc(endX, endY, length / 2, 0, Math.PI * 2)
			// 				ctx.fill()
			// 			}
			// 		}

			// 		// // draw walls (grid)
			// 		// ctx.strokeStyle = 'white'
			// 		// ctx.strokeRect(x * px, y * px, px, px)

			// 	}
			// }

			// draw path
			if (path.length > 1) {
				ctx.strokeStyle = 'blue'
				ctx.lineWidth = 2 * devicePixelRatio
				ctx.beginPath()
				ctx.lineTo(from.x * px + px / 2, from.y * px + px / 2)
				for (let i = 0; i < path.length; i++) {
					const island = path[i]
					const [sumX, sumY] = Array.from(island.tiles.keys()).reduce<[x: number, y: number]>((acc, tile) => {
						acc[0] += tile % SIDE
						acc[1] += Math.floor(tile / SIDE)
						return acc
					}, [0, 0])
					const avgX = sumX / island.tiles.size
					const avgY = sumY / island.tiles.size
					const x = avgX * px
					const y = avgY * px

					ctx.lineTo(x, y)
				}
				ctx.lineTo(goal.x * px + px / 2, goal.y * px + px / 2)
				ctx.stroke()
				ctx.lineWidth = 1
			}

			// draw from
			ctx.fillStyle = 'green'
			ctx.beginPath()
			ctx.arc(from.x * px + px / 2, from.y * px + px / 2, px / 4, 0, Math.PI * 2)
			ctx.fill()

			// draw goal
			ctx.fillStyle = 'red'
			ctx.beginPath()
			ctx.arc(goal.x * px + px / 2, goal.y * px + px / 2, px / 4, 0, Math.PI * 2)
			ctx.fill()
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
				computeGraph()
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
					computeGraph()
				}
			}
			moved = false
		}, { signal: controller.signal })


		canvas.addEventListener('contextmenu', (e) => {
			e.preventDefault()
			down = false
			moved = false
			const { x, y } = eventToPosition(e)
			from.x = x
			from.y = y
			pathFinding(path, from, goal)
		}, { signal: controller.signal })

		canvas.addEventListener('pointermove', (e) => {
			const { x, y } = eventToPosition(e)
			if (x === goal.x && y === goal.y) return
			if (grid[y * SIDE + x] === maxCost) return
			goal.x = x
			goal.y = y
			postFieldWorker(getWorker(x, y), 'query', goal)
			pathFinding(path, from, goal)
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
