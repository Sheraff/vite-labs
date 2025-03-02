import type { RouteMeta } from "~/router"
import styles from './styles.module.css'
import { Head } from "~/components/Head"
import { useEffect, useRef } from "react"
import { type Graph, type Path, createGraphContext } from "./fragmented-a-star"

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

		{
			// random obstacles
			const count = Math.random() * SIDE / 2 + SIDE / 2
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

		const goal = { x: Math.round(SIDE * 1 / 8), y: Math.round(SIDE * 1 / 8) }
		const from = { x: 0, y: 0 }
		do {
			from.x = Math.floor(Math.random() * SIDE)
			from.y = Math.floor(Math.random() * SIDE)
		} while (grid[from.y * SIDE + from.x] === maxCost)

		const graph: Graph = new Map()
		const path: Path = []

		const { computeGraph, pathFinding } = createGraphContext(
			workersPerRow,
			SIDE,
			workerSide,
			maxCost,
			grid,
			graph,
		)

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

		computeGraph()
		pathFinding(path, from, goal)

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
			pathFinding(path, from, goal)
		}, { signal: controller.signal })

		canvas.addEventListener('pointermove', (e) => {
			const { x, y } = eventToPosition(e)
			if (x === goal.x && y === goal.y) return
			if (grid[y * SIDE + x] === maxCost) return
			goal.x = x
			goal.y = y
			pathFinding(path, from, goal)
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

