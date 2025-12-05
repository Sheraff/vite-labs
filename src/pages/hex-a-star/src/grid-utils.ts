import type { HexGrid } from "./hex-structures"
import type { PRNG } from "./seeded-random"

type Cell = {
	x: number
	y: number
	isStart?: boolean
	isEnd?: boolean
	isObstacle?: boolean
}

export function addObstacle<T extends Cell>(
	matrix: HexGrid<T>,
	exclusions: T[],
	bounds: readonly [number, number] = [1, 100],
	random: PRNG,
) {
	const start = { x: 0, y: 0 }
	const end = { x: 0, y: 0 }
	const [min, max] = bounds
	do {
		start.x = randomIndexX(random, matrix.width + 2) - 1
		start.y = randomIndexY(random, matrix.height + 2, start.x) - 1
		end.x = randomIndexX(random, matrix.width + 2) - 1
		end.y = randomIndexY(random, matrix.height + 2, end.x) - 1
	} while (
		areaAsCell(start, end) < min ||
		areaAsCell(start, end) > max ||
		Math.abs(start.y - end.y) <= 1 ||
		Math.abs(start.x - end.x) <= 0.5 ||
		Math.abs(start.y - end.y) / Math.abs(start.x - end.x) < 0.3 ||
		Math.abs(start.x - end.x) / Math.abs(start.y - end.y) < 0.3 ||
		exclusions.find(
			(cell) =>
				cell.x >= Math.min(start.x, end.x) &&
				cell.x <= Math.max(start.x, end.x) &&
				cell.y >= Math.min(start.y, end.y) &&
				cell.y <= Math.max(start.y, end.y),
		)
	)

	for (let x = Math.min(start.x, end.x); x < Math.max(start.x, end.x); x += 0.5) {
		for (let y = Math.min(start.y, end.y); y < Math.max(start.y, end.y); y += 0.5) {
			if (matrix[x]?.[y]) {
				matrix[x][y].isObstacle = true
			}
		}
	}
}

export function setStartEnd<T extends Cell>(matrix: HexGrid<T>, random: PRNG, spacing: number) {
	const start = { x: 0, y: 0 }
	const end = { x: 0, y: 0 }
	do {
		start.x = randomIndexX(random, matrix.width)
		start.y = randomIndexY(random, matrix.height, start.x)
		end.x = randomIndexX(random, matrix.width)
		end.y = randomIndexY(random, matrix.height, end.x)
	} while (
		distance(start, end) < spacing ||
		Math.abs(start.y - end.y) <= matrix.height / 3 ||
		Math.abs(start.x - end.x) <= matrix.width / 3 ||
		// conditions below are a coping mechanism, it'd be better to check my math
		!matrix[start.x]?.[start.y] ||
		!matrix[end.x]?.[end.y]
	)

	const startCell = matrix[start.x][start.y]
	startCell.isStart = true
	const endCell = matrix[end.x][end.y]
	endCell.isEnd = true

	return {
		start: startCell as T,
		end: endCell as T,
	}
}

function randomIndexX(random = Math.random, max: number) {
	return Math.floor(random() * max * 2) / 2
}

function randomIndexY(random = Math.random, _max: number, x: number) {
	const even = !(x % 1)
	const max = even ? _max : _max - 1
	return Math.floor(random() * max) + (even ? 0 : 0.5)
}

function xDistance(a: Cell, b: Cell) {
	const xDelta = Math.abs(a.x - b.x)
	return xDelta * 2 * Math.sin((2 * Math.PI) / 6)
}

function yDistance(a: Cell, b: Cell) {
	const yDelta = Math.abs(a.y - b.y)
	return (yDelta * (1.5 + Math.cos((2 * Math.PI) / 6))) / 2
}

function distance(a: Cell, b: Cell) {
	const xDelta = xDistance(a, b)
	const yDelta = yDistance(a, b)
	return Math.sqrt(xDelta ** 2 + yDelta ** 2)
}

function area(a: Cell, b: Cell) {
	const xDelta = xDistance(a, b)
	const yDelta = yDistance(a, b)
	return xDelta * yDelta
}

function areaAsCell(a: Cell, b: Cell) {
	const xDelta = Math.abs(a.x - b.x) * 2
	const yDelta = Math.abs(a.y - b.y) * 2
	return xDelta * yDelta
}
