import type { RouteMeta } from "#router"
import styles from './styles.module.css'
import { Head } from "#components/Head"
import { useEffect, useRef } from "react"
import FieldWorker from './field.worker?worker'
import type { Incoming as FieldIncoming } from './field.worker'
import { fieldMap, ratioFieldMap } from "./utils"
import GraphWorker from "./fragmented-a-star.worker?worker"
import type {
	Incoming as GraphIncoming,
	Outgoing as GraphOutgoing,
	SerializedGraph,
	SerializedPath,
} from "./fragmented-a-star.worker"

export const meta: RouteMeta = {
	title: 'Swarm Pathfinding',
	image: './screen.png',
	tags: ['pathfinding', 'performance']
}

const SIDE = 200
const workersPerRow = 10

if (SIDE % workersPerRow !== 0) {
	throw new Error(`SIDE must be divisible by workersPerRow, maybe try SIDE=${SIDE - (SIDE % workersPerRow)}, workersPerRow=${workersPerRow}`)
}

export default function SwarmPathfindingPage() {
	const ref = useRef<HTMLCanvasElement | null>(null)
	const formRef = useRef<HTMLFormElement | null>(null)

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

		const form = formRef.current
		if (!form) return

		const controller = new AbortController()

		const workerCount = workersPerRow ** 2
		const workerSide = SIDE / workersPerRow
		const layers = workerSide * workerSide

		const GridType = Uint8Array
		const gridBuffer = new SharedArrayBuffer(length * GridType.BYTES_PER_ELEMENT)
		const maxCost = 2 ** (GridType.BYTES_PER_ELEMENT * 8) - 1
		const grid = new GridType(gridBuffer).fill(0)

		const FieldType = Uint8Array
		const fieldBuffer = new SharedArrayBuffer(length * FieldType.BYTES_PER_ELEMENT * layers)
		new FieldType(fieldBuffer).fill(fieldMap[0][0])

		{
			// random obstacles
			const count = Math.random() * SIDE * 1 + SIDE * 1
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

		const options = {
			geometry: true
		}
		const onForm = () => {
			options.geometry = 'geometry' in form.elements && form.elements.geometry instanceof HTMLInputElement ? form.elements.geometry.checked : false
		}
		form.addEventListener('input', onForm)
		onForm()

		const pathFinding = createGraphWorkerCacheLayer({
			grid,
			maxCost,
			SIDE,
			workerSide,
			workersPerRow,
		})

		const workers: Array<ReturnType<typeof createFieldWorkerCacheLayer>> = []

		for (let wy = 0; wy < workersPerRow; wy++) {
			for (let wx = 0; wx < workersPerRow; wx++) {
				const offset = (wy * workersPerRow + wx) * layers * layers
				const worker = createFieldWorkerCacheLayer({
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

		// computeGraph()
		// pathFinding(path, from, goal)

		const entities: ReturnType<typeof makeEntity>[] = []
		for (let i = 0; i < 10000; i++) {
			let x: number
			let y: number
			do {
				x = Math.floor(Math.random() * SIDE)
				y = Math.floor(Math.random() * SIDE)
			} while (grid[y * SIDE + x] === maxCost)
			const entity = makeEntity(x, y, {
				SIDE,
				getWorker,
				grid,
				maxCost,
				pathFinding,
				px,
				side,
				workerSide,
				pointerLength,
				options,
			})
			entities.push(entity)
		}



		let lastTime = 0
		let rafId = requestAnimationFrame(function loop(time: number) {
			rafId = requestAnimationFrame(loop)

			const prev = lastTime
			const dt = Math.min(30, time - lastTime)
			lastTime = time
			if (!prev || !ctx) return


			if (options.geometry) {
				entities[0].update(dt)
			} else {
				for (const entity of entities) {
					entity.update(dt)
				}
			}

			ctx.clearRect(0, 0, side, side)

			if (options.geometry) {
				// draw graph islands
				const graph = pathFinding.getGraph()
				if (graph) {
					for (let y = 0; y < workersPerRow; y++) {
						for (let x = 0; x < workersPerRow; x++) {
							// draw sections (workers)
							ctx.strokeStyle = 'purple'
							ctx.lineWidth = 4 * devicePixelRatio
							ctx.strokeRect(x * workerSide * px, y * workerSide * px, workerSide * px, workerSide * px)
							ctx.lineWidth = 1
							const nodeIndex = y * workersPerRow + x
							const node = graph[nodeIndex]
							const islands = node.islands
							for (let i = 0; i < node.islands.length; i++) {
								const island = islands[i]
								const hue = 360 / node.islands.length * i
								ctx.fillStyle = `oklch(50% 50% ${hue})`
								for (const tile of island.tiles) {
									const ty = Math.floor(tile / SIDE)
									const tx = tile % SIDE
									ctx.fillRect(tx * px, ty * px, px, px)
								}
							}
						}
					}
				}
			} else {
				for (let y = 0; y < SIDE; y++) {
					const row = y * SIDE
					for (let x = 0; x < SIDE; x++) {
						const index = row + x
						const cost = grid[index]
						if (cost === maxCost) {
							ctx.fillStyle = 'white'
							ctx.fillRect(x * px + px / 4, y * px + px / 4, px / 2, px / 2)
						}
					}
				}
			}

			if (options.geometry) {
				entities[0].draw(ctx)
			} else {
				for (const entity of entities) {
					entity.draw(ctx)
				}
			}

			// // draw flow field
			// const worker = getWorker(goal.x, goal.y)
			// const goalField = worker?.read([[goal.x, goal.y]])
			// if (goalField && worker) {
			// 	for (let y = worker.wy * workerSide, localY = 0; y < (worker.wy + 1) * workerSide; y++, localY++) {
			// 		for (let x = worker.wx * workerSide, localX = 0; x < (worker.wx + 1) * workerSide; x++, localX++) {
			// 			ctx.strokeStyle = 'white'
			// 			ctx.fillStyle = 'white'
			// 			const [dx, dy] = reverseFieldMap[goalField[localY * workerSide + localX]]
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
			// 	}
			// }

			// // draw path
			// if (path.length > 1) {
			// 	ctx.strokeStyle = 'blue'
			// 	ctx.lineWidth = 2 * devicePixelRatio
			// 	ctx.beginPath()
			// 	ctx.lineTo(from.x * px + px / 2, from.y * px + px / 2)
			// 	for (let i = 0; i < path.length; i++) {
			// 		const island = path[i]
			// 		const [sumX, sumY] = Array.from(island.tiles.keys()).reduce<[x: number, y: number]>((acc, tile) => {
			// 			acc[0] += tile % SIDE
			// 			acc[1] += Math.floor(tile / SIDE)
			// 			return acc
			// 		}, [0, 0])
			// 		const avgX = sumX / island.tiles.size
			// 		const avgY = sumY / island.tiles.size
			// 		const x = avgX * px
			// 		const y = avgY * px

			// 		ctx.lineTo(x, y)
			// 	}
			// 	ctx.lineTo(goal.x * px + px / 2, goal.y * px + px / 2)
			// 	ctx.stroke()
			// 	ctx.lineWidth = 1
			// }

			// // draw from
			// ctx.fillStyle = 'green'
			// ctx.beginPath()
			// ctx.arc(from.x * px + px / 2, from.y * px + px / 2, px / 4, 0, Math.PI * 2)
			// ctx.fill()

			// // draw goal
			// ctx.fillStyle = 'red'
			// ctx.beginPath()
			// ctx.arc(goal.x * px + px / 2, goal.y * px + px / 2, px / 4, 0, Math.PI * 2)
			// ctx.fill()
		})

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
				pathFinding.graph()
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
					pathFinding.graph()
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
			// pathFinding(path, from, goal)
		}, { signal: controller.signal })

		canvas.addEventListener('pointermove', (e) => {
			const { x, y } = eventToPosition(e)
			if (x === goal.x && y === goal.y) return
			if (grid[y * SIDE + x] === maxCost) return
			goal.x = x
			goal.y = y
			// getWorker(x, y)?.query([[goal.x, goal.y]])
			// pathFinding(path, from, goal)
		}, { signal: controller.signal })

		return () => {
			cancelAnimationFrame(rafId)
			controller.abort()
			workers.forEach(worker => worker.kill())
			pathFinding.kill()
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
			<form ref={formRef}>
				<fieldset>
					<legend>options</legend>
					<label>
						<input type="checkbox" name="geometry" />
						show geometry
					</label>
				</fieldset>
			</form>
		</div>
	)
}

function createGraphWorkerCacheLayer(init: {
	grid: Uint8Array<SharedArrayBuffer>,
	maxCost: number,
	SIDE: number,
	workerSide: number,
	workersPerRow: number,
}) {
	const worker = new GraphWorker()
	const cache = new Map<string, SerializedPath | 'pending' | 'not-found'>()
	let latestGraph: SerializedGraph | undefined

	function postGraphWorker<I extends GraphIncoming["type"]>(
		type: I,
		data: Extract<GraphIncoming, { type: I }>["data"],
		transfer?: Transferable[]
	) {
		worker.postMessage({ type, data }, { transfer })
	}

	worker.addEventListener('message', (e: MessageEvent<GraphOutgoing>) => {
		if (e.data.type === 'response') {
			const { from, goal, path } = e.data.data
			const key = toKey(from, goal)
			if (cache.has(key)) {
				cache.set(key, path || 'not-found')
			}
		} else if (e.data.type === 'graph') {
			const { graph } = e.data.data
			latestGraph = graph
		}
	})

	postGraphWorker('init', {
		grid: init.grid.buffer,
		maxCost: init.maxCost,
		SIDE: init.SIDE,
		workerSide: init.workerSide,
		workersPerRow: init.workersPerRow,
	})

	function toKey(from: { x: number, y: number }, goal: { x: number, y: number }) {
		return `${from.x},${from.y},${goal.x},${goal.y}`
	}

	function kill() {
		worker.terminate()
	}

	function graph() {
		postGraphWorker('graph', undefined)
		cache.clear()
		latestGraph = undefined
	}
	graph()

	function query(from: { x: number, y: number }, goal: { x: number, y: number }) {
		const key = toKey(from, goal)
		const value = cache.get(key)
		if (value) return value

		cache.set(key, 'pending')
		postGraphWorker('query', { from, goal })
		return 'pending'
	}

	function getGraph() {
		if (latestGraph) return latestGraph
		postGraphWorker('request-graph', undefined)
	}

	return {
		kill,
		graph,
		query,
		getGraph,
	}
}

function createFieldWorkerCacheLayer(
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
		const all = new Uint8Array(init.fieldBuffer, init.offset, layers * maxSize)
		all.fill(fieldMap[0][0])
		postFieldWorker(worker, 'clear', undefined)
	}

	function query(goals: Goal[]) {
		const key = toKey(goals)
		const index = map.get(key)

		// from cache
		if (index !== undefined) {
			return
		}

		// evict and replace
		if (map.size === maxSize) {
			const oldKey = keys.shift()!
			const index = map.get(oldKey)!
			map.delete(oldKey)
			map.set(key, index)
			keys.push(key)
			const offset = init.offset + index * layers
			const layer = new Uint8Array(init.fieldBuffer, offset * Uint8Array.BYTES_PER_ELEMENT, layers)
			layer.fill(fieldMap[0][0])
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

	function kill() {
		worker.terminate()
	}

	return {
		query,
		read,
		clear,
		kill,
		wx: init.wx,
		wy: init.wy,
	}
}

function makeEntity(x: number, y: number, init: {
	SIDE: number
	workerSide: number
	side: number
	px: number
	grid: Uint8Array
	maxCost: number
	getWorker: (x: number, y: number) => ReturnType<typeof createFieldWorkerCacheLayer> | undefined,
	pathFinding: ReturnType<typeof createGraphWorkerCacheLayer>
	pointerLength: number
	options: {
		geometry: boolean
	}
}) {
	// in pixels
	const position = { x: x * init.px + init.px / 2, y: y * init.px + init.px / 2 }
	// in tiles
	const goal = { x, y }
	// in tiles
	const start = { x, y }

	const speed = 0.2

	function pxToTile(px: number) {
		return Math.max(Math.min(Math.floor(px / init.px), init.SIDE - 1), 0)
	}

	function newGoal() {
		do {
			goal.x = Math.floor(Math.random() * init.SIDE)
			goal.y = Math.floor(Math.random() * init.SIDE)
		} while (init.grid[goal.y * init.SIDE + goal.x] === init.maxCost)
		start.x = pxToTile(position.x)
		start.y = pxToTile(position.y)
		latestPath = undefined
		latestField = undefined
		latestWorker = undefined
	}

	let latestField: Uint8Array<SharedArrayBuffer> | undefined
	let latestWorker: ReturnType<typeof createFieldWorkerCacheLayer> | undefined
	let latestPath: SerializedPath | undefined

	newGoal()

	let paused = 0

	function update(dt: number) {
		if (paused) {
			paused -= dt
			if (paused > 0) return
			paused = 0
			newGoal()
			return
		}

		const x = pxToTile(position.x)
		const y = pxToTile(position.y)
		const currentTileIndex = y * init.SIDE + x
		if (init.grid[currentTileIndex] === init.maxCost) {
			const x = position.x / init.px
			const y = position.y / init.px
			const right = x % 1
			const left = 1 - right
			const bottom = y % 1
			const top = 1 - bottom
			const max = Math.max(right, left, bottom, top)
			if (max === right) {
				position.x += (left + 1) * speed * dt
			} else if (max === left) {
				position.x -= (right + 1) * speed * dt
			} else if (max === bottom) {
				position.y += (top + 1) * speed * dt
			} else {
				position.y -= (bottom + 1) * speed * dt
			}
			return
		}

		const isOnGoalTile = x === goal.x && y === goal.y
		if (isOnGoalTile) {
			paused = 1000
			return
		}

		const currentWorker = init.getWorker(x, y)
		if (!currentWorker) {
			throw new Error(`Worker not found at ${x}, ${y}`)
		}

		let path = init.pathFinding.query(start, goal)
		if (path === 'pending') {
			if (latestPath) {
				path = latestPath
			} else {
				return
			}
		}
		if (path === 'not-found') {
			newGoal()
			return
		}
		latestPath = path
		const currentIslandIndex = path.findIndex(island => island.wx === currentWorker.wx && island.wy === currentWorker.wy && island.tiles.includes(currentTileIndex))
		if (currentIslandIndex === -1) {
			newGoal()
			return
		}

		const isOnGoalIsland = currentIslandIndex === path.length - 1
		if (isOnGoalIsland) {
			const workerKey = [[goal.x, goal.y]] as [number, number][]
			currentWorker.query(workerKey)
			const field = currentWorker.read(workerKey)
			latestField = field
			latestWorker = currentWorker
			if (field) {
				const localX = x % init.workerSide
				const localY = y % init.workerSide
				const index = localY * init.workerSide + localX
				const [dx, dy] = ratioFieldMap[field[index]]
				const mul = speed * dt
				position.x += dx * mul
				position.y += dy * mul
			}
			return
		}

		const currentIsland = path[currentIslandIndex]!
		const nextIsland = path[currentIslandIndex + 1]
		if (!nextIsland) {
			throw new Error(`No next island found`)
		}

		if (currentIsland.crossings.includes(currentTileIndex)) {
			const [dx, dy] = ratioFieldMap[fieldMap[nextIsland.wx - currentIsland.wx][nextIsland.wy - currentIsland.wy]]
			const mul = speed * dt
			position.x += dx * mul
			position.y += dy * mul
			return
		}

		const workerKey = [] as [number, number][]
		for (const tile of currentIsland.crossings) {
			const ty = Math.floor(tile / init.SIDE)
			const tx = tile % init.SIDE
			workerKey.push([tx, ty])
		}
		currentWorker.query(workerKey)
		const field = currentWorker.read(workerKey)
		latestField = field
		latestWorker = currentWorker
		if (field) {
			const localX = x % init.workerSide
			const localY = y % init.workerSide
			const index = localY * init.workerSide + localX
			const [dx, dy] = ratioFieldMap[field[index]]
			const mul = speed * dt
			position.x += dx * mul
			position.y += dy * mul
		}
	}

	function draw(ctx: CanvasRenderingContext2D) {
		if (init.options.geometry) {
			const { px, pointerLength, workerSide } = init

			// draw path
			let path = init.pathFinding.query(start, goal)
			if (path === 'pending' && latestPath) {
				path = latestPath
			}
			if (typeof path !== 'string' && path.length > 1) {
				ctx.strokeStyle = 'blue'
				ctx.lineWidth = 2 * devicePixelRatio
				ctx.beginPath()
				// ctx.lineTo(start.x * px + px / 2, start.y * px + px / 2)
				for (let i = 0; i < path.length; i++) {
					const island = path[i]
					const [sumX, sumY] = island.tiles.reduce<[x: number, y: number]>((acc, tile) => {
						acc[0] += tile % SIDE
						acc[1] += Math.floor(tile / SIDE)
						return acc
					}, [0, 0])
					const avgX = sumX / island.tiles.length
					const avgY = sumY / island.tiles.length
					const x = avgX * px
					const y = avgY * px

					ctx.lineTo(x, y)
				}
				// ctx.lineTo(goal.x * px + px / 2, goal.y * px + px / 2)
				ctx.stroke()
				ctx.lineWidth = 1
			}

			// draw flow field
			const worker = latestWorker
			const field = latestField
			if (field && worker) {
				for (let y = worker.wy * workerSide, localY = 0; y < (worker.wy + 1) * workerSide; y++, localY++) {
					for (let x = worker.wx * workerSide, localX = 0; x < (worker.wx + 1) * workerSide; x++, localX++) {
						ctx.strokeStyle = 'white'
						ctx.fillStyle = 'white'
						const [dx, dy] = ratioFieldMap[field[localY * workerSide + localX]]
						if (dx === 0 && dy === 0) {
							ctx.beginPath()
							ctx.arc(x * px + px / 2, y * px + px / 2, pointerLength / 4, 0, Math.PI * 2)
							ctx.fill()
						} else {
							const length = pointerLength / 2
							const centerX = x * px + px / 2
							const centerY = y * px + px / 2
							const endX = centerX + dx * length
							const endY = centerY + dy * length
							const startX = centerX - dx * length
							const startY = centerY - dy * length
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
			}

			ctx.fillStyle = 'blue'
			ctx.beginPath()
			ctx.arc(start.x * init.px + init.px / 2, start.y * init.px + init.px / 2, init.px / 4, 0, Math.PI * 2)
			ctx.fill()

			ctx.fillStyle = 'red'
			ctx.beginPath()
			ctx.arc(goal.x * init.px + init.px / 2, goal.y * init.px + init.px / 2, init.px / 4, 0, Math.PI * 2)
			ctx.fill()
		}

		ctx.fillStyle = 'green'
		ctx.beginPath()
		ctx.arc(position.x, position.y, init.px / 2, 0, Math.PI * 2)
		ctx.fill()
	}

	return {
		update,
		draw,
	}
}