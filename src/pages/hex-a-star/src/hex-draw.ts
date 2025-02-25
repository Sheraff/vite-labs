import type { HexGrid } from './hex-structures'

const HEX_SIDE = 2 * Math.PI / 6

type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export type Cell = {
	x: number
	y: number
	isStart?: boolean
	isEnd?: boolean
	isObstacle?: boolean
	isPath?: boolean
}

export function drawMatrix(context: Context, matrix: HexGrid<Cell>) {
	const xLength = getCellRadius(context, matrix)
	for (const cell of matrix) {
		drawHexagon(context, cell.x, cell.y, xLength)
		styleCell(context, cell)
		context.fill()
		context.stroke()
		context.closePath()
	}
}

export function drawCell(context: Context, matrix: HexGrid<Cell>, cell: Cell) {
	const xLength = getCellRadius(context, matrix)
	drawHexagon(context, cell.x, cell.y, xLength)
	styleCell(context, cell)
	context.fill()
	context.stroke()
	context.closePath()
}

function getCellRadius(context: Context, matrix: HexGrid<Cell>) {
	return context.canvas.width / (matrix.width + matrix.width * Math.cos(HEX_SIDE) - Math.cos(HEX_SIDE)) / 2
}

function styleCell(context: Context, cell: Cell) {
	switch (true) {
		case cell.isStart:
			context.fillStyle = "limegreen"
			context.strokeStyle = "darkgrey"
			break
		case cell.isEnd:
			context.fillStyle = "deeppink"
			context.strokeStyle = "darkgrey"
			break
		case cell.isObstacle:
			context.fillStyle = "black"
			context.strokeStyle = "black"
			break
		case cell.isPath:
			context.fillStyle = "red"
			context.strokeStyle = "red"
			break
		default:
			context.fillStyle = "lightgrey"
			context.strokeStyle = "darkgrey"
	}
}

const xOffset = 1 + Math.cos(HEX_SIDE)
const yOffset = Math.sin(HEX_SIDE)

function drawHexagon(context: Context, xIndex: number, yIndex: number, r: number) {
	const x = r * (1 + xIndex * 2 * xOffset)
	const y = r * (1 + yIndex * 2 * yOffset)
	context.beginPath()
	for (let i = 0; i < 6; i++) {
		const rad = i * HEX_SIDE
		context.lineTo(x + r * Math.cos(rad), y + r * Math.sin(rad))
	}
	context.closePath()
}