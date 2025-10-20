import styles from './styles.module.css'
import { Head } from "#components/Head"
import type { RouteMeta } from "#router"
import { useEffect, useRef } from "react"
import { getFormValue } from "#components/getFormValue"
import { shuffleArray } from "#components/shuffleArray"

export const meta: RouteMeta = {
	title: 'Maze Generation',
	image: './screen.png',
	tags: ['algorithm', 'procedural']
}

/**
 * Demo of algoritms from https://en.wikipedia.org/wiki/Maze_generation_algorithm
 */
export default function MazeGenerationPage() {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const formRef = useRef<HTMLFormElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext("2d")
		if (!ctx) return
		const form = formRef.current
		if (!form) return

		canvas.width = window.innerWidth * devicePixelRatio
		canvas.height = window.innerHeight * devicePixelRatio

		const controller = new AbortController()

		const state = {
			algorithm: 'depth-first-stack',
			animate: true,
		}

		let stop: (() => void) | void

		const onInput = () => {
			state.algorithm = getFormValue<string>(form, 'algorithm')!
			state.animate = getFormValue<boolean>(form, 'animate')!
			stop?.()
			stop = start(ctx, state)
		}

		onInput()

		form.addEventListener('input', onInput, { signal: controller.signal })

		const rerunButton = (form.elements.namedItem('rerun') as HTMLButtonElement)
		rerunButton.addEventListener('click', () => {
			stop?.()
			stop = start(ctx, state)
		})

		return () => {
			stop?.()
			controller.abort()
		}
	}, [])

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<form className={styles.controls} ref={formRef}>
				<fieldset>
					<legend>Controls</legend>
					<select name="algorithm" id="algorithm">
						{Object.entries(ALGORITHMS).map(([key, { name }]) => (
							<option key={key} value={key}>
								{name}
							</option>
						))}
					</select>
					<button type="button" id="rerun">Re-run</button>
					<div>
						<input type="checkbox" name="animate" id="animate" defaultChecked />
						<label htmlFor="animate">Animate</label>
					</div>
				</fieldset>
			</form>
			<canvas ref={canvasRef}>
				Your browser does not support the HTML5 canvas tag.
			</canvas>
		</div>
	)
}

type Method = (
	maze: Uint8Array,
	cols: number,
	rows: number,
	getIndex: (x: number, y: number) => number,
	fromIndex: (index: number) => { x: number, y: number }
) => Generator<void, void, void>


const CELL_SIZE = 16
const WALL_THICKNESS = 2

function start(ctx: CanvasRenderingContext2D, state: { algorithm: string, animate: boolean }) {
	const width = ctx.canvas.width / devicePixelRatio
	const height = ctx.canvas.height / devicePixelRatio

	const COLS = Math.floor(width / CELL_SIZE)
	const ROWS = Math.floor(height / CELL_SIZE)

	const maze = new Uint8Array(COLS * ROWS) // N, E, S, W walls

	const getIndex = (x: number, y: number) => y * COLS + x
	const fromIndex = (index: number) => ({
		x: index % COLS,
		y: Math.floor(index / COLS)
	})

	const method = ALGORITHMS[state.algorithm].method
	const gen = method(maze, COLS, ROWS, getIndex, fromIndex)

	if (!state.animate) {
		for (const _ of gen) { /**/ }
		drawMaze(ctx, maze, COLS, ROWS)
		return
	}

	let rafId = requestAnimationFrame(function frame() {
		const res = gen.next()
		drawMaze(ctx, maze, COLS, ROWS)
		if (!res.done) {
			rafId = requestAnimationFrame(frame)
		}
	})

	return () => {
		cancelAnimationFrame(rafId)
	}
}

function randomInt(max: number) {
	return Math.floor(Math.random() * max)
}

function randomItemFromSet<T>(set: Set<T>): T | undefined {
	const index = randomInt(set.size)
	const iterator = set.values()
	for (let i = 0; i < index; i++) {
		iterator.next()
	}
	return iterator.next().value
}

