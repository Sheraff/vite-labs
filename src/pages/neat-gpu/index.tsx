import type { RouteMeta } from "#router"

import { Head } from "#components/Head"
import { use, useEffect, useRef, useState } from "react"

import styles from "./styles.module.css"

export const meta: RouteMeta = {
	title: "N.E.A.T. GPU",
	tags: ["simulation", "genetic algorithm", "neural network", "webgpu", "wip"],
	// image: "./screen.png",
}

/*
 * GENOME SHAPE:
 *
 * Innate nodes:
 * - inputs:
 *   - 0: food left
 *   - 1: food ahead
 *   - 2: food right
 *   - 3: wall left
 *   - 4: wall ahead
 *   - 5: wall right
 * - outputs:
 *   - 6: rotate left
 *   - 7: rotate right
 *   - 8: move ahead
 *
 * VOID GENE: 0 - 0 - 0 - 0
 * NODE GENE: 1 - index - aggregation - activation
 * CONN GENE: 2 - from - to - weight - 0 (empty padding)
 *
 * Example genome:
 * [
 *   // first gene
 *   1, // node gene
 *   9, // index of node (must start after all innate nodes)
 *   0, // sum aggregation (index in AGGREGATIONS)
 *   0, // identity activation (index in ACTIVATIONS)
 *   // second gene
 *   2, // connexion gene
 *   0, // from 'wall left' input node
 *   9, // to node 9 (first node in genome)
 *   128, // 0.5 weight (assuming Uint8Array is used)
 *   0, // padding
 *   // third gene
 *   0, // void gene
 *   0,
 *   0,
 *   0,
 * ]
 */

export default function ParticleLifeGPUPage() {
	const [supported] = useState(() => Boolean(navigator.gpu))
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const vizCanvasRef = useRef<HTMLCanvasElement>(null)

	const [genCount, setGenCount] = useState(0)
	const [genPlayState, setGenPlayState] = useState(true)

	const [currentGeneration, setCurrentGeneration] = useState(0)
	const [autoplay, setAutoplay] = useState(true)

	useEffect(() => {
		if (!supported) return

		const canvas = canvasRef.current!
		const ctx = canvas.getContext("2d")!
		const size = Math.min(window.innerWidth, window.innerHeight)
		ctx.canvas.width = size * devicePixelRatio
		ctx.canvas.height = size * devicePixelRatio
		ctx.scale(devicePixelRatio, devicePixelRatio)
		
		const vizCanvas = vizCanvasRef.current!
		const vizCtx = vizCanvas.getContext("2d")!
		vizCtx.canvas.width = vizCanvas.clientWidth
		vizCtx.canvas.height = vizCanvas.clientHeight

		const controller = new AbortController()
		
		start({
			ctx,
			vizCtx,
			controller,
			onGeneration: setGenCount,
			onSimulation: setCurrentGeneration,
			onPlayState: setAutoplay,
			onGenState: setGenPlayState,
			generationSelector: document.getElementById("generation-select")! as HTMLInputElement,
			simulationPlayPause: document.getElementById("simulation-play-pause")! as HTMLButtonElement,
			generationPlayPause: document.getElementById("generation-play-pause")! as HTMLButtonElement,
		})

		return () => {
			controller.abort()
		}
	}, [supported])

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
				{!supported && <pre>Your browser does not support WebGPU.</pre>}
				{supported && <>
					<form>
						<fieldset>
							<legend>Controls</legend>
							<p>Simulating generation {genCount + 1}</p>
							<button type="button" aria-pressed={genPlayState} id="generation-play-pause">
								{genPlayState ? "⏸️ pause" : "▶️ play"}
							</button>
							<hr />
							<label htmlFor="generation-select">Playing generation {currentGeneration} of {genCount}</label>
							<input type="range" id="generation-select" name="generation-select" min="1" max={genCount} value={currentGeneration} />
							<button type="button" aria-pressed={autoplay} id="simulation-play-pause">
								{autoplay ? "⏸️ pause" : "▶️ play"}
							</button>
						</fieldset>
					</form>
					<canvas ref={vizCanvasRef} className={styles.viz} />
				</>}
			</div>
			{supported && <canvas ref={canvasRef} className={styles.canvas} />}
		</div>
	)
}

const STORE_PER_GENERATION = 10
const WORLD_SIZE = 300
const COUNT_BITS_OF_FOOD = 50

