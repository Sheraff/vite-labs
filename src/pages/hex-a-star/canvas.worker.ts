import { HexGrid, makeHexGrid } from './src/hex-structures'
import { drawMatrix, drawCell, type Cell } from './src/hex-draw'
import { setStartEnd, addObstacle } from './src/grid-utils'
import seededRandom, { type PRNG } from './src/seeded-random'
import aStar from './src/a-star'
import interrupt from './src/interruptable-async-generator-function'


/// <reference lib="webworker" />

export type Incoming =
	| { type: "canvas", data: { canvas: OffscreenCanvas, side: number } }
	| { type: "seed", data: { seed: string } }


{
	self.onmessage = (e: MessageEvent<Incoming>) => handleMessage(e.data)

	let context: OffscreenCanvasRenderingContext2D | null = null
	let side = 0
	let clear = () => { }
	let seed = ''

	function handleMessage(event: Incoming) {
		if (event.type === "canvas") {
			const ctx = event.data.canvas.getContext("2d")
			if (!ctx) throw new Error("Canvas not set")
			context = ctx
			side = event.data.side
		} else if (event.type === "seed") {
			seed = event.data.seed
		}

		if (context && seed) {
			clear()
			clear = startWithSeed(context, seed, side)
		}
	}
}

function startWithSeed(context: OffscreenCanvasRenderingContext2D, seed: string, side: number) {
	let killChild: () => void
	const random = seededRandom(seed, { entropy: false })
	const kill = interrupt(async function* () {
		let path, matrix
		do {
			const grid = makeGrid(random, side)
			matrix = grid.matrix
			const { start, end } = grid
			await nextFrame()
			yield
			drawMatrix(context, matrix)
			await nextFrame()
			path = aStar(matrix, start, end)
		} while (!path)
		yield
		await wait(400)
		yield
		killChild = animatePath(context, matrix, path!)
	})
	return () => {
		kill()
		killChild?.()
	}
}

function animatePath(context: OffscreenCanvasRenderingContext2D, matrix: HexGrid<Cell>, path: Cell[]) {
	return interrupt(async function* () {
		for (const cell of path) {
			cell.isPath = true
			await wait(30)
			await nextFrame()
			yield
			drawCell(context, matrix, cell)
		}
	})
}

// const GRID_SIZE = [50, 86]
// const DISTANCE = 90
// const OBSTACLE_COUNT = 50
// const OBSTACLE_SIZE = [10, 150]

// const GRID_SIZE = [20, 34]
// const DISTANCE = 10
// const OBSTACLE_COUNT = 10
// const OBSTACLE_SIZE = [3, 20]

function makeGrid(random: PRNG, side: number) {
	const {
		GRID_SIZE,
		DISTANCE,
		OBSTACLE_COUNT,
		OBSTACLE_SIZE,
	} = makeParams(side)
	const matrix = makeHexGrid(...GRID_SIZE)
	const { start, end } = setStartEnd(matrix, random, DISTANCE)
	for (let i = 0; i < OBSTACLE_COUNT; i++) {
		addObstacle(matrix, [start, end], OBSTACLE_SIZE, random)
	}
	return { matrix, start, end }
}

function makeParams(side: number) {
	const x = Math.round(side / 20)
	const y = x + Math.round((x + x * Math.cos(2 * Math.PI / 6) - Math.cos(2 * Math.PI / 6)) / 2) - 2
	const distance = (x + y) * 0.3
	const obstacleCount = Math.round(x * y / 60)
	const obstacleSize = [
		Math.floor(x * y / 300),
		Math.ceil(x * y / 20),
	] as const
	return {
		GRID_SIZE: [x, y] as const,
		DISTANCE: distance,
		OBSTACLE_COUNT: obstacleCount,
		OBSTACLE_SIZE: obstacleSize,
	}
}

function wait(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function nextFrame() {
	return new Promise(resolve => requestAnimationFrame(resolve))
}