function initWalls(maze: Uint8Array, cols: number, rows: number, getIndex: (x: number, y: number) => number) {
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			maze[getIndex(col, row)] = 0b1111
		}
	}
}

function drawMaze(ctx: CanvasRenderingContext2D, maze: Uint8Array, cols: number, rows: number) {
	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
	ctx.fillStyle = '#540862ff'
	const half = WALL_THICKNESS / 2

	// // full north wall
	// ctx.fillRect(
	// 	0, 0,
	// 	cols * CELL_SIZE,
	// 	half
	// )
	// // full west wall
	// ctx.fillRect(
	// 	0, 0,
	// 	half,
	// 	rows * CELL_SIZE
	// )

	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const cell = maze[row * cols + col]
			const x = col * CELL_SIZE
			const y = row * CELL_SIZE

			const north = cell & 0b0001
			const east = cell & 0b0010
			const south = cell & 0b0100
			const west = cell & 0b1000

			if (north) { // north wall
				const x_start = x - (west ? half : 0)
				const x_end = x + CELL_SIZE + (east ? half : 0)
				const y_start = y - half
				ctx.fillRect(x_start, y_start, x_end - x_start, WALL_THICKNESS)
			}
			if (west) { // west wall
				const y_start = y - (north ? half : 0)
				const y_end = y + CELL_SIZE + (south ? half : 0)
				const x_start = x - half
				ctx.fillRect(x_start, y_start, WALL_THICKNESS, y_end - y_start)
			}
			if (east) {
				const y_start = y - (north ? half : 0)
				const y_end = y + CELL_SIZE + (south ? half : 0)
				const x_start = x + CELL_SIZE - half
				ctx.fillRect(x_start, y_start, WALL_THICKNESS, y_end - y_start)
			}
			if (south) {
				const x_start = x - (west ? half : 0)
				const x_end = x + CELL_SIZE + (east ? half : 0)
				const y_start = y + CELL_SIZE - half
				ctx.fillRect(x_start, y_start, x_end - x_start, WALL_THICKNESS)
			}
		}
	}
}

/**
 * - Choose the initial cell, mark it as visited and push it to the stack
 * - While the stack is not empty
 *   - Pop a cell from the stack and make it a current cell
 *   - If the current cell has any neighbours which have not been visited
 *     - Push the current cell to the stack
 *     - Choose one of the unvisited neighbours
 *     - Remove the wall between the current cell and the chosen cell
 *     - Mark the chosen cell as visited and push it to the stack
 */
const depthFirstStackMaze: Method = function* (maze, cols, rows, getIndex, fromIndex) {
	initWalls(maze, cols, rows, getIndex)
	const max = cols * rows
	const initial = randomInt(max)
	const stack = [initial]
	const visited = new Set<number>(stack)

	while (stack.length) {
		const current = stack[stack.length - 1]
		const { x, y } = fromIndex(current)
		const top_index = getIndex(x, y - 1)
		const right_index = getIndex(x + 1, y)
		const bottom_index = getIndex(x, y + 1)
		const left_index = getIndex(x - 1, y)

		const candidates: number[] = []
		if (y >= 1 && !visited.has(top_index)) candidates.push(top_index)
		if (x < cols - 1 && !visited.has(right_index)) candidates.push(right_index)
		if (y < rows - 1 && !visited.has(bottom_index)) candidates.push(bottom_index)
		if (x >= 1 && !visited.has(left_index)) candidates.push(left_index)

		if (!candidates.length) {
			stack.pop()
			continue
		}

		const selected = candidates[randomInt(candidates.length)]
		visited.add(selected)
		stack.push(selected)

		if (selected === top_index) {
			maze[current] &= ~0b0001 // remove north wall
			maze[top_index] &= ~0b0100 // remove south wall
		} else if (selected === right_index) {
			maze[current] &= ~0b0010 // remove east wall
			maze[right_index] &= ~0b1000 // remove west wall
		} else if (selected === bottom_index) {
			maze[current] &= ~0b0100 // remove south wall
			maze[bottom_index] &= ~0b0001 // remove north wall
		} else if (selected === left_index) {
			maze[current] &= ~0b1000 // remove west wall
			maze[left_index] &= ~0b0010 // remove east wall
		}
		yield
	}
}