/**
 * - initialize random genomes
 * - setup webgpu for
 *   1. simulate current population
 *   2. sort by fitness
 *     - after this step, read back to store the N best genomes on the JS side
 *   3. breed new population
 *   4. loop to 1 (unless paused on the JS side)
 * - setup JS side to
 *   1. store best N genomes per generation
 *   2. 
 *   
 */
async function start(options: {
	ctx: CanvasRenderingContext2D,
	vizCtx: CanvasRenderingContext2D,
	controller: AbortController,

	/** called when a new generation is completed */
	onGeneration: (generationCount: number) => void
	/** called when the generation being visualized changes */
	onSimulation: (index: number) => void
	/** called when the play state changes */
	onPlayState: (playing: boolean) => void
	/** called when the generation play state changes */
	onGenState: (playing: boolean) => void

	/** range input to select generation */
	generationSelector: HTMLInputElement
	/** play/pause button for simulation */
	simulationPlayPause: HTMLButtonElement
	/** play/pause button for generation */
	generationPlayPause: HTMLButtonElement
}) {
	const store = [] as Float32Array[]

	const gpuControls = await setupGPU(options.controller)
	const vizControls = setupViz(options.controller, options.ctx, options.vizCtx, store, options.onSimulation)

	{
		const initial = initialGenomes(1000, 5, 20)
		for (let i = 0; i < STORE_PER_GENERATION; i++) store.push(initial[i])
		gpuControls.init(initial)
	}

	options.generationSelector.addEventListener("input", (e) => {
		const target = e.target as HTMLInputElement
		const generation = Number(target.value)
		vizControls.selectGeneration(generation)
		options.onSimulation(generation)
	}, { signal: options.controller.signal })
	options.simulationPlayPause.addEventListener("click", () => {
		if (vizControls.playing) {
			vizControls.pause()
		} else {
			vizControls.play()
		}
		options.onPlayState(vizControls.playing)
	}, { signal: options.controller.signal })
	options.generationPlayPause.addEventListener("click", () => {
		if (gpuControls.playing) {
			gpuControls.pause()
		} else {
			gpuControls.play()
		}
		options.onGenState(gpuControls.playing)
	}, { signal: options.controller.signal })

}

function initialGenomes(count: number, maxNodes: number, maxConnections: number): Float32Array[] {
}

async function setupGPU(
	controller: AbortController,
	// onGeneration:
): Promise<{
	readonly playing: boolean
	init: (initialGenomes: Float32Array[]) => void
	play: () => void
	pause: () => void
}> {
	const onAbort = (cb: () => void) => {
		if (controller.signal.aborted) return
		controller.signal.addEventListener("abort", cb, { once: true })
	}

	const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" })
	if (!adapter) throw new Error("No GPU adapter found")
	if (controller.signal.aborted) throw new Error("Aborted before getting GPU adapter")

	const device = await adapter.requestDevice()
	if (!device) throw new Error("No GPU device found")
	if (controller.signal.aborted) throw new Error("Aborted before getting GPU device")
	onAbort(() => device.destroy())
	device.lost.then((info) => info.reason !== "destroyed" && controller.abort())

	// TODO: setup pipelines, buffers, etc.

	// loop
	let playing = true
	// TODO: implement loop

	controller.signal.addEventListener("abort", () => {
		// TODO
	}, { once: true })

	return {
		get playing() {
			return playing
		},
		init: (initialGenomes: Float32Array[]) => {
			// TODO
		},
		play: () => {
			if (playing) return
			playing = true
			// TODO
		},
		pause: () => {
			if (!playing) return
			playing = false
			// TODO
		}
	}
}

/**
 * Setup vizualization for a generation.
 * - takes the N best genomes from the selected generation (from store)
 * - simulates them using `animate` function
 * - draws the simulation to `ctx`
 * - draws the neural network to `vizCtx`
 * - allows pausing/playing and selecting generation
 * - allows clicking on an individual in `ctx` to show its neural network in `vizCtx` (defaults to best individual)
 * - after simulation ends, switches to the next generation in store (if any)
 */
