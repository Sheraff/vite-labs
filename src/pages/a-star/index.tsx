import type { RouteMeta } from "~/router"
import styles from './styles.module.css'
import { Head } from "~/components/Head"
import { useEffect, useRef } from "react"
import aStar, { type Cell, type Matrix } from "./a-star"

export const meta: RouteMeta = {
	title: 'A*',
	image: './screen.png'
}

export default function AStarPage() {
	const ref = useRef<HTMLCanvasElement | null>(null)
	useEffect(() => {
		const canvas = ref.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		canvas.height = 600
		canvas.width = 600

		const { matrix, start, end } = init()

		const path = aStar(matrix, start, end)

		if (!path) {
			drawMatrix(ctx, matrix)
			return
		}

		const clear = animate(ctx, matrix, path)

		return () => {
			clear()
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

function animate(ctx: CanvasRenderingContext2D, matrix: Matrix, path: Cell[]) {
	let prevTime = 0
	let frame = 0
	const delay = 1000 / 30
	let rafId = requestAnimationFrame(function loop(lastTime) {
		rafId = requestAnimationFrame(loop)
		if (!prevTime) {
			prevTime = lastTime
			return
		}

		const deltaTime = lastTime - prevTime
		if (deltaTime < delay) return

		const cell = path[frame]
		if (!cell) {
			cancelAnimationFrame(rafId)
			return
		}

		cell.isPath = true
		drawMatrix(ctx, matrix)

		frame++
		prevTime = lastTime
	})

	return () => cancelAnimationFrame(rafId)
}

function init() {
	const side = 50
	const matrix: Matrix = new Array(side)
		.fill(null)
		.map((_, y) => new Array(side)
			.fill(null)
			.map((_, x) => ({ x, y }))
		)

	//
	const { start, end } = getStartEnd(matrix)
	start.isStart = true
	end.isEnd = true

	//
	for (let i = 0; i < 25; i++) {
		const obstacle = addObstacle(matrix, [start, end])
		for (let x = Math.min(obstacle.start.x, obstacle.end.x); x < Math.max(obstacle.start.x, obstacle.end.x); x++) {
			for (let y = Math.min(obstacle.start.y, obstacle.end.y); y < Math.max(obstacle.start.y, obstacle.end.y); y++) {
				matrix[y][x].isObstacle = true
			}
		}
	}

	return { matrix, start, end }
}


function drawMatrix(context: CanvasRenderingContext2D, matrix: Matrix) {
	const side = context.canvas.height / matrix.length
	for (let y = 0; y < matrix.length; y++) {
		for (let x = 0; x < matrix[y].length; x++) {
			const cell = matrix[y][x]
			context.fillStyle = cell.isObstacle
				? 'black'
				: cell.isPath
					? 'red'
					: 'lightgrey'
			context.beginPath()
			context.rect(
				x * side + 2,
				y * side + 2,
				side - 4,
				side - 4
			)
			context.fill()
			if (cell.isStart || cell.isEnd) {
				context.strokeStyle = cell.isStart ? 'green' : 'purple'
				context.stroke()
			}
			context.closePath()
		}
	}
}

function randomInt(max: number) {
	return Math.floor(Math.random() * max)
}

function getStartEnd(matrix: Matrix) {
	const side = matrix.length
	const start = { x: 0, y: 0 }
	const end = { x: 0, y: 0 }
	do {
		start.x = randomInt(side)
		start.y = randomInt(side)
		end.x = randomInt(side)
		end.y = randomInt(side)
	} while (distance(start, end) < 40)

	return {
		start: matrix[start.y][start.x],
		end: matrix[end.y][end.x],
	}
}

function addObstacle(matrix: Matrix, exclusions: Cell[]) {
	const side = matrix.length
	const start = { x: 0, y: 0 }
	const end = { x: 0, y: 0 }
	do {
		start.x = randomInt(side)
		start.y = randomInt(side)
		end.x = randomInt(side)
		end.y = randomInt(side)
	} while (
		area(start, end) < 10
		|| area(start, end) > 100
		|| exclusions.find(cell =>
			cell.x >= Math.min(start.x, end.x)
			&& cell.x <= Math.max(start.x, end.x)
			&& cell.y >= Math.min(start.y, end.y)
			&& cell.y <= Math.max(start.y, end.y)
		)
	)

	return { start, end }
}

function area(a: Cell, b: Cell) {
	return Math.abs(a.x - b.x) * Math.abs(a.y - b.y)
}

function distance(a: Cell, b: Cell) {
	return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}