/**
 * - Create a list of all walls, and create a set for each cell, each containing just that one cell.
 * - For each wall, in some random order:
 *   - If the cells divided by this wall belong to distinct sets:
 *     - Remove the current wall.
 *     - Join the sets of the formerly divided cells.
 */
const iterativeRandomizedKruskal: Method = function* (maze, cols, rows, getIndex, fromIndex) {
	initWalls(maze, cols, rows, getIndex)
	const max = cols * rows
	const bl = max.toString(2).length
	const bl_mask = (1 << bl) - 1

	const getWallId = (cellIndexA: number, cellIndexB: number) => {
		const minIndex = Math.min(cellIndexA, cellIndexB)
		const maxIndex = Math.max(cellIndexA, cellIndexB)
		return (minIndex << bl) | maxIndex
	}

	const getCellsFromId = (wallId: number) => {
		const cellIndexA = wallId >> bl
		const cellIndexB = wallId & bl_mask
		return [cellIndexA, cellIndexB]
	}

	const sets = Array.from({ length: max }, (_, i) => new Set([i]))
	const walls = Array.from({
		*[Symbol.iterator]() {
			for (let row = 0; row < rows; row++) {
				for (let col = 0; col < cols; col++) {
					const cellIndex = getIndex(col, row)
					// north wall
					if (row > 0) {
						const neighborIndex = getIndex(col, row - 1)
						yield getWallId(cellIndex, neighborIndex)
					}
					// east wall
					if (col < cols - 1) {
						const neighborIndex = getIndex(col + 1, row)
						yield getWallId(cellIndex, neighborIndex)
					}
					// south wall
					if (row < rows - 1) {
						const neighborIndex = getIndex(col, row + 1)
						yield getWallId(cellIndex, neighborIndex)
					}
					// west wall
					if (col > 0) {
						const neighborIndex = getIndex(col - 1, row)
						yield getWallId(cellIndex, neighborIndex)
					}
				}
			}
		}
	})
	shuffleArray(walls)
	for (const wallId of walls) {
		const [a, b] = getCellsFromId(wallId)
		const indexA = sets.findIndex(s => s.has(a))
		const setA = sets[indexA]
		if (setA.has(b)) continue

		// join cell sets
		const indexB = sets.findIndex(s => s.has(b))
		const setB = sets[indexB]
		const newSet = setA.union(setB)
		sets[indexA] = newSet
		sets.splice(indexB, 1)

		// remove wall
		if (b === a - cols) { // north
			maze[a] &= ~0b0001 // remove north wall
			maze[b] &= ~0b0100 // remove south wall
		} else if (b === a + 1) { // east
			maze[a] &= ~0b0010 // remove east wall
			maze[b] &= ~0b1000 // remove west wall
		} else if (b === a + cols) { // south
			maze[a] &= ~0b0100 // remove south wall
			maze[b] &= ~0b0001 // remove north wall
		} else if (b === a - 1) { // west
			maze[a] &= ~0b1000 // remove west wall
			maze[b] &= ~0b0010 // remove east wall
		}
		yield
	}
}

/**
 * - Start with a grid full of walls.
 * - Pick a cell, mark it as part of the maze. Add the walls of the cell to the wall list.
 * - While there are walls in the list:
 *   - Pick a random wall from the list.
 *   - If only one of the cells that the wall divides is visited, then:
 *     - Make the wall a passage and mark the unvisited cell as part of the maze.
 *     - Add the neighboring walls of the cell to the wall list.
 *   - Remove the wall from the list.
 */