function setupViz(
	controller: AbortController,
	ctx: CanvasRenderingContext2D,
	vizCtx: CanvasRenderingContext2D,
	store: Float32Array[],
	onSimulation: (index: number) => void
): {
	readonly playing: boolean
	play: () => void
	pause: () => void
	selectGeneration: (generation: number) => void
} {
	let currentGeneration = 0
	
	let playing = true
	let animation: ReturnType<typeof animate> | null = null
	let entities: ReturnType<typeof entityFromGenome>[] = []
	let selectedIndex = 0
	let world: ReturnType<typeof createWorld>
	let graph: ReturnType<typeof graphFromGenome>

	function createWorld() {
		return {
			size: WORLD_SIZE,
			food: Array.from({ length: COUNT_BITS_OF_FOOD }, () => ({
				x: Math.random() * WORLD_SIZE,
				y: Math.random() * WORLD_SIZE,
			})),
			// todo
		}
	}

	function draw() {
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
		const entity = entities[selectedIndex]
		for (let i = 0; i < world.food.length; i++) {
			const food = world.food[i]
			ctx.fillStyle = entity.state.eaten.has(i) ? "red" : "green"
			ctx.rect(food.x, food.y, 2, 2)
			ctx.fill()
		}
		for (let i = 0; i < entities.length; i++) {
			const entity = entities[i]
			const selected = i === selectedIndex
			entity.draw(ctx, selected)
		}
		graph.draw(vizCtx, entity)
	}
	
	function startViz() {
		onSimulation(currentGeneration)

		selectedIndex = 0
		world = createWorld()
		entities = store
			.slice(currentGeneration * STORE_PER_GENERATION, (currentGeneration + 1) * STORE_PER_GENERATION)
			.map((genome) => entityFromGenome(genome, world))
		graph = graphFromGenome(store[currentGeneration * STORE_PER_GENERATION + selectedIndex])

		animation = animate({
			update: (delta) => {
				for (const entity of entities) {
					entity.tick(delta)
				}
			},
			render: draw
		})

		if (!playing) {
			animation.stop()
		}
	}

	ctx.canvas.addEventListener("click", (e) => {
		let closestIndex = -1
		let closestDist = Infinity
		const rect = ctx.canvas.getBoundingClientRect()
		const x = (e.clientX - rect.left) * (ctx.canvas.width / rect.width)
		const y = (e.clientY - rect.top) * (ctx.canvas.height / rect.height)
		for (let i = 0; i < entities.length; i++) {
			const entity = entities[i]
			const dx = entity.state.x - x
			const dy = entity.state.y - y
			const dist = Math.sqrt(dx * dx + dy * dy)
			if (dist < closestDist) {
				closestDist = dist
				closestIndex = i
			}
		}
		if (closestIndex !== -1 && closestIndex !== selectedIndex) {
			selectedIndex = closestIndex
			graph = graphFromGenome(store[currentGeneration * STORE_PER_GENERATION + selectedIndex])
			if (!playing) {
				draw()
			}
		}
	}, { signal: controller.signal })

	controller.signal.addEventListener("abort", () => {
		animation?.stop()
	}, { once: true })

	return {
		get playing() {
			return playing
		},
		play: () => {
			if (playing) return
			playing = true
			animation?.start()
		},
		pause: () => {
			if (!playing) return
			playing = false
			animation?.stop()
		},
		selectGeneration: (generation: number) => {
			animation?.stop()
			currentGeneration = generation - 1
			startViz()
		},
	}
}

/**
 * Fixed timestep animation loop.
 */
function animate(methods: {
	update: (delta: number) => void
	render: () => void
	/** Updates per second. (Actual draw framerate will be determined by requestAnimationFrame.) */
	rate?: number
}) {
	const rate = 1000 / (methods.rate ?? 120)
	let accumulated = 0
	let lastTime = 0
	let rafId = requestAnimationFrame(frame)

	function frame(time: number) {
		rafId = requestAnimationFrame(frame)
		const delta = time - lastTime
		lastTime = time
		if (delta === time) return // first frame
		accumulated += delta
		let updated = false
		while (accumulated >= rate) {
			updated = true
			accumulated -= rate
			methods.update(rate)
		}
		if (updated) methods.render()
	}

	return {
		stop: () => {
			if (!rafId) return
			cancelAnimationFrame(rafId)
			rafId = 0
		},
		start: () => {
			if (rafId) return
			lastTime = 0
			accumulated = 0
			rafId = requestAnimationFrame(frame)
		}
	}
}
