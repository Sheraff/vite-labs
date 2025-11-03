import styles from './styles.module.css'
import { Head } from "#components/Head"
import type { RouteMeta } from "#router"
import { useEffect, useRef, useState } from "react"
import { getFormValue } from "#components/getFormValue"
import { makeFrameCounter } from "#components/makeFrameCounter"

import UpdateWorker from './update.worker?worker'
import type { Incoming, Outgoing } from './update.worker'

export const meta: RouteMeta = {
	title: 'Particle Life',
	image: './screen.png',
	tags: ['simulation', 'canvas', 'particles'],
}

type ColorDef = {
	count: number
	attractions: number[]
	index: number
	color: string
}

type AttractionDef = {
	range: number
	strength: number
}

type State = {
	colors: ColorDef[]
	repulse: AttractionDef
	attract: AttractionDef
	wallRepulse: AttractionDef
}

export default function ParticleLifePage() {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const formRef = useRef<HTMLFormElement>(null)

	const [colors, setColors] = useState(() => Math.min(Math.floor(navigator.hardwareConcurrency / 2), COLORS.length))
	const [fps, setFps] = useState(0)
	const [workers] = useState(() => Math.max(1, navigator.hardwareConcurrency - 1))
	const [formatter] = useState(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0, minimumIntegerDigits: 3 }))

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

		const state: State = {
			colors: [],
			repulse: {
				range: 10,
				strength: 30,
			},
			attract: {
				range: 40,
				strength: 30,
			},
			wallRepulse: {
				range: 50,
				strength: 90,
			},
		}

		let current: ReturnType<typeof start> | null = null

		const onInput = () => {
			const colors = Number(getFormValue<string>(form, 'colors'))
			const result = state.colors || []
			for (let i = 0; i < colors; i++) {
				const def = result[i] || { count: 0, attractions: [], index: i, color: COLORS[i % COLORS.length] }
				const count = getFormValue<number>(form, `particles_${i}_count`) || 0
				def.count = count
				for (let j = 0; j < colors; j++) {
					const attraction = getFormValue<number>(form, `attraction_${i}_${j}`) || 0
					def.attractions[j] = attraction
				}
				result[i] = def
			}
			result.length = colors
			state.colors = result

			state.repulse.range = getFormValue<number>(form, 'repulse_range') || 10
			state.repulse.strength = getFormValue<number>(form, 'repulse_strength') || 30
			state.attract.range = getFormValue<number>(form, 'attract_range') || 40
			state.attract.strength = getFormValue<number>(form, 'attract_strength') || 30
			state.wallRepulse.range = getFormValue<number>(form, 'wall_repulse_range') || 50
			state.wallRepulse.strength = getFormValue<number>(form, 'wall_repulse_strength') || 90

			current?.update(state)
		}

		onInput()

		form.addEventListener('input', onInput, { signal: controller.signal })

		const frameCounter = makeFrameCounter(50)
		const onFrame = (dt: number) => setFps(frameCounter(dt))

		current = start(ctx, state, onFrame)

		const restartButton = form.elements.namedItem('restart') as HTMLButtonElement
		restartButton.addEventListener('click', () => {
			current?.stop()
			onInput()
			current = start(ctx, state, onFrame)
		}, { signal: controller.signal })

		const presetIdentityButton = form.elements.namedItem('preset-identity') as HTMLButtonElement
		presetIdentityButton.addEventListener('click', () => {
			const colors = state.colors.length
			for (let i = 0; i < colors; i++) {
				for (let j = 0; j < colors; j++) {
					const input = form.elements.namedItem(`attraction_${i}_${j}`) as HTMLInputElement
					input.value = i === j ? '1' : '0'
				}
			}
			onInput()
		}, { signal: controller.signal })

		const presetChainButton = form.elements.namedItem('preset-chain') as HTMLButtonElement
		presetChainButton.addEventListener('click', () => {
			const colors = state.colors.length
			for (let i = 0; i < colors; i++) {
				for (let j = 0; j < colors; j++) {
					const input = form.elements.namedItem(`attraction_${i}_${j}`) as HTMLInputElement
					if (j === (i + 1) % colors) {
						input.value = '0.5'
					} else if (i === j) {
						input.value = '1'
					} else if ((j + 1) % colors === i) {
						input.value = '-0.5'
					} else {
						input.value = '0'
					}
				}
			}
			onInput()
		}, { signal: controller.signal })

		const presetRandomButton = form.elements.namedItem('preset-random') as HTMLButtonElement
		presetRandomButton.addEventListener('click', () => {
			const colors = state.colors.length
			for (let i = 0; i < colors; i++) {
				for (let j = 0; j < colors; j++) {
					const input = form.elements.namedItem(`attraction_${i}_${j}`) as HTMLInputElement
					const value = (Math.random() * 2 - 1).toFixed(2)
					input.value = value
				}
			}
			onInput()
		}, { signal: controller.signal })

		const playPauseButton = form.elements.namedItem('play-pause') as HTMLButtonElement
		playPauseButton.addEventListener('click', () => {
			if (playPauseButton.getAttribute('data-state') === 'playing') {
				current?.pause()
			} else {
				current?.resume()
			}
		}, { signal: controller.signal })

		return () => {
			current?.stop()
			controller.abort()
		}
	}, [])

	const [play, setPlay] = useState(true)

	const [showControls, setShowControls] = useState(true)

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
				<button className={styles.showHide} onClick={() => setShowControls(c => !c)}>{showControls ? '◀︎ hide controls' : '▶︎'}</button>
				<form className={styles.controls} ref={formRef} data-hidden={!showControls}>
					<fieldset>
						<legend>Particles</legend>
						<div className={styles.plusMinus}>
							<button type="button" name="minus" onClick={() => setColors(c => Math.max(c - 1, 1))}>-</button>
							<button type="button" name="plus" onClick={() => setColors(c => Math.min(c + 1, COLORS.length))}>+</button>
							<input type="hidden" name="colors" data-type="number" value={colors} ref={(e) => {
								if (!e) return
								e.dispatchEvent(new Event('input', { bubbles: true }))
							}} />
							<output className={styles.fps}>{formatter.format(fps)} fps on {workers} workers</output>
							<button type="button" name="play-pause" data-state={play ? 'playing' : 'paused'} onClick={() => setPlay(p => !p)}>{play ? '⏸︎' : '▶︎'}</button>
						</div>
						<table>
							<colgroup>
								<col span={1} width="0" />
							</colgroup>
							<tbody>
								{Array.from({ length: colors }).map((_, i) => (
									<tr key={i}>
										<th scope="row">
											<span className={styles.color} style={{ '--color': COLORS[i % COLORS.length] } as React.CSSProperties} />
										</th>
										<td>
											<input type="number" name={`particles_${i}_count`} defaultValue="1500" min="0" max="2000" step="1" />
										</td>
									</tr>
								))}
							</tbody>
						</table>
						<button type="button" name="restart">Restart simulation</button>
					</fieldset>
					<fieldset>
						<legend>Attraction</legend>
						<table>
							<colgroup>
								<col span={1} width="0" />
							</colgroup>
							<thead>
								<tr>
									<th></th>
									{Array.from({ length: colors }).map((_, i) => (
										<th key={i}>
											<span className={styles.color} style={{ '--color': COLORS[i % COLORS.length] } as React.CSSProperties} />
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{Array.from({ length: colors }).map((_, i) => (
									<tr key={i}>
										<th scope="row">
											<span className={styles.color} style={{ '--color': COLORS[i % COLORS.length] } as React.CSSProperties} />
										</th>
										{Array.from({ length: colors }).map((_, j) => (
											<td key={j}>
												<input type="number" name={`attraction_${i}_${j}`} defaultValue={i === j ? "1" : "0"} step="0.1" min="-1" max="1" />
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
						<div className={styles.presets}>
							<span>Presets:</span>
							<button type="button" name="preset-identity">Identity</button>
							<button type="button" name="preset-chain">Chain</button>
							<button type="button" name="preset-random">Random</button>
						</div>
					</fieldset>
					<fieldset>
						<legend>Controls</legend>
						<table>
							<thead>
								<tr>
									<th></th>
									<th>Range</th>
									<th>Strength</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<th scope="row">Repulse</th>
									<td>
										<input type="range" name="repulse_range" defaultValue="22" min="0" max="100" step="1" />
									</td>
									<td>
										<input type="range" name="repulse_strength" defaultValue="34" min="0" max="100" step="1" />
									</td>
								</tr>
								<tr>
									<th scope="row">Attract</th>
									<td>
										<input type="range" name="attract_range" defaultValue="44" min="0" max="100" step="1" />
									</td>
									<td>
										<input type="range" name="attract_strength" defaultValue="30" min="0" max="100" step="1" />
									</td>
								</tr>
								<tr>
									<th scope="row">Wall Repulse</th>
									<td>
										<input type="range" name="wall_repulse_range" defaultValue="50" min="0" max="100" step="1" />
									</td>
									<td>
										<input type="range" name="wall_repulse_strength" defaultValue="100" min="0" max="100" step="1" />
									</td>
								</tr>
							</tbody>
						</table>
					</fieldset>
				</form>
			</div>
			<canvas ref={canvasRef}>
				Your browser does not support the HTML5 canvas tag.
			</canvas>
		</div>
	)
}



function start(ctx: CanvasRenderingContext2D, state: State, onFrame: (dt: number) => void) {
	console.log('start', state)
	const width = ctx.canvas.width / devicePixelRatio
	const height = ctx.canvas.height / devicePixelRatio

	const total = state.colors.reduce((sum, c) => sum + c.count, 0)
	// const particles = new Array<Particle>(total)
	// const tree = new TreeNode<Particle>(0, 0, width, height, 8)

	const x_buffer = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * total)
	const y_buffer = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * total)
	const vx_buffer = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * total)
	const vy_buffer = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * total)
	const color_buffer = new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT * total)

	const x = new Float32Array(x_buffer)
	const y = new Float32Array(y_buffer)
	const vx = new Float32Array(vx_buffer)
	const vy = new Float32Array(vy_buffer)
	const color = new Uint8Array(color_buffer)
	{
		let i = 0
		for (const c of state.colors) {
			for (let j = 0; j < c.count; j++) {
				color[i] = c.index
				x[i] = Math.random() * width
				y[i] = Math.random() * height
				vx[i] = 0
				vy[i] = 0
				i++
			}
		}
	}

	const controller = new AbortController()
	const parallelism = Math.max(1, navigator.hardwareConcurrency - 1)
	const workers = new Array<Worker>(parallelism)
	for (let i = 0; i < parallelism; i++) {
		const worker = new UpdateWorker()
		workers[i] = worker

		const indexStart = Math.floor(i * total / parallelism)
		const indexEnd = i === parallelism - 1
			? total
			: Math.floor((i + 1) * total / parallelism)

		worker.postMessage({
			type: 'buffers',
			data: {
				color: color_buffer,
				x: x_buffer,
				y: y_buffer,
				vx: vx_buffer,
				vy: vy_buffer,
				total,
				range: [indexStart, indexEnd],
				width,
				height,
			}
		} satisfies Incoming)

		worker.postMessage({
			type: 'state',
			data: state
		} satisfies Incoming)

		worker.addEventListener('message', (e: MessageEvent<Outgoing>) => {
			switch (e.data.type) {
				case "frame":
					onFrame(e.data.data.dt / 1000)
					break
			}
		}, { signal: controller.signal })
	}

	let rafId = requestAnimationFrame(function loop(time) {
		rafId = requestAnimationFrame(loop)
		draw()
	})


	return {
		stop: () => {
			cancelAnimationFrame(rafId)
			controller.abort()
			for (const worker of workers) {
				worker.terminate()
			}
		},
		update: (state: State) => {
			for (const worker of workers) {
				worker.postMessage({
					type: 'state',
					data: state
				} satisfies Incoming)
			}
		},
		pause: () => {
			for (const worker of workers) {
				worker.postMessage({
					type: 'pause',
				} satisfies Incoming)
			}
		},
		resume: () => {
			for (const worker of workers) {
				worker.postMessage({
					type: 'resume',
				} satisfies Incoming)
			}
		},
	}

	function draw() {
		ctx.clearRect(0, 0, width, height)
		for (let i = 0; i < total; i++) {
			const px = x[i]
			const py = y[i]
			const pcolor = color[i]
			ctx.fillStyle = state.colors[pcolor].color
			ctx.fillRect(px, py, 2, 2)
		}
	}
}


const COLORS = [
	'red',
	'cyan',
	'yellow',
	'green',
	'lavender',
	'indigo',
	'violet',
	'orange',
	'magenta',
	'lime',
	'pink',
	'teal',
	'blue',
	'brown',
]