const iterativeRandomizedPrim: Method = function* (maze, cols, rows, getIndex, fromIndex) {
	initWalls(maze, cols, rows, getIndex)
	const max = cols * rows
	const initial = randomInt(max)
	const visited = new Set<number>([initial])

	const walls: number[] = []
	const addWalls = (cellIndex: number) => {
		const { x, y } = fromIndex(cellIndex)
		const north = y > 0 && (maze[cellIndex] & 0b0001)
		const east = x < cols - 1 && (maze[cellIndex] & 0b0010)
		const south = y < rows - 1 && (maze[cellIndex] & 0b0100)
		const west = x > 0 && (maze[cellIndex] & 0b1000)

		if (north) {
			const neighborIndex = getIndex(x, y - 1)
			walls.push(getWallId(cellIndex, neighborIndex))
		}
		if (east) {
			const neighborIndex = getIndex(x + 1, y)
			walls.push(getWallId(cellIndex, neighborIndex))
		}
		if (south) {
			const neighborIndex = getIndex(x, y + 1)
			walls.push(getWallId(cellIndex, neighborIndex))
		}
		if (west) {
			const neighborIndex = getIndex(x - 1, y)
			walls.push(getWallId(cellIndex, neighborIndex))
		}
	}

	const bl = max.toString(2).length
	const bl_mask = (1 << bl) - 1

	const getWallId = (cellIndexA: number, cellIndexB: number) => {
		const minIndex = Math.min(cellIndexA, cellIndexB)
		const maxIndex = Math.max(cellIndexA, cellIndexB)
		return (minIndex << bl) | maxIndex
	}

	const getCellsFromId = (wallId: number) => {
		const cellIndexA = wallId >> bl
		const cellIndexB = wallId & bl_mask
		return [cellIndexA, cellIndexB]
	}

	addWalls(initial)

	while (walls.length) {
		const randomWallIndex = randomInt(walls.length)
		const wallId = walls[randomWallIndex]
		walls.splice(randomWallIndex, 1)
		const [a, b] = getCellsFromId(wallId)

		const aVisited = visited.has(a)
		const bVisited = visited.has(b)

		if (aVisited !== bVisited) {
			if (!aVisited) visited.add(a)
			if (!bVisited) visited.add(b)

			if (b === a - cols) { // north
				maze[a] &= ~0b0001 // remove north wall
				maze[b] &= ~0b0100 // remove south wall
			} else if (b === a + 1) { // east
				maze[a] &= ~0b0010 // remove east wall
				maze[b] &= ~0b1000 // remove west wall
			} else if (b === a + cols) { // south
				maze[a] &= ~0b0100 // remove south wall
				maze[b] &= ~0b0001 // remove north wall
			} else if (b === a - 1) { // west
				maze[a] &= ~0b1000 // remove west wall
				maze[b] &= ~0b0010 // remove east wall
			}

			if (aVisited) {
				addWalls(b)
			} else {
				addWalls(a)
			}
			yield
		}
	}
}

/**
 * - a random cell is chosen and marked as part of the maze.
 * - while there exist unvisited cells:
 *   - a random unvisited cell is chosen as a starting point.
 *   - a random walk is performed from that cell until a cell that is part of the maze is reached.
 *     - during the walk, if a cell is revisited, the loop is erased (i.e., the walk continues from the first occurrence of the cell).
 *     - all cells visited during the walk are then marked as part of the maze, removing walls between consecutive cells in the walk.
 */
