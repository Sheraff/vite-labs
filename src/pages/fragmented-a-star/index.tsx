import type { RouteMeta } from "~/router"
import styles from './styles.module.css'
import { Head } from "~/components/Head"
import { useEffect, useRef } from "react"

export const meta: RouteMeta = {
	title: '[WIP] Fragmented A*',
}

const SIDE = 64
const workersPerRow = 4

if (SIDE % workersPerRow !== 0) {
	throw new Error(`SIDE must be divisible by workersPerRow, maybe try SIDE=${SIDE - (SIDE % workersPerRow)}, workersPerRow=${workersPerRow}`)
}

export default function FragmentedAStar() {
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

		const GridType = Uint8Array
		const gridBuffer = new ArrayBuffer(length * GridType.BYTES_PER_ELEMENT)
		const maxCost = 2 ** (GridType.BYTES_PER_ELEMENT * 8) - 1
		const grid = new GridType(gridBuffer).fill(0)

		const goal = { x: Math.round(SIDE * 1 / 8), y: Math.round(SIDE * 1 / 8) }
		const from = { x: Math.round(SIDE * 7 / 8), y: Math.round(SIDE * 7 / 8) }

		const graph: Array<Set<{ tiles: Set<number>, crossings: Set<number>[] }>> = []
		const path: number[] = []

		let lastTime = 0
		let rafId = requestAnimationFrame(function loop(time) {
			rafId = requestAnimationFrame(loop)

			const prev = lastTime
			const dt = time - lastTime
			lastTime = time
			if (!prev) return

			ctx.clearRect(0, 0, side, side)

			// for (let y = 0; y < SIDE; y++) {
			// 	const row = y * SIDE
			// 	for (let x = 0; x < SIDE; x++) {
			// 		const index = row + x

			// 		const cost = grid[index]
			// 		if (cost === maxCost) {
			// 			ctx.fillStyle = `hsl(120, 0%, 90%)`
			// 			ctx.fillRect(x * px, y * px, px, px)
			// 		}

			// 		// draw walls (grid)
			// 		ctx.strokeStyle = 'white'
			// 		ctx.strokeRect(x * px, y * px, px, px)
			// 	}
			// }
			for (let y = 0; y < workersPerRow; y++) {
				for (let x = 0; x < workersPerRow; x++) {
					// draw sections (workers)
					ctx.strokeStyle = 'purple'
					ctx.lineWidth = 4 * devicePixelRatio
					ctx.strokeRect(x * workerSide * px, y * workerSide * px, workerSide * px, workerSide * px)
					ctx.lineWidth = 1

					const node = graph[y * workersPerRow + x]
					const islands = node.values()
					for (let i = 0; i < node.size; i++) {
						const island = islands.next().value!
						const hue = 360 / node.size * i
						ctx.fillStyle = `oklch(50% 50% ${hue})`
						for (const tile of island.tiles) {
							const ty = Math.floor(tile / SIDE)
							const tx = tile % SIDE
							ctx.fillRect(tx * px, ty * px, px, px)
						}
					}
				}
			}

			// draw path
			if (path.length > 1) {
				ctx.strokeStyle = 'blue'
				ctx.lineWidth = 2 * devicePixelRatio
				ctx.beginPath()
				ctx.moveTo(goal.x * px + px / 2, goal.y * px + px / 2)
				for (let i = 0; i < path.length; i++) {
					const x = path[i] % SIDE
					const y = (path[i] - x) / SIDE
					ctx.lineTo(x * px + px / 2, y * px + px / 2)
				}
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

		/**
		 * For each section (worker),
		 * - find all islands of connected tiles (flood fill)
		 * - for each island, find all open boundaries
		 *   - tile of an island that is on an edge of the worker section
		 *   - not a wall
		 *   - neighboring tile (other worker section) is not a wall
		 *   - all adjacent tiles that are open boundaries to the same neighboring worker section are considered the same boundary
		 * 
		 * Store boundaries and islands in a way that allows for A* to be run on them
		 */
		function computeGraph() {
			let workerIndex = 0
			for (let wy = 0; wy < workersPerRow; wy++) {
				const y1 = wy * workerSide
				const y2 = y1 + workerSide - 1
				for (let wx = 0; wx < workersPerRow; wx++) {
					const x1 = wx * workerSide
					const x2 = x1 + workerSide - 1

					const seen = new Set<number>()
					const workerIslands = new Set<{ tiles: Set<number>, crossings: Set<number>[] }>()
					for (let y = y1; y <= y2; y++) {
						const row = y * SIDE
						for (let x = x1; x <= x2; x++) {
							const index = row + x
							if (seen.has(index)) continue
							if (grid[index] === maxCost) continue
							const island = new Set([index])
							const crossings: [
								north: Set<number>,
								east: Set<number>,
								south: Set<number>,
								west: Set<number>,
							] = [
									new Set(),
									new Set(),
									new Set(),
									new Set(),
								]
							workerIslands.add({
								tiles: island,
								crossings,
							})
							const queue = [x, y, index]
							seen.add(index)
							while (queue.length) {
								const x = queue.shift()!
								const y = queue.shift()!
								const index = queue.shift()!
								north: {
									const i = (y - 1) * SIDE + x
									if (y === y1) {
										if (y > 0 && grid[i] !== maxCost) crossings[0].add(index)
										break north
									}
									if (!seen.has(i) && grid[i] !== maxCost) {
										seen.add(i)
										queue.push(x, y - 1, i)
										island.add(i)
									}
								}
								south: {
									const i = (y + 1) * SIDE + x
									if (y === y2) {
										if (y < SIDE - 1 && grid[i] !== maxCost) crossings[2].add(index)
										break south
									}
									if (!seen.has(i) && grid[i] !== maxCost) {
										seen.add(i)
										queue.push(x, y + 1, i)
										island.add(i)
									}
								}
								west: {
									const i = y * SIDE + (x - 1)
									if (x === x1) {
										if (x > 0 && grid[i] !== maxCost) crossings[3].add(index)
										break west
									}
									if (!seen.has(i) && grid[i] !== maxCost) {
										seen.add(i)
										queue.push(x - 1, y, i)
										island.add(i)
									}
								}
								east: {
									const i = y * SIDE + (x + 1)
									if (x === x2) {
										if (x < SIDE - 1 && grid[i] !== maxCost) crossings[1].add(index)
										break east
									}
									if (!seen.has(i) && grid[i] !== maxCost) {
										seen.add(i)
										queue.push(x + 1, y, i)
										island.add(i)
									}
								}
							}
						}
					}
					graph[workerIndex] = workerIslands
					workerIndex++
				}
			}
		}
		computeGraph()

		function pathFinding() {
			function h(index: number) {
				const x = index % SIDE
				const y = (index - x) / SIDE
				return Math.hypot(x - goal.x, y - goal.y)
			}
			function findIsland<T extends { tiles: Set<number> }>(node: Set<T>, index: number) {
				for (const island of node) {
					if (island.tiles.has(index))
						return island
				}
				throw new Error('island not found')
			}
			function setPath(cameFrom: Map<number, number>, current: number) {
				path.length = 0
				let c = current
				while (cameFrom.has(c)) {
					path.push(c)
					c = cameFrom.get(c)!
				}
				path.push(c)
			}

			const goalIndex = goal.y * SIDE + goal.x
			const workerGoalIndex = Math.floor(goal.x / workerSide) + Math.floor(goal.y / workerSide) * workersPerRow
			const goalIsland = findIsland(graph[workerGoalIndex], goalIndex)
			const start = from.y * SIDE + from.x
			const openSet = new Set([start])
			const cameFrom = new Map<number, number>()
			const gScore = new Map<number, number>()
			gScore.set(start, 0)
			const fScore = new Map<number, number>()
			fScore.set(start, h(start))

			let lowestFScore = start
			let counter = 0
			while (openSet.size) {
				if (++counter > 5000) {
					path.length = 0
					return
				}
				const current = openSet.has(lowestFScore) ? lowestFScore : Array.from(openSet).reduce((min, cell) => {
					if (!min || !fScore.has(min) || !fScore.get(cell))
						return cell
					if (fScore.get(min)! < fScore.get(cell)!)
						return min
					return cell
				}, null!)
				lowestFScore = current

				const x = current % SIDE
				const y = (current - x) / SIDE
				const workerX = Math.floor(x / workerSide)
				const workerY = Math.floor(y / workerSide)
				const workerIndex = workerY * workersPerRow + workerX
				const node = graph[workerIndex]
				const island = findIsland(node, current)

				if (island === goalIsland) {
					setPath(cameFrom, current)
					return
				}

				openSet.delete(current)

				for (let direction = 0; direction < 4; direction++) {
					const crossings = island.crossings[direction]
					for (const crossing of crossings) {
						const cx = crossing % SIDE
						const cy = (crossing - cx) / SIDE
						const toCrossing = Math.hypot(cx - x, cy - y)
						const tentativeGScore = gScore.get(current)! + toCrossing + 1
						let neighbor: number
						if (direction === 0) { // top
							neighbor = crossing - SIDE
						} else if (direction === 1) { // right
							neighbor = crossing + 1
						} else if (direction === 2) { // bottom
							neighbor = crossing + SIDE
						} else { // left
							neighbor = crossing - 1
						}

						if (!gScore.has(neighbor))
							gScore.set(neighbor, Infinity)

						if (tentativeGScore < gScore.get(neighbor)!) {
							cameFrom.set(neighbor, current)

							gScore.set(neighbor, tentativeGScore)
							const newFScore = gScore.get(neighbor)! + h(neighbor)
							fScore.set(neighbor, newFScore)

							if (newFScore < fScore.get(lowestFScore)!)
								lowestFScore = neighbor

							if (!openSet.has(neighbor) && newFScore < Infinity)
								openSet.add(neighbor)
						}
					}
				}
			}
		}
		pathFinding()

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
			pathFinding()
		}, { signal: controller.signal })

		canvas.addEventListener('pointermove', (e) => {
			const { x, y } = eventToPosition(e)
			if (x === goal.x && y === goal.y) return
			if (grid[y * SIDE + x] === maxCost) return
			goal.x = x
			goal.y = y
			pathFinding()
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