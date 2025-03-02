
export type Island = {
	/** Connection points to neighboring workers, key: worker index, value: tile indices */
	crossings: Map<Island, Set<number>>
	workerIndex: number
	wx: number
	wy: number
	tiles: Set<number>
}

export type Graph = Map<number, { islands: Set<Island>, tiles: Map<number, Island> }>
export type Path = Island[]

export function createGraphContext(
	/** Number of workers per row */
	workersPerRow: number,
	/** Number of tiles per row */
	SIDE: number,
	/** Number of tiles per worker */
	workerSide: number,
	/** Maximum cost of a tile */
	maxCost: number,
	/** Grid of costs */
	grid: Uint8Array,
	/** Graph of workers */
	graph: Graph,
) {


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

	function pathFinding(
		path: Path,
		from: { x: number, y: number },
		goal: { x: number, y: number },
	) {
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

	return {
		computeGraph,
		pathFinding,
	}
}