const wilson: Method = function* (maze, cols, rows, getIndex, fromIndex) {
	initWalls(maze, cols, rows, getIndex)
	const max = cols * rows
	const unvisited = new Set({
		*[Symbol.iterator]() {
			for (let i = 0; i < max; i++) yield i
		}
	})
	const initial = randomInt(max)
	unvisited.delete(initial)

	while (unvisited.size) {
		const walk: number[] = []
		let current = randomItemFromSet(unvisited)!
		walk.push(current)


		while (true) {
			const { x, y } = fromIndex(current)
			const top_index = getIndex(x, y - 1)
			const right_index = getIndex(x + 1, y)
			const bottom_index = getIndex(x, y + 1)
			const left_index = getIndex(x - 1, y)

			const candidates: number[] = []
			if (y >= 1) candidates.push(top_index)
			if (x < cols - 1) candidates.push(right_index)
			if (y < rows - 1) candidates.push(bottom_index)
			if (x >= 1) candidates.push(left_index)

			if (!candidates.length) throw new Error('Should not happen')

			const selected = candidates[randomInt(candidates.length)]

			const existingIndex = walk.indexOf(selected)
			if (existingIndex !== -1) {
				// loop detected, erase
				walk.splice(existingIndex + 1)
				current = selected
				continue
			}

			walk.push(selected)
			current = selected

			if (!unvisited.has(current)) break
		}

		for (let i = 0; i < walk.length - 1; i++) {
			const a = walk[i]
			const b = walk[i + 1]
			unvisited.delete(a)
			const { x, y } = fromIndex(a)

			if (b === getIndex(x, y - 1)) { // north
				maze[a] &= ~0b0001 // remove north wall
				maze[b] &= ~0b0100 // remove south wall
			} else if (b === getIndex(x + 1, y)) { // east
				maze[a] &= ~0b0010 // remove east wall
				maze[b] &= ~0b1000 // remove west wall
			} else if (b === getIndex(x, y + 1)) { // south
				maze[a] &= ~0b0100 // remove south wall
				maze[b] &= ~0b0001 // remove north wall
			} else if (b === getIndex(x - 1, y)) { // west
				maze[a] &= ~0b1000 // remove west wall
				maze[b] &= ~0b0010 // remove east wall
			}
			yield
		}
		unvisited.delete(walk[walk.length - 1])
	}
}

/**
 * - Pick a random cell as the current cell and mark it as visited.
 * - While there are unvisited cells:
 *   - Pick a random neighbour.
 *   - If the chosen neighbour has not been visited:
 *     - Remove the wall between the current cell and the chosen neighbour.
 *     - Mark the chosen neighbour as visited.
 *   - Make the chosen neighbour the current cell.
 */
const aldousBroder: Method = function* (maze, cols, rows, getIndex, fromIndex) {
	initWalls(maze, cols, rows, getIndex)
	const max = cols * rows
	const visited = new Set<number>()
	let current = randomInt(max)
	visited.add(current)

	while (visited.size < max) {
		const { x, y } = fromIndex(current)
		const top_index = getIndex(x, y - 1)
		const right_index = getIndex(x + 1, y)
		const bottom_index = getIndex(x, y + 1)
		const left_index = getIndex(x - 1, y)

		const candidates: number[] = []
		if (y >= 1) candidates.push(top_index)
		if (x < cols - 1) candidates.push(right_index)
		if (y < rows - 1) candidates.push(bottom_index)
		if (x >= 1) candidates.push(left_index)

		if (!candidates.length) throw new Error('Should not happen')

		const selected = candidates[randomInt(candidates.length)]

		if (!visited.has(selected)) {
			visited.add(selected)

			if (selected === top_index) {
				maze[current] &= ~0b0001 // remove north wall
				maze[top_index] &= ~0b0100 // remove south wall
			} else if (selected === right_index) {
				maze[current] &= ~0b0010 // remove east wall
				maze[right_index] &= ~0b1000 // remove west wall
			} else if (selected === bottom_index) {
				maze[current] &= ~0b0100 // remove south wall
				maze[bottom_index] &= ~0b0001 // remove north wall
			} else if (selected === left_index) {
				maze[current] &= ~0b1000 // remove west wall
				maze[left_index] &= ~0b0010 // remove east wall
			}
			yield
		}

		current = selected
	}
}

/**
 * - Begin with the maze's space with no walls. Call this a chamber.
 * - Divide the chamber with a randomly positioned wall (or multiple walls) where each wall contains a randomly positioned passage opening within it.
 * - Then recursively repeat the process on the subchambers until all chambers are minimum sized.
 */
