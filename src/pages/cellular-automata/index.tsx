import type { RouteMeta } from "#router"
import styles from './styles.module.css'
import { Head } from "#components/Head"
import { useEffect, useRef, useState } from "react"
import { transforms as conway } from './conway'
import type { Transform } from "#cellular-automata/types"

export const meta: RouteMeta = {
	title: 'Cellular Automata',
	tags: ['wip']
}

const GRID_SIZE = 200
const INITIAL_SPEED = 5


export default function CellularAutomataPage() {
	const ref = useRef<HTMLCanvasElement | null>(null)
	const formRef = useRef<HTMLFormElement | null>(null)
	const [fps, setFps] = useState('')

	useEffect(() => {
		const canvas = ref.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return
		const form = formRef.current
		if (!form) return

		const min = Math.min(canvas.width, canvas.height) * window.devicePixelRatio
		canvas.height = min
		canvas.width = min

		const frameCounter = makeFrameCounter(50)

		return start(ctx, form, (delta) => setFps(frameCounter(delta).toPrecision(3)))
	}, [])

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<canvas width="1000" height="1000" ref={ref}>
				Your browser does not support the HTML5 canvas tag.
			</canvas>
			<form ref={formRef} className={styles.form}>
				<fieldset>
					<legend>Controls</legend>
					<label htmlFor="play" className={styles.play}>
						<input type="checkbox" name="play" id="play" defaultChecked />
					</label>
					<hr />
					<label htmlFor="speed">Speed</label>
					<input type="range" name="speed" id="speed" min="1" max="120" step="1" defaultValue={INITIAL_SPEED} />
				</fieldset>
			</form>
			<div className={styles.stats}>
				<p>FPS: {fps}</p>
			</div>
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

function start(ctx: CanvasRenderingContext2D, form: HTMLFormElement, onFrame: (delta: number) => void) {
	const gridSize = GRID_SIZE
	const pxSize = ctx.canvas.height / gridSize

	const a = new Int16Array(gridSize * gridSize)
	const b = new Int16Array(gridSize * gridSize)

	let current = a
	let next = b

	// init: {
	// 	current[getIndex(3, 3)] = 1
	// 	current[getIndex(4, 3)] = 1
	// 	current[getIndex(5, 3)] = 1
	// 	current[getIndex(3, 4)] = 1
	// }

	conwayInit: {
		const gun = [
			[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
			[0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
			[0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0],
			[0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
			[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		]
		if (gun.length > gridSize || gun[0].length > gridSize) break conwayInit
		const yOffset = Math.floor((gridSize - gun.length) / 2)
		const xOffset = Math.floor((gridSize - gun[0].length) / 2)
		for (let y = 0; y < gun.length; y++) {
			const row = gun[y]
			if (y >= gridSize) continue
			for (let x = 0; x < row.length; x++) {
				if (x >= gridSize) continue
				if (row[x] === 1) {
					current[getIndex(x + xOffset, y + yOffset)] = 1
				}
			}
		}
	}

	const sortedTransforms = Object.fromEntries(Object.entries(Object.groupBy(transforms, (t) => t[0][0][0])).map(([key, transforms]) => {
		const compiled = transforms!.map(t => {
			const [before, after] = t!
			const f = new Function('x', 'y', 'i', 'current', 'next', 'touched', `
				if (y + ${before.length} > ${gridSize}) return;
				if (x + ${before[0].length} > ${gridSize}) return;
				if (${before.flatMap((row, by) => row.map((value, bx) => `
					current[i${by * gridSize + bx === 0 ? '' : `+ ${by * gridSize + bx}`}] !== ${value}
				`)).join(' || ')}) return;
				${after.flatMap((row, by) => row.map((value, bx) => value === -1 ? '' : `{
					const index = i${by * gridSize + bx === 0 ? '' : `+ ${by * gridSize + bx}`};
					next[index] = ${value};
					touched[index] = 1;
				}`)).filter(Boolean).join(' ')}
			`.replaceAll(/\s+/g, ' ')) as (x: number, y: number, i: number, current: Int16Array, next: Int16Array, touched: Uint8Array) => void
			return f
		})
		return [key, compiled]
	}))

	const touched = new Uint8Array(gridSize * gridSize)
	const side = ctx.canvas.height
	let lastTime = 0
	let rafId = requestAnimationFrame(function animate(time) {
		rafId = requestAnimationFrame(animate)
		const first = lastTime === 0
		const delta = (time - lastTime) / 1000
		onFrame(delta)
		const update = delta > 1 / state.playback.speed
		if (update || !state.playback.isPlaying) lastTime = time
		if (first) return

		ctx.clearRect(0, 0, side, side)
		touched.fill(0)
		ctx.fillStyle = 'white'

		for (let y = 0; y < gridSize; y++) {
			for (let x = 0; x < gridSize; x++) {
				const index = getIndex(x, y)
				const cell = current[index]
				if (cell === 1) {
					ctx.fillRect(x * pxSize, y * pxSize, pxSize, pxSize)
				}

				if (update && state.playback.isPlaying) {
					const transforms = sortedTransforms[cell]
					if (transforms) {
						for (const t of transforms) {
							t(x, y, index, current, next, touched)
						}
					}
				}

				if (!touched[index]) {
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
		playback: { speed: INITIAL_SPEED, isPlaying: false }
	}
	ctx.canvas.addEventListener('mousedown', (e) => {
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

	const onInput = () => {
		state.playback.isPlaying = getValue<boolean>(form, 'play')!
		state.playback.speed = getValue<number>(form, 'speed')!
	}
	onInput()
	form.addEventListener('input', onInput, { signal: controller.signal })

	return () => {
		cancelAnimationFrame(rafId)
		controller.abort()
	}
}

/**
 * A simple frame counter that returns the average FPS over the last `over` frames.
 * @param over - The number of frames to average over.
 */
function makeFrameCounter(over: number = 30) {
	let pointer = 0
	let full = false
	const frames: number[] = Array(over).fill(0)

	/**
	 * @param delta - The time in seconds since the last frame.
	 * @returns The current frames per second (FPS) based on the average of the last `over` frames.
	 */
	return (delta: number): number => {
		frames[pointer] = delta
		pointer = (pointer + 1) % over
		if (pointer === 0) full = true
		const avg = full
			? frames.reduce((a, b) => a + b, 0) / over
			: frames.reduce((a, b, i) => i < pointer ? a + b : a, 0) / pointer
		const fps = 1 / avg
		return fps
	}
}

function getValue<T,>(form: HTMLFormElement, name: string): T | undefined {
	if (!(name in form.elements)) return undefined
	const element = form.elements[name as keyof typeof form.elements]
	if (element instanceof HTMLSelectElement) return element.value as T
	if (element instanceof HTMLInputElement) {
		if (element.type === 'range') {
			return element.valueAsNumber as T
		}
		if (element.type === 'checkbox') {
			return element.checked as T
		}
	}
}