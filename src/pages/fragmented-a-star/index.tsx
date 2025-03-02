import type { RouteMeta } from "~/router"
import styles from './styles.module.css'
import { Head } from "~/components/Head"
import { useEffect, useRef } from "react"

export const meta: RouteMeta = {
	title: '[WIP] Fragmented A*',
}

const SIDE = 256
const workersPerRow = 16

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

		const graph: Map<number, { islands: Set<Island>, tiles: Map<number, Island> }> = new Map()
		const path: Island[] = []

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
			const before = performance.now()
			let workerIndex = 0
			for (let wy = 0; wy < workersPerRow; wy++) {
				const y1 = wy * workerSide
				const y2 = y1 + workerSide - 1
				for (let wx = 0; wx < workersPerRow; wx++) {
					const x1 = wx * workerSide
					const x2 = x1 + workerSide - 1

					const seen = new Set<number>()
					const workerIslands = new Set<Island>()
					const workerTiles = new Map<number, Island>()
					for (let y = y1; y <= y2; y++) {
						const row = y * SIDE
						for (let x = x1; x <= x2; x++) {
							const index = row + x
							if (seen.has(index)) continue
							if (grid[index] === maxCost) continue

							const islandTiles = new Set<number>()
							const northIndex = workerIndex - workersPerRow
							const eastIndex = workerIndex + 1
							const southIndex = workerIndex + workersPerRow
							const westIndex = workerIndex - 1
							const crossings: Map<Island, Set<number>> = new Map()
							const island: Island = {
								tiles: islandTiles,
								crossings,
								workerIndex,
								wx,
								wy,
							}
							workerTiles.set(index, island)
							islandTiles.add(index)
							workerIslands.add(island)
							const queue = [x, y, index]
							seen.add(index)
							while (queue.length) {
								const x = queue.shift()!
								const y = queue.shift()!
								const index = queue.shift()!
								north: {
									const i = (y - 1) * SIDE + x
									if (y === y1) {
										if (y > 0 && grid[i] !== maxCost) {
											const neighbor = graph.get(northIndex)?.tiles.get(i)
											if (neighbor) {
												const nCrossings = neighbor.crossings.get(island)
												if (nCrossings) {
													nCrossings.add(i)
												} else {
													neighbor.crossings.set(island, new Set([i]))
												}
												const iCrossings = crossings.get(neighbor)
												if (iCrossings) {
													iCrossings.add(index)
												} else {
													crossings.set(neighbor, new Set([index]))
												}
											}
										}
										break north
									}
									if (!seen.has(i) && grid[i] !== maxCost) {
										seen.add(i)
										queue.push(x, y - 1, i)
										workerTiles.set(i, island)
										islandTiles.add(i)
									}
								}
								south: {
									const i = (y + 1) * SIDE + x
									if (y === y2) {
										if (y < SIDE - 1 && grid[i] !== maxCost) {
											const neighbor = graph.get(southIndex)?.tiles.get(i)
											if (neighbor) {
												const nCrossings = neighbor.crossings.get(island)
												if (nCrossings) {
													nCrossings.add(i)
												} else {
													neighbor.crossings.set(island, new Set([i]))
												}
												const iCrossings = crossings.get(neighbor)
												if (iCrossings) {
													iCrossings.add(index)
												} else {
													crossings.set(neighbor, new Set([index]))
												}
											}
										}
										break south
									}
									if (!seen.has(i) && grid[i] !== maxCost) {
										seen.add(i)
										queue.push(x, y + 1, i)
										workerTiles.set(i, island)
										islandTiles.add(i)
									}
								}
								west: {
									const i = y * SIDE + (x - 1)
									if (x === x1) {
										if (x > 0 && grid[i] !== maxCost) {
											const neighbor = graph.get(westIndex)?.tiles.get(i)
											if (neighbor) {
												const nCrossings = neighbor.crossings.get(island)
												if (nCrossings) {
													nCrossings.add(i)
												} else {
													neighbor.crossings.set(island, new Set([i]))
												}
												const iCrossings = crossings.get(neighbor)
												if (iCrossings) {
													iCrossings.add(index)
												} else {
													crossings.set(neighbor, new Set([index]))
												}
											}
										}
										break west
									}
									if (!seen.has(i) && grid[i] !== maxCost) {
										seen.add(i)
										queue.push(x - 1, y, i)
										workerTiles.set(i, island)
										islandTiles.add(i)
									}
								}
								east: {
									const i = y * SIDE + (x + 1)
									if (x === x2) {
										if (x < SIDE - 1 && grid[i] !== maxCost) {
											const neighbor = graph.get(eastIndex)?.tiles.get(i)
											if (neighbor) {
												const nCrossings = neighbor.crossings.get(island)
												if (nCrossings) {
													nCrossings.add(i)
												} else {
													neighbor.crossings.set(island, new Set([i]))
												}
												const iCrossings = crossings.get(neighbor)
												if (iCrossings) {
													iCrossings.add(index)
												} else {
													crossings.set(neighbor, new Set([index]))
												}
											}
										}
										break east
									}
									if (!seen.has(i) && grid[i] !== maxCost) {
										seen.add(i)
										queue.push(x + 1, y, i)
										workerTiles.set(i, island)
										islandTiles.add(i)
									}
								}
							}
						}
					}
					graph.set(workerIndex, { islands: workerIslands, tiles: workerTiles })
					workerIndex++
				}
			}
			const after = performance.now()
			console.log(`computeGraph took ${after - before}ms`)
		}
		computeGraph()

		function pathFinding() {
			const before = performance.now()
			path.length = 0

			const goalIndex = goal.y * SIDE + goal.x
			const workerGoalIndex = Math.floor(goal.x / workerSide) + Math.floor(goal.y / workerSide) * workersPerRow
			const goalIsland = graph.get(workerGoalIndex)!.tiles.get(goalIndex)!

			const fromIndex = from.y * SIDE + from.x
			const workerFromIndex = Math.floor(from.x / workerSide) + Math.floor(from.y / workerSide) * workersPerRow
			const fromIsland = graph.get(workerFromIndex)!.tiles.get(fromIndex)!

			const done = () => {
				const after = performance.now()
				console.log(`pathFinding took ${(after - before).toFixed(2)}ms`)
			}

			if (goalIsland === fromIsland) {
				path.push(goalIsland)
				done()
				return
			} else if (!goalIsland || !fromIsland || goalIsland.crossings.size === 0 || fromIsland.crossings.size === 0) {
				done()
				return
			}

			function h(island: { wx: number, wy: number }) {
				return Math.hypot(island.wx - goalIsland.wx, island.wy - goalIsland.wy)
			}
			function setPath(cameFrom: Map<Island, Island>, current: Island) {
				let c = current
				while (cameFrom.has(c)) {
					path.push(c)
					c = cameFrom.get(c)!
				}
				path.push(c)
				path.reverse()
			}

			const start = fromIsland
			const openSet = new Set([start])
			const cameFrom = new Map<Island, Island>()
			const gScore = new Map<Island, number>()
			gScore.set(start, 0)
			const fScore = new Map<Island, number>()
			fScore.set(start, h(start))

			let lowestFScore = start
			let counter = 0
			while (openSet.size) {
				if (++counter > 5000) {
					break
				}
				const current = openSet.has(lowestFScore) ? lowestFScore : Array.from(openSet).reduce((min, cell) => {
					if (!min || !fScore.has(min) || !fScore.get(cell))
						return cell
					if (fScore.get(min)! < fScore.get(cell)!)
						return min
					return cell
				}, null!)
				lowestFScore = current

				if (current === goalIsland) {
					setPath(cameFrom, current)
					break
				}

				openSet.delete(current)

				for (const [crossing] of current.crossings) {
					const tentativeGScore = gScore.get(current)! + Math.hypot(current.wx - crossing.wx, current.wy - crossing.wy)

					if (!gScore.has(crossing))
						gScore.set(crossing, Infinity)

					if (tentativeGScore < gScore.get(crossing)!) {
						cameFrom.set(crossing, current)

						gScore.set(crossing, tentativeGScore)
						const newFScore = gScore.get(crossing)! + h(crossing)
						fScore.set(crossing, newFScore)

						if (newFScore < fScore.get(lowestFScore)!)
							lowestFScore = crossing

						if (!openSet.has(crossing) && newFScore < Infinity)
							openSet.add(crossing)
					}
				}
			}
			done()
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

type Island = {
	/** Connection points to neighboring workers, key: worker index, value: tile indices */
	crossings: Map<Island, Set<number>>
	workerIndex: number
	wx: number
	wy: number
	tiles: Set<number>
}