const recursiveDivision: Method = function* (maze, cols, rows, getIndex, fromIndex) {
	// add north and south walls
	for (let i = 0; i < cols; i++) {
		maze[i] |= 0b0001 // north wall
		maze[getIndex(i, rows - 1)] |= 0b0100 // south wall
	}
	// add east and west walls
	for (let i = 0; i < rows; i++) {
		maze[getIndex(0, i)] |= 0b1000 // west wall
		maze[getIndex(cols - 1, i)] |= 0b0010 // east wall
	}

	const chambers: Array<[x1: number, y1: number, x2: number, y2: number]> = [
		[0, 0, cols - 1, rows - 1]
	]

	while (chambers.length) {
		const [x1, y1, x2, y2] = chambers.pop()!

		const chamberWidth = x2 - x1 + 1
		const chamberHeight = y2 - y1 + 1

		if (chamberWidth < 2 || chamberHeight < 2) continue

		const horizontal = chamberWidth === chamberHeight
			? Math.random() < 0.5
			: chamberWidth < chamberHeight

		if (horizontal) {
			// horizontal wall
			const wallY = y1 + 1 + randomInt(chamberHeight - 1)
			const passageX = x1 + randomInt(chamberWidth)

			for (let x = x1; x <= x2; x++) {
				if (x === passageX) continue
				maze[getIndex(x, wallY)] |= 0b0001 // north wall
				maze[getIndex(x, wallY - 1)] |= 0b0100 // south wall
			}

			chambers.push([x1, y1, x2, wallY - 1])
			chambers.push([x1, wallY, x2, y2])
		} else {
			// vertical wall
			const wallX = x1 + 1 + randomInt(chamberWidth - 1)
			const passageY = y1 + randomInt(chamberHeight)

			for (let y = y1; y <= y2; y++) {
				if (y === passageY) continue
				maze[getIndex(wallX, y)] |= 0b1000 // west wall
				maze[getIndex(wallX - 1, y)] |= 0b0010 // east wall
			}

			chambers.push([x1, y1, wallX - 1, y2])
			chambers.push([wallX, y1, x2, y2])
		}
		yield
	}
}


/**
 * - Start with a 1x1 "maze" (a single walled-up cell).
 * - Duplicate it 3 times to create a 2x2 grid of cells.
 * - Randomly remove 3 walls between adjacent quadrants to create a larger maze.
 * - Repeat the duplication and wall removal process to double the maze size.
 */
const fractalTessellation: Method = function* (maze, cols, rows, getIndex, fromIndex) {
	maze[0] = 0b1111 // initial cell with all walls

	let currentCols = 1
	let currentRows = 1

	while (currentCols * 2 <= cols && currentRows <= rows) {
		// duplicate maze into 4 quadrants
		for (let x = 0; x < currentCols; x++) {
			for (let y = 0; y < currentRows; y++) {
				const cell = maze[getIndex(x, y)]
				// copy right
				maze[getIndex(x + currentCols, y)] = cell
				// copy down
				maze[getIndex(x, y + currentRows)] = cell
				// copy down-right
				maze[getIndex(x + currentCols, y + currentRows)] = cell
				yield
			}
		}

		// remove 3 walls between quadrants
		const candidates = [1, 1, 1, 1]
		candidates[randomInt(4)] = 0
		const [top, right, bottom, left] = candidates
		if (top) {
			// remove wall between top-left and top-right
			const x = currentCols
			const y = randomInt(currentRows)
			maze[getIndex(x - 1, y)] &= ~0b0010 // remove east wall
			maze[getIndex(x, y)] &= ~0b1000 // remove west wall
			yield
		}
		if (right) {
			// remove wall between top-right and bottom-right
			const x = currentCols + randomInt(currentCols)
			const y = currentRows
			maze[getIndex(x, y - 1)] &= ~0b0100 // remove south wall
			maze[getIndex(x, y)] &= ~0b0001 // remove north wall
			yield
		}
		if (bottom) {
			// remove wall between bottom-left and bottom-right
			const x = currentCols
			const y = currentRows + randomInt(currentRows)
			maze[getIndex(x - 1, y)] &= ~0b0010 // remove east wall
			maze[getIndex(x, y)] &= ~0b1000 // remove west wall
			yield
		}
		if (left) {
			// remove wall between top-left and bottom-left
			const x = randomInt(currentCols)
			const y = currentRows
			maze[getIndex(x, y - 1)] &= ~0b0100 // remove south wall
			maze[getIndex(x, y)] &= ~0b0001 // remove north wall
			yield
		}

		currentCols *= 2
		currentRows *= 2
	}
}

