import type { RouteMeta } from "~/router"
import styles from './styles.module.css'
import { Head } from "~/components/Head"
import { useEffect, useRef } from "react"
import { transforms as conway } from './conway'
import type { Transform } from "@cellular-automata/types"

export const meta: RouteMeta = {
	title: 'Cellular Automata',
	tags: ['wip']
}


export default function CellularAutomataPage() {
	const ref = useRef<HTMLCanvasElement | null>(null)

	useEffect(() => {
		const canvas = ref.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		const side = 1600 * window.devicePixelRatio
		canvas.height = side
		canvas.width = side

		return start(ctx, side)
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



const sand: Transform[] = [
	[
		[
			[1],
			[0]
		],
		[
			[0],
			[1]
		]
	],
	[
		[
			[0, 1, 0],
			[1, 1, 0],
		],
		[
			[-1, 0, -1],
			[-1, -1, 1],
		]
	],
	[
		[
			[0, 1, 0],
			[0, 1, 1],
		],
		[
			[-1, 0, -1],
			[1, -1, -1],
		]
	],
	[
		[
			[1, 1, 0],
			[1, 1, 0],
		],
		[
			[-1, 0, -1],
			[-1, -1, 1],
		]
	],
	[
		[
			[0, 1, 1],
			[0, 1, 1],
		],
		[
			[-1, 0, -1],
			[1, -1, -1],
		]
	],
	[
		[
			[0, 1, 0],
			[0, 1, 0],
		],
		[
			[-1, 0, -1],
			[1, -1, -1],
		]
	],
	[
		[
			[0, 1, 0],
			[0, 1, 0],
			[0, 1, 0],
		],
		[
			[-1, 0, -1],
			[-1, 1, -1],
			[-1, -1, 1],
		]
	],
]

const transforms: Transform[] = conway

function start(ctx: CanvasRenderingContext2D, side: number) {
	const gridSize = 30
	const pxSize = side / gridSize

	const a = new Int16Array(gridSize * gridSize)
	const b = new Int16Array(gridSize * gridSize)

	let current = a
	let next = b

	init: {
		current[getIndex(3, 3)] = 1
		current[getIndex(4, 3)] = 1
		current[getIndex(5, 3)] = 1
		current[getIndex(3, 4)] = 1
	}

	let lastTime = 0
	let rafId = requestAnimationFrame(function animate(time) {
		rafId = requestAnimationFrame(animate)
		const first = lastTime === 0
		const delta = (time - lastTime) / 1000
		const update = delta > 1
		if (update) lastTime = time
		if (first) return

		ctx.clearRect(0, 0, side, side)

		const touched = new Set<number>()
		for (let y = 0; y < gridSize; y++) {
			for (let x = 0; x < gridSize; x++) {
				const index = getIndex(x, y)
				const cell = current[index]
				if (cell === 1) {
					ctx.fillStyle = 'white'
					ctx.fillRect(x * pxSize, y * pxSize, pxSize, pxSize)
				}

				if (update) {
					transform: for (const [before, after] of transforms) {
						if (cell !== before[0][0]) continue transform
						const h = before.length
						if (y + h > gridSize) continue transform
						const w = before[0].length
						if (x + w > gridSize) continue transform
						for (let by = 0; by < h; by++) {
							for (let bx = 0; bx < w; bx++) {
								const cellIndex = getIndex(x + bx, y + by)
								// if (touched.has(cellIndex)) continue transform
								if (before[by][bx] !== current[cellIndex]) {
									continue transform
								}
							}
						}
						for (let by = 0; by < h; by++) {
							for (let bx = 0; bx < w; bx++) {
								const cellIndex = getIndex(x + bx, y + by)
								const value = after[by][bx]
								if (value === -1) continue
								touched.add(cellIndex)
								next[cellIndex] = value
							}
						}
					}
				}

				if (!touched.has(index)) {
					next[index] = current[index]
				}
			}
		}

		if (state.mouse.down) {
			const { x, y } = state.mouse
			if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
				const index = getIndex(x, y)
				next[index] = state.mouse.color
			}
		}

		if (state.mouse.x !== -1) {
			ctx.strokeStyle = 'red'
			ctx.lineWidth = 2
			ctx.strokeRect(state.mouse.x * pxSize, state.mouse.y * pxSize, pxSize, pxSize)
		}

		const temp = current
		current = next
		next = temp
	})

	function getIndex(x: number, y: number) {
		return y * gridSize + x
	}

	const controller = new AbortController()
	const state = {
		mouse: { x: -1, y: -1, down: false, color: 0 },
	}
	window.addEventListener('mousedown', (e) => {
		state.mouse.down = true
		const { x, y } = eventToPosition(e)
		state.mouse.x = x
		state.mouse.y = y
		state.mouse.color = current[getIndex(x, y)] === 1 ? 0 : 1
		if (state.mouse.down) {
			const index = getIndex(x, y)
			current[index] = state.mouse.color
		}
	}, { signal: controller.signal })
	window.addEventListener('mouseup', () => {
		state.mouse.down = false
	}, { signal: controller.signal })
	window.addEventListener('mousemove', (e) => {
		const { x, y } = eventToPosition(e)
		state.mouse.x = x
		state.mouse.y = y
		if (state.mouse.down) {
			const index = getIndex(x, y)
			current[index] = state.mouse.color
		}
	}, { signal: controller.signal })

	const eventToPosition = (e: PointerEvent | MouseEvent) => {
		const { left, top, width, height } = ctx.canvas.getBoundingClientRect()
		const x = Math.floor((e.clientX - left) / width * gridSize)
		const y = Math.floor((e.clientY - top) / height * gridSize)
		return { x, y }
	}

	return () => {
		cancelAnimationFrame(rafId)
		controller.abort()
	}
}