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

		const GridType = Uint8Array
		const gridBuffer = new SharedArrayBuffer(length * GridType.BYTES_PER_ELEMENT)
		const maxCost = 2 ** (GridType.BYTES_PER_ELEMENT * 8) - 1
		const grid = new GridType(gridBuffer).fill(0)

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

		const goal = { x: 1, y: 1 }
		const from = { x: 0, y: 0 }
		do {
			from.x = Math.floor(Math.random() * SIDE)
			from.y = Math.floor(Math.random() * SIDE)
		} while (grid[from.y * SIDE + from.x] === maxCost)

		const workers: Array<ReturnType<typeof createWorkerCacheLayer>> = []

		for (let wy = 0; wy < workersPerRow; wy++) {
			for (let wx = 0; wx < workersPerRow; wx++) {
				const offset = (wy * workersPerRow + wx) * layers * layers
				const worker = createWorkerCacheLayer({
					workerSide,
					wx,
					wy,
					fieldBuffer,
					gridBuffer,
					offset,
				}, layers, layers)
				workers.push(worker)
			}
		}

		const getWorker = (x: number, y: number) => {
			if (x < 0 || x >= SIDE || y < 0 || y >= SIDE) return
			const wy = Math.floor(y / workerSide)
			const wx = Math.floor(x / workerSide)
			const index = wy * workersPerRow + wx
			return workers[index]
		}

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
			const worker = getWorker(goal.x, goal.y)
			const goalField = worker?.read([[goal.x, goal.y]])

			if (goalField && worker)
				for (let y = worker.wy * workerSide, localY = 0; y < (worker.wy + 1) * workerSide; y++, localY++) {
					const row = y * SIDE
					for (let x = worker.wx * workerSide, localX = 0; x < (worker.wx + 1) * workerSide; x++, localX++) {
						const index = row + x

						const cost = grid[index]
						ctx.fillStyle = `hsl(120, 50%, ${cost / maxCost * 50 + 50}%)`
						ctx.fillRect(x * px, y * px, px, px)

						ctx.strokeStyle = 'black'
						ctx.fillStyle = 'black'
						const [dx, dy] = reverseFieldMap[goalField[localY * workerSide + localX]]
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

		const controller = new AbortController()

		const eventToPosition = (e: PointerEvent | MouseEvent) => {
			const { left, top } = canvas.getBoundingClientRect()
			const x = Math.max(Math.min(Math.floor((e.clientX - left) / base * SIDE), SIDE - 1), 0)
			const y = Math.max(Math.min(Math.floor((e.clientY - top) / base * SIDE), SIDE - 1), 0)
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
				getWorker(x, y)?.clear()
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
					getWorker(x, y)?.clear()
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
			getWorker(x, y)?.query([[goal.x, goal.y]])
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

function createWorkerCacheLayer(
	init: {
		workerSide: number,
		wx: number,
		wy: number,
		fieldBuffer: SharedArrayBuffer,
		gridBuffer: SharedArrayBuffer,
		offset: number,
	},
	layers: number,
	maxSize: number
) {
	type Goal = [x: number, y: number]

	const keys: string[] = []
	const map = new Map<string, number>()

	const worker = new FieldWorker()

	const x1 = init.workerSide * init.wx
	const x2 = init.workerSide * (init.wx + 1) - 1
	const y1 = init.workerSide * init.wy
	const y2 = init.workerSide * (init.wy + 1) - 1
	postFieldWorker(worker, 'init', {
		field: init.fieldBuffer,
		grid: init.gridBuffer,
		side: SIDE,
		range: [x1, x2, y1, y2],
		index: init.wy * workersPerRow + init.wx,
		wx: init.wx,
		wy: init.wy
	})

	function postFieldWorker<I extends FieldIncoming["type"]>(
		worker: Worker,
		type: I,
		data: Extract<FieldIncoming, { type: I }>["data"],
		transfer?: Transferable[]
	) {
		worker.postMessage({ type, data }, { transfer })
	}

	function toKey(goals: Goal[]) {
		return goals.toString()
	}

	function clear() {
		map.clear()
		keys.length = 0
		postFieldWorker(worker, 'clear', undefined)
	}

	function query(goals: Goal[]) {
		const key = toKey(goals)
		const index = map.get(key)

		// from cache
		if (index !== undefined) {
			// postFieldWorker(worker, 'query', { goals, layer: index })
			return
		}

		// evict and replace
		if (map.size === maxSize) {
			const oldKey = keys.shift()!
			const index = map.get(oldKey)!
			map.delete(oldKey)
			map.set(key, index)
			keys.push(key)
			postFieldWorker(worker, 'query', { goals, layer: index })
			return
		}

		// add to cache
		{
			const index = map.size
			map.set(key, index)
			keys.push(key)
			postFieldWorker(worker, 'query', { goals, layer: index })
			return
		}
	}

	const { offset, fieldBuffer } = init
	const length = layers * Uint8Array.BYTES_PER_ELEMENT
	function read(goals: Goal[]) {
		const key = toKey(goals)
		const index = map.get(key)

		if (index === undefined) return

		const goalOffset = offset + index * layers
		const layer = new Uint8Array(fieldBuffer, goalOffset * Uint8Array.BYTES_PER_ELEMENT, length)
		return layer
	}

	return {
		query,
		read,
		clear,
		wx: init.wx,
		wy: init.wy,
	}
}