/**
 * Same as fractalTessellation, but
 * - find an initial size greater than 1x1 that best matches the target aspect ratio
 * - initialize that size maze using another algorithm
 * - then proceed with the fractal tessellation
 */
const rectangularFractalTessellation: Method = function* (maze, cols, rows, getIndex, fromIndex) {
	let currentCols = 1
	let currentRows = 1

	if (cols === rows) {
		maze[0] = 0b1111
		yield
	} else {
		const min = Math.min(cols, rows)
		const max = Math.max(cols, rows)
		let best = [1, 1]
		let bestScore = Infinity
		const ratio = max / min
		for (let i = 1; i <= 16; i++) {
			for (let j = 1; j <= i; j++) {
				const score = Math.abs(ratio - i / j)
				if (score < bestScore) {
					bestScore = score
					best = [i, j]
				}
			}
		}
		if (best) {
			if (cols < rows) {
				currentCols = best[1]
				currentRows = best[0]
			} else {
				currentCols = best[0]
				currentRows = best[1]
			}
		}
		// initialize maze
		yield* depthFirstStackMaze(maze, currentCols, currentRows, getIndex, fromIndex)
	}

	while (currentCols * 2 <= cols && currentRows <= rows) {
		// duplicate maze into 4 quadrants
		for (let x = 0; x < currentCols; x++) {
			for (let y = 0; y < currentRows; y++) {
				const cell = maze[getIndex(x, y)]
				// copy right
				maze[getIndex(x + currentCols, y)] = cell
				// copy down
				maze[getIndex(x, y + currentRows)] = cell
				// copy down-right
				maze[getIndex(x + currentCols, y + currentRows)] = cell
				yield
			}
		}

		// remove 3 walls between quadrants
		const candidates = [1, 1, 1, 1]
		candidates[randomInt(4)] = 0
		const [top, right, bottom, left] = candidates
		if (top) {
			// remove wall between top-left and top-right
			const x = currentCols
			const y = randomInt(currentRows)
			maze[getIndex(x - 1, y)] &= ~0b0010 // remove east wall
			maze[getIndex(x, y)] &= ~0b1000 // remove west wall
			yield
		}
		if (right) {
			// remove wall between top-right and bottom-right
			const x = currentCols + randomInt(currentCols)
			const y = currentRows
			maze[getIndex(x, y - 1)] &= ~0b0100 // remove south wall
			maze[getIndex(x, y)] &= ~0b0001 // remove north wall
			yield
		}
		if (bottom) {
			// remove wall between bottom-left and bottom-right
			const x = currentCols
			const y = currentRows + randomInt(currentRows)
			maze[getIndex(x - 1, y)] &= ~0b0010 // remove east wall
			maze[getIndex(x, y)] &= ~0b1000 // remove west wall
			yield
		}
		if (left) {
			// remove wall between top-left and bottom-left
			const x = randomInt(currentCols)
			const y = currentRows
			maze[getIndex(x, y - 1)] &= ~0b0100 // remove south wall
			maze[getIndex(x, y)] &= ~0b0001 // remove north wall
			yield
		}

		currentCols *= 2
		currentRows *= 2
	}
}

const ALGORITHMS: Record<string, { method: Method, name: string }> = {
	'depth-first-stack': { method: depthFirstStackMaze, name: 'Depth-First Search' },
	'iterative-randomized-kruskal': { method: iterativeRandomizedKruskal, name: 'Iterative Randomized Kruskal\'s' },
	'iterative-randomized-prim': { method: iterativeRandomizedPrim, name: 'Iterative Randomized Prim\'s' },
	'wilson': { method: wilson, name: 'Wilson\'s Random Walk' },
	'aldous-broder': { method: aldousBroder, name: 'Aldous-Broder' },
	'recursive-division': { method: recursiveDivision, name: 'Recursive Division' },
	'fractal-tessellation': { method: fractalTessellation, name: 'Fractal Tessellation (square only)' },
	'rectangular-fractal-tessellation': { method: rectangularFractalTessellation, name: 'Rectangular Fractal Tessellation' },
}