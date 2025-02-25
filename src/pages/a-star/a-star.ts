export type Cell = {
	x: number, y: number
	isObstacle?: boolean
	isPath?: boolean
	isStart?: boolean
	isEnd?: boolean
}

export type Matrix = Cell[][]

export default function aStarAlgorithm(matrix: Matrix, start: Cell, goal: Cell) {
	return aStar(
		matrix,
		start,
		goal,
		(cell) => heuristic(cell, goal),
		distance,
	)
}

function heuristic(a: Cell, b: Cell): number {
	if (a.isObstacle || b.isObstacle)
		return Infinity
	return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function distance(a: Cell, b: Cell): number {
	return 1
}

// A* finds a path from start to goal.
// h is the heuristic function. h(n) estimates the cost to reach goal from node n.
// d(current,neighbor) is the weight of the edge from current to neighbor
function aStar(matrix: Matrix, start: Cell, goal: Cell, h: (cell: Cell) => number, d: (a: Cell, b: Cell) => number) {
	// The set of discovered nodes that may need to be (re-)expanded.
	// Initially, only the start node is known.
	// This is usually implemented as a min-heap or priority queue rather than a hash-set.
	const openSet = new Set<Cell>([start])

	// For node n, cameFrom[n] is the node immediately preceding it on the cheapest path from start
	// to n currently known.
	const cameFrom = new Map<Cell, Cell>()

	// For node n, gScore[n] is the cost of the cheapest path from start to n currently known.
	const gScore = new Map<Cell, number>() // default value of Infinity
	gScore.set(start, 0)

	// For node n, fScore[n] := gScore[n] + h(n). fScore[n] represents our current best guess as to
	// how short a path from start to finish can be if it goes through n.
	const fScore = new Map<Cell, number>() // default value of Infinity
	fScore.set(start, h(start))

	let lowestFScore = start
	let counter = 0

	while (openSet.size > 0) {
		if (++counter > 5000) {
			console.warn('too many iterations')
			return false
		}

		// console.group()
		// console.log(openSet)
		// console.log(cameFrom)
		// console.log(gScore)
		// console.log(fScore)
		// console.log(lowestFScore)
		// console.groupEnd()

		// This operation can occur in O(1) time if openSet is a min-heap or a priority queue
		const current = openSet.has(lowestFScore) ? lowestFScore : Array.from(openSet).reduce<Cell | null>((min, cell) => {
			if (!min || !fScore.has(min) || !fScore.get(cell))
				return cell
			return fScore.get(min)! < fScore.get(cell)!
				? min
				: cell
		}, null)!
		lowestFScore = current

		if (current === goal)
			return reconstructPath(cameFrom, current)

		openSet.delete(current)

		// for each neighbor of current
		for (const [dx, dy] of [
			[-1, 0],
			[1, 0],
			[0, -1],
			[0, 1],
		]) {
			const x = current.x + dx
			const y = current.y + dy
			if (x < 0 || x >= matrix.length || y < 0 || y >= matrix.length)
				continue

			const neighbor = matrix[y][x]

			// tentative_gScore is the distance from start to the neighbor through current
			const tentativeGScore = gScore.get(current)! + d(current, neighbor)

			if (!gScore.has(neighbor))
				gScore.set(neighbor, Infinity)

			// This path to neighbor is better than any previous one. Record it!
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

	// Open set is empty but goal was never reached
	console.warn('Open set is empty but goal was never reached')
	return false
}

function reconstructPath(cameFrom: Map<Cell, Cell>, _current: Cell): Cell[] {
	let current = _current
	const totalPath = [current]
	while (cameFrom.has(current)) {
		current = cameFrom.get(current)!
		totalPath.push(current)
	}
	return totalPath.reverse()
}