import type { RouteMeta } from "#router"

import { Head } from "#components/Head"
import { use, useEffect, useMemo, useRef, useState } from "react"

import styles from "./styles.module.css"
import { ACTIVATIONS, AGGREGATIONS, BREED_PARENTS, FOOD_COUNT, INNATE_NODES, ITERATIONS, MAX, MAX_GENES, MAX_NODES, POPULATION, STORE_PER_GENERATION, WORLD_SIZE } from "./constants"
import simulateShader from './simulate.wgsl?raw'
import breedShader from './breed.wgsl?raw'

export const meta: RouteMeta = {
	title: "N.E.A.T. GPU",
	tags: ["simulation", "genetic algorithm", "neural network", "webgpu"],
	image: "./screen.png",
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
 * CONN GENE: 2 - from - to - weight
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
	const [fitnessScores, setFitnessScores] = useState([0])
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
			onGeneration: (count, fitness) => {
				setGenCount(count)
				setFitnessScores(p => [...p, fitness])
			},
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
							<p>{POPULATION} entities × {ITERATIONS} iterations</p>
							<button type="button" aria-pressed={genPlayState} id="generation-play-pause">
								{genPlayState ? "⏸️ pause" : "▶️ play"}
							</button>
							<hr />
							<label htmlFor="generation-select">Playing generation {currentGeneration}</label>
							<FitnessGraph scores={fitnessScores} />
							<input type="range" id="generation-select" name="generation-select" min="0" max={genCount} value={currentGeneration} readOnly />
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

function FitnessGraph({scores}: {scores: number[]}) {
	if (scores.length < 2) return null
	const width = 300
	const height = 60

	const points = useMemo(() => {
		const padding = 0
		
		const maxScore = Math.max(...scores)
		const minScore = Math.min(...scores)
		const range = maxScore - minScore || 1

		let points = ""

		for (let i = 0; i < scores.length; i++) {
			const score = scores[i]
			const x = padding + (i / (scores.length - 1)) * (width - padding * 2)
			const y = height - padding - ((score - minScore) / range) * (height - padding * 2)
			points += `${x},${y} `
		}

		return points
	}, [scores])
	
	return (
		<svg viewBox={`0 0 ${width} ${height}`}>
			<polyline
				points={points}
				fill="none"
				stroke="lime"
				strokeWidth="2"
			/>
		</svg>
	)
}

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
	onGeneration: (generationCount: number, bestFitness: number) => void
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

	const gpuControls = await setupGPU(options.controller, (generation, genomes, bestFitness) => {
		// Store top genomes
		store.push(...genomes)
		options.onGeneration(generation + 1, bestFitness)
	})
	const vizControls = setupViz(options.controller, options.ctx, options.vizCtx, store, options.onSimulation)

	{
		const initial = initialGenomes(POPULATION, 10, 20)
		for (let i = 0; i < STORE_PER_GENERATION; i++) store.push(initial[i])
		setTimeout(() => gpuControls.init(initial))
		vizControls.selectGeneration(0)
	}

	options.generationSelector.addEventListener("input", (e) => {
		const target = e.target as HTMLInputElement
		const generation = Number(target.value)
		vizControls.selectGeneration(generation)
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

/**
 * Generate initial random genomes with void gene padding.
 * Each genome has 4-element genes: [type, arg1, arg2, arg3]
 * - type 0 = void gene (padding)
 * - type 1 = node gene [1, index, aggregation, activation]
 * - type 2 = connection gene [2, from, to, weight]
 */
function initialGenomes(count: number, maxNodes: number, maxConnections: number): Float32Array[] {
	const genomes: Float32Array[] = []
	
	for (let i = 0; i < count; i++) {
		const nodeCount = Math.floor(Math.random() * maxNodes) + 2 // At least 2 nodes
		const connCount = Math.floor(Math.random() * maxConnections) + 5 // At least 5 connections
		
		// Create genome with max size, filled with void genes
		const genome = new Float32Array(MAX_GENES * 4).fill(0)
		
		let geneIndex = 0
		
		// Add node genes
		for (let n = 0; n < nodeCount && geneIndex < MAX_GENES; n++, geneIndex++) {
			genome[geneIndex * 4 + 0] = 1 // node gene type
			genome[geneIndex * 4 + 1] = n + INNATE_NODES // node index
			genome[geneIndex * 4 + 2] = Math.floor(Math.random() * AGGREGATIONS.length) // aggregation
			genome[geneIndex * 4 + 3] = Math.floor(Math.random() * ACTIVATIONS.length) // activation
		}
		
		// Add random connections
		for (let c = 0; c < connCount && geneIndex < MAX_GENES; c++, geneIndex++) {
			// Random from node (can be input or custom node)
			const fromRand = Math.floor(Math.random() * (nodeCount + 6)) // 6 input nodes
			const from = fromRand < 6 ? fromRand : fromRand + 3 // skip output nodes (6,7,8)
			
			// Random to node (can be output or custom node)
			const toRand = Math.floor(Math.random() * (nodeCount + 3)) // 3 output nodes
			const to = toRand < 3 ? toRand + 6 : toRand + 6 // outputs start at 6
			
			genome[geneIndex * 4 + 0] = 2 // connection gene type
			genome[geneIndex * 4 + 1] = from
			genome[geneIndex * 4 + 2] = to
			genome[geneIndex * 4 + 3] = Math.floor(Math.random() * (MAX + 1)) // weight 0-255
		}
		
		// Rest of genome is already filled with void genes (0,0,0,0)
		genomes.push(genome)
	}
	
	return genomes
}

type World = {
	size: number
	food: { x: number; y: number }[]
}

/**
 * Create an entity from a genome for JS-side visualization.
 * Implements the same neural network execution logic as GPU shader.
 */
function entityFromGenome(genome: Float32Array, world: World) {
	// Build graph from genome
	const graph: Array<{
		aggregation: (arr: number[]) => number
		activation: (x: number) => number
		incoming: [from: number, weight: number][]
	}> = []
	
	let maxNodeIndex = INNATE_NODES - 1
	
	// Parse genome to build graph
	for (let i = 0; i < genome.length; i += 4) {
		const type = genome[i]
		
		if (type === 1) {
			// Node gene
			const index = genome[i + 1]
			const aggregation = AGGREGATIONS[genome[i + 2]]
			const activation = ACTIVATIONS[genome[i + 3]]
			
			maxNodeIndex = Math.max(maxNodeIndex, index)
			
			if (graph[index]) {
				graph[index].activation = activation
				graph[index].aggregation = aggregation
			} else {
				graph[index] = {
					activation,
					aggregation,
					incoming: [],
				}
			}
		}
	}
	
	// Parse connections
	for (let i = 0; i < genome.length; i += 4) {
		const type = genome[i]
		
		if (type === 2) {
			// Connection gene
			const from = genome[i + 1]
			const to = genome[i + 2]
			const weight = genome[i + 3]
			
			graph[to] ??= {
				incoming: [],
				aggregation: AGGREGATIONS[0],
				activation: ACTIVATIONS[0],
			}
			graph[to].incoming.push([from, weight / MAX])
		}
	}
	
	const memory = new Float32Array(maxNodeIndex + 1).fill(0)
	const current = new Float32Array(maxNodeIndex + 1).fill(0)
	
	const state = {
		x: WORLD_SIZE / 2,
		y: WORLD_SIZE / 2,
		angle: 0,
		alive: true,
		score: 0,
		distance: 0,
		eaten: new Set<number>(),
	}
	
	const visionDistance = 20
	const eatingDistance = 3

	function tick(delta: number) {
		if (!state.alive) return
		
		// Check boundaries
		if (state.x < 0 || state.x > world.size || state.y < 0 || state.y > world.size) {
			state.alive = false
			return
		}
		
		// Wrap angle
		if (state.angle < 0) state.angle = -(-state.angle % (Math.PI * 2)) + Math.PI * 2
		if (state.angle > Math.PI * 2) state.angle %= Math.PI * 2
		
		// Detect walls
		const angle = -state.angle + Math.PI / 2
		let has_wall_ahead = false
		let has_wall_left = false
		let has_wall_right = false
		
		const ahead_x = state.x + Math.sin(angle) * visionDistance
		const ahead_y = state.y + Math.cos(angle) * visionDistance
		has_wall_ahead = ahead_x < 0 || ahead_x > world.size || ahead_y < 0 || ahead_y > world.size
		
		if (!has_wall_ahead) {
			const left_x = state.x + Math.sin(angle + Math.PI / 2) * visionDistance
			const left_y = state.y + Math.cos(angle + Math.PI / 2) * visionDistance
			has_wall_left = left_x < 0 || left_x > world.size || left_y < 0 || left_y > world.size
			
			const right_x = state.x + Math.sin(angle - Math.PI / 2) * visionDistance
			const right_y = state.y + Math.cos(angle - Math.PI / 2) * visionDistance
			has_wall_right = right_x < 0 || right_x > world.size || right_y < 0 || right_y > world.size
		}
		
		// Detect food (0.0 means no food, gradually increasing to 1.0 when in vision range, 1.0 means eating range)
		let food_ahead_dist = 0
		let food_left_dist = 0
		let food_right_dist = 0
		
		for (let f = 0; f < world.food.length; f++) {
			if (state.eaten.has(f)) continue
			
			const food = world.food[f]
			const distance = Math.hypot(state.x - food.x, state.y - food.y)
			
			if (distance < eatingDistance) {
				state.score += 100
				state.eaten.add(f)
			} else if (distance < visionDistance) {
				// Calculate angle from entity to food
				const foodAngle = Math.atan2(food.y - state.y, food.x - state.x)
				// Calculate relative angle (difference from entity's heading)
				let relativeAngle = foodAngle - state.angle
				// Normalize to [-PI, PI]
				while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2
				while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2
				
				// Check if food is within vision cone (±36 degrees)
				const visionAngle = Math.PI / 3
				if (Math.abs(relativeAngle) < visionAngle) {
					const normalizedDistance = (visionDistance - distance) / (visionDistance - eatingDistance)
					// Determine if food is left, ahead, or right
					if (Math.abs(relativeAngle) < visionAngle / 3) {
						food_ahead_dist = Math.max(food_ahead_dist, normalizedDistance)
					} else if (relativeAngle < 0) {
						food_left_dist = Math.max(food_left_dist, normalizedDistance)
					} else {
						food_right_dist = Math.max(food_right_dist, normalizedDistance)
					}
				}
			}
		}
		
		// Execute neural network
		current.fill(0)
		const inputs = [food_left_dist, food_ahead_dist, food_right_dist, +has_wall_left, +has_wall_ahead, +has_wall_right]
		for (let i = 0; i < inputs.length; i++) {
			memory[i] = inputs[i]
			current[i] = inputs[i]
		}
		
		for (let i = 0; i < graph.length; i++) {
			const node = graph[i]
			if (!node) continue
			current[i] = node.activation(node.aggregation(node.incoming.map(([from, weight]) => memory[from] * weight)))
		}
		
		memory.set(current)
		
		// Read outputs and update state
		const rotate = Math.max(0, Math.min(current[7], 10)) - Math.max(0, Math.min(current[6], 10))
		state.angle += (rotate / 100) * (delta / 10)
		const speed = Math.min(4, Math.max(0, current[8]))
		if (speed > 0) {
			const prevX = state.x
			const prevY = state.y
			state.x += Math.cos(state.angle) * speed * (delta / 100)
			state.y += Math.sin(state.angle) * speed * (delta / 100)
			state.distance += Math.hypot(state.x - prevX, state.y - prevY)
		}
	}
	
	function draw(ctx: CanvasRenderingContext2D, selected: boolean, scale: number = 1) {
		if (!state.alive) return
		
		// Draw square at position, rotated by angle
		ctx.beginPath()
		ctx.arc(state.x * scale, state.y * scale, eatingDistance * scale, 0, Math.PI * 2)
		ctx.fillStyle = selected ? "yellow" : "white"
		ctx.fill()
		
		// Draw vision cone
		if (selected) {
			ctx.save()
			ctx.translate(state.x * scale, state.y * scale)
			ctx.rotate(state.angle)
			
			// Draw cone representing vision distance and food detection angle
			const detectionAngle = Math.PI / 3 // ±36 degrees
			
			ctx.fillStyle = "rgba(255, 255, 0, 0.2)"
			ctx.strokeStyle = "rgba(255, 255, 0, 0.5)"
			ctx.lineWidth = 1
			
			ctx.beginPath()
			ctx.moveTo(0, 0)
			ctx.arc(0, 0, visionDistance * scale, -detectionAngle, detectionAngle)
			ctx.closePath()
			ctx.fill()
			ctx.stroke()

			ctx.beginPath()
			ctx.moveTo(0, 0)
			ctx.arc(0, 0, visionDistance * scale, -detectionAngle / 3, detectionAngle / 3)
			ctx.closePath()
			ctx.stroke()
			
			ctx.restore()
		}
	}
	
	return {
		tick,
		draw,
		state,
		memory,
		genome,
	}
}

/**
 * Create a graph visualization object from a genome.
 * Adapts GenomeViz logic to work with 4-element gene format.
 */
function graphFromGenome(genome: Float32Array) {
	type Connection = {
		from: number
		to: number
		weight: number
		normalized: number
	}
	
	type Node = {
		index: number
		aggregation: number
		activation: number
		incoming: Set<Connection>
		outgoing: Set<Connection>
		isInput: boolean
		isOutput: boolean
		depth: number
		name: string
		deadend: boolean
	}
	
	const connections = new Set<Connection>()
	const nodes = new Map<number, Node>()
	
	// Initialize innate nodes
	for (let i = 0; i < INNATE_NODES; i++) {
		const isInput = i < 6
		const isOutput = i >= 6 && i < INNATE_NODES
		const depth = isInput ? 0 : isOutput ? Infinity : NaN
		const name = isInput ? ["food left", "food ahead", "food right", "wall left", "wall ahead", "wall right"][i] : isOutput ? ["rotate left", "rotate right", "move ahead"][i - 6] : ""
		nodes.set(i, {
			index: i,
			aggregation: 0,
			activation: 0,
			incoming: new Set(),
			outgoing: new Set(),
			isInput,
			isOutput,
			depth,
			name,
			deadend: false,
		})
	}
	
	// Parse nodes from genome
	for (let i = 0; i < genome.length; i += 4) {
		const type = genome[i]
		if (type === 1) {
			// Node gene
			const index = genome[i + 1]
			const aggregation = genome[i + 2]
			const activation = genome[i + 3]
			nodes.set(index, {
				index,
				aggregation,
				activation,
				incoming: new Set(),
				outgoing: new Set(),
				isInput: false,
				isOutput: false,
				depth: NaN,
				name: "",
				deadend: false,
			})
		}
	}
	
	// Parse connections
	for (let i = 0; i < genome.length; i += 4) {
		const type = genome[i]
		if (type === 2) {
			// Connection gene
			const from = genome[i + 1]
			const to = genome[i + 2]
			const weight = genome[i + 3]
			const fromNode = nodes.get(from)
			const toNode = nodes.get(to)
			if (fromNode && toNode) {
				const connection = {
					from,
					to,
					weight,
					normalized: weight / MAX,
				}
				fromNode.outgoing.add(connection)
				toNode.incoming.add(connection)
				connections.add(connection)
			}
		}
	}
	
	// Resolve dead ends
	function resolveDeadEnds() {
		for (const node of nodes.values()) {
			if (node.isOutput) {
				node.deadend = node.incoming.size === 0
				continue
			}
			if (node.isInput) {
				node.deadend = node.outgoing.size === 0
				continue
			}
			if (node.outgoing.size === 0 && node.incoming.size === 0) {
				node.deadend = true
			}
		}
		let changed = true
		while (changed) {
			changed = false
			for (const node of nodes.values()) {
				if (node.deadend) continue
				const noOutgoingUtility =
					!node.isOutput &&
					Array.from(node.outgoing).every((conn) => {
						const to = nodes.get(conn.to)
						return to?.deadend || to === node
					})
				if (noOutgoingUtility) {
					node.deadend = true
					changed = true
					continue
				}
				const noIncomingUtility =
					!node.isInput &&
					Array.from(node.incoming).every((conn) => {
						const from = nodes.get(conn.from)
						return from?.deadend || from === node
					})
				if (noIncomingUtility) {
					node.deadend = true
					changed = true
					continue
				}
			}
		}
	}
	resolveDeadEnds()
	
	// Assign layers
	function assignLayers() {
		const visited = new Set<Node>()
		function dfs(node: Node, depth: number, stack: Set<Node> = new Set()): number {
			if (node.isInput) return 0
			if (stack.has(node)) return depth
			if (visited.has(node)) return node.depth
			stack.add(node)
			let maxDepth = depth
			for (const conn of node.incoming) {
				const nextNode = nodes.get(conn.from)
				if (!nextNode) continue
				const nextDepth = dfs(nextNode, depth + 1, stack)
				if (nextDepth > maxDepth) {
					maxDepth = nextDepth
				}
			}
			visited.add(node)
			node.depth = maxDepth
			return maxDepth
		}
		for (let i = 6; i < INNATE_NODES; i++) {
			const node = nodes.get(i)
			if (!node) continue
			dfs(node, 0)
		}
		for (const node of nodes.values()) {
			if (!visited.has(node)) {
				dfs(node, 1)
			}
		}
		const maxDepth =
			Math.max(
				...Array.from(nodes.values())
					.map((node) => node.depth)
					.filter((d) => !isNaN(d))
					.filter((d) => d !== Infinity),
			) + 1
		for (let i = 6; i < INNATE_NODES; i++) {
			const node = nodes.get(i)
			if (!node) continue
			node.depth = maxDepth
		}
		
		// Compact layers
		let compacted = false
		while (!compacted) {
			compacted = true
			const layers = new Set(Array.from(nodes.values()).map((node) => node.depth))
			layers.delete(NaN)
			for (let i = 0; i < layers.size; i++) {
				if (layers.has(i)) continue
				compacted = false
				for (const node of nodes.values()) {
					if (node.depth >= i) {
						node.depth -= 1
					}
				}
			}
		}
	}
	assignLayers()
	
	function draw(ctx: CanvasRenderingContext2D, entity: ReturnType<typeof entityFromGenome>) {
		const perLayer = new Map<number, Node[]>()
		for (const node of nodes.values()) {
			const layer = node.depth
			if (!perLayer.has(layer)) {
				perLayer.set(layer, [])
			}
			perLayer.get(layer)!.push(node)
		}
		perLayer.delete(NaN)
		
		ctx.font = `${16}px sans-serif`
		const leftOffset = Math.max(...["food left", "food ahead", "food right", "wall left", "wall ahead", "wall right"].map((t) => ctx.measureText(t).width)) + 20
		const rightOffset = Math.max(...["rotate left", "rotate right", "move ahead"].map((t) => ctx.measureText(t).width)) + 20
		const topOffset = 20
		const bottomOffset = 20
		const layerCount = perLayer.size
		const layerWidth = (ctx.canvas.width - leftOffset - rightOffset) / layerCount
		const maxLayerSize = Math.max(...Array.from(perLayer.values()).map((layer) => layer.length))
		const layerHeight = (ctx.canvas.height - topOffset - bottomOffset) / (maxLayerSize - 1)
		const nodeSize = 10
		
		const getX = (node: Node) => node.depth * layerWidth + leftOffset
		const getY = (node: Node) => {
			const layer = perLayer.get(node.depth)
			if (!layer) return 0
			const index = layer.indexOf(node)
			if (index === -1) return 0
			const y = index * layerHeight + topOffset
			return y
		}
		const getNodeColor = (node: Node) => {
			const hue = node.isInput ? 240 : node.isOutput ? 0 : 120
			const saturation = node.deadend ? 50 : 100
			const lightness = node.deadend ? 25 : 50
			return `hsl(${hue}, ${saturation}%, ${lightness}%)`
		}
		
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
		
		// Draw nodes
		for (const node of nodes.values()) {
			const index = node.index
			const memo = entity.memory[index]
			// Use tanh to compress any value range to [-1, 1], handles infinity gracefully
			// For typical activation outputs (0-1 or -1 to 1), this provides good visual variation
			const value = memo === undefined || isNaN(memo) ? 0 : Math.abs(Math.tanh(memo))
			ctx.fillStyle = getNodeColor(node)
			// Size varies from 0.5x to 2x nodeSize based on activation
			const size = nodeSize * (0.5 + value * 1.5)
			ctx.beginPath()
			const x = getX(node)
			const y = getY(node)
			ctx.arc(x, y, size, 0, Math.PI * 2)
			ctx.fill()
			
			if (node.isInput) {
				ctx.fillStyle = "white"
				ctx.textBaseline = "middle"
				ctx.fillText(node.name, 0, y)
			} else if (node.isOutput) {
				ctx.fillStyle = "white"
				ctx.textBaseline = "middle"
				ctx.fillText(node.name, x + nodeSize + 20, y)
			}
		}

		// Draw connections
		for (const conn of connections) {
			const fromNode = nodes.get(conn.from)
			const toNode = nodes.get(conn.to)
			if (!fromNode || !toNode) continue
			const isDeadEnd = fromNode.deadend || toNode.deadend
			ctx.strokeStyle = isDeadEnd ? "hsl(0, 0%, 50%)" : "white"
			ctx.lineWidth = 0.5 + conn.normalized * 3
			if (fromNode === toNode) {
				ctx.setLineDash([5, 5])
				ctx.beginPath()
				ctx.arc(getX(fromNode), getY(fromNode) - nodeSize, nodeSize, 0, Math.PI * 2)
				ctx.stroke()
				continue
			}
			const isBackward = fromNode.depth >= toNode.depth
			const fromX = getX(fromNode)
			const fromY = getY(fromNode)
			const toX = getX(toNode)
			const toY = getY(toNode)
			if (isBackward) {
				ctx.setLineDash([5, 5])
			} else {
				ctx.setLineDash([])
			}
			ctx.beginPath()
			ctx.moveTo(fromX + nodeSize, fromY)
			const dx = layerWidth
			ctx.bezierCurveTo(fromX + nodeSize + dx / 3, fromY, toX - nodeSize - dx / 3, toY, toX - nodeSize, toY)
			ctx.stroke()
		}
	}
	
	return {
		draw,
	}
}

async function setupGPU(
	controller: AbortController,
	onGeneration: (generation: number, genomes: Float32Array[], bestFitness: number) => void
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

	// Load shaders
	const simulateShaderModule = device.createShaderModule({
		label: "simulate shader",
		code: simulateShader,
	})
	
	const breedShaderModule = device.createShaderModule({
		label: "breed shader",
		code: breedShader,
	})
	
	// Create buffers
	const genomeBufferSize = POPULATION * MAX_GENES * 4 * Float32Array.BYTES_PER_ELEMENT
	const genomesBuffer = device.createBuffer({
		label: "genomes storage buffer",
		size: genomeBufferSize,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
	})
	onAbort(() => genomesBuffer.destroy())
	
	const offspringBuffer = device.createBuffer({
		label: "offspring storage buffer",
		size: genomeBufferSize,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
	})
	onAbort(() => offspringBuffer.destroy())
	
	const indicesBuffer = device.createBuffer({
		label: "sorted indices buffer",
		size: POPULATION * Uint32Array.BYTES_PER_ELEMENT,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
	})
	onAbort(() => indicesBuffer.destroy())
	
	const foodBufferSize = FOOD_COUNT * 2 * Float32Array.BYTES_PER_ELEMENT
	const foodBuffer = device.createBuffer({
		label: "food positions buffer",
		size: foodBufferSize,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
	})
	onAbort(() => foodBuffer.destroy())
	
	const fitnessBuffer = device.createBuffer({
		label: "fitness scores buffer",
		size: POPULATION * Float32Array.BYTES_PER_ELEMENT,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
	})
	onAbort(() => fitnessBuffer.destroy())
	
	// Create readback buffers
	const genomesReadBuffer = device.createBuffer({
		label: "genomes read buffer",
		size: MAX_GENES * 4 * Float32Array.BYTES_PER_ELEMENT,
		usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
	})
	onAbort(() => genomesReadBuffer.destroy())
	
	const fitnessReadBuffer = device.createBuffer({
		label: "fitness read buffer",
		size: POPULATION * Float32Array.BYTES_PER_ELEMENT,
		usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
	})
	onAbort(() => fitnessReadBuffer.destroy())
	
	// Create uniform buffers
	const simConfigBuffer = device.createBuffer({
		label: "simulation config uniform buffer",
		size: 6 * Uint32Array.BYTES_PER_ELEMENT,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	})
	onAbort(() => simConfigBuffer.destroy())
	
	const breedConfigBuffer = device.createBuffer({
		label: "breeding config uniform buffer",
		size: 4 * Uint32Array.BYTES_PER_ELEMENT,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	})
	onAbort(() => breedConfigBuffer.destroy())
	
	// Create bind group layouts
	const simBindGroupLayout = device.createBindGroupLayout({
		label: "simulation bind group layout",
		entries: [
			{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
			{ binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
			{ binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
			{ binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
		],
	})
	
	const breedBindGroupLayout = device.createBindGroupLayout({
		label: "breeding bind group layout",
		entries: [
			{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
			{ binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } }, // sorted indices
			{ binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } }, // genomes
			{ binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }, // offspring
		],
	})
	
	// Create pipelines
	const simulatePipeline = device.createComputePipeline({
		label: "simulate pipeline",
		layout: device.createPipelineLayout({
			bindGroupLayouts: [simBindGroupLayout],
		}),
		compute: {
			module: simulateShaderModule,
			entryPoint: "main",
		},
	})
	
	const breedPipeline = device.createComputePipeline({
		label: "breed pipeline",
		layout: device.createPipelineLayout({
			bindGroupLayouts: [breedBindGroupLayout],
		}),
		compute: {
			module: breedShaderModule,
			entryPoint: "main",
		},
	})
	
	// Create bind groups
	const simBindGroup = device.createBindGroup({
		label: "simulation bind group",
		layout: simBindGroupLayout,
		entries: [
			{ binding: 0, resource: { buffer: simConfigBuffer } },
			{ binding: 1, resource: { buffer: genomesBuffer } },
			{ binding: 2, resource: { buffer: foodBuffer } },
			{ binding: 3, resource: { buffer: fitnessBuffer } },
		],
	})
	
	const breedBindGroup = device.createBindGroup({
		label: "breeding bind group",
		layout: breedBindGroupLayout,
		entries: [
			{ binding: 0, resource: { buffer: breedConfigBuffer } },
			{ binding: 1, resource: { buffer: indicesBuffer } },
			{ binding: 2, resource: { buffer: genomesBuffer } },
			{ binding: 3, resource: { buffer: offspringBuffer } },
		],
	})
	
	// State variables
	let playing = false
	let generation = 0
	
	// Helper to run simulation for one generation
	async function runGeneration() {
		// Generate random food positions
		{
			const foodPositions = new Float32Array(FOOD_COUNT * 2)
			for (let i = 0; i < FOOD_COUNT; i++) {
				foodPositions[i * 2 + 0] = Math.random() * WORLD_SIZE
				foodPositions[i * 2 + 1] = Math.random() * WORLD_SIZE
			}
			device.queue.writeBuffer(foodBuffer, 0, foodPositions)
		}
		
		// Update simulation config
		{
			const simConfig = new Uint32Array([
				POPULATION,
				FOOD_COUNT,
				0, // placeholder for f32 worldSize
				MAX_NODES,
				MAX_GENES,
				ITERATIONS, // total iterations to run
			])
			new Float32Array(simConfig.buffer)[2] = WORLD_SIZE
			device.queue.writeBuffer(simConfigBuffer, 0, simConfig)
		}
		
		// Run simulation (shader loops internally over ITERATIONS)
		{
			const encoder = device.createCommandEncoder()
			const pass = encoder.beginComputePass()
			pass.setPipeline(simulatePipeline)
			pass.setBindGroup(0, simBindGroup)
			pass.dispatchWorkgroups(Math.ceil(POPULATION / 64))
			pass.end()
			device.queue.submit([encoder.finish()])
			await device.queue.onSubmittedWorkDone()
			if(controller.signal.aborted) return
		}
		
		// Read fitness scores
		{
			const encoder = device.createCommandEncoder()
			encoder.copyBufferToBuffer(fitnessBuffer, 0, fitnessReadBuffer, 0, POPULATION * Float32Array.BYTES_PER_ELEMENT)
			device.queue.submit([encoder.finish()])
			await fitnessReadBuffer.mapAsync(GPUMapMode.READ)
			if(controller.signal.aborted) return
		}
		
		// Get fitness scores and sort indices
		// const indices = Array.from({ length: POPULATION }, (_, i) => i)
		let indices: number[]
		let bestFitness: number
		{
			const fitnessScores = new Float32Array(fitnessReadBuffer.getMappedRange())
			indices = Array.from({ length: fitnessScores.length }, (_, i) => i)
			// Sort by fitness (descending) - must happen before unmap
			indices.sort((a, b) => fitnessScores[b] - fitnessScores[a])
			bestFitness = fitnessScores[indices[0]]
			fitnessReadBuffer.unmap()
		}
		
		// Upload sorted indices for breeding
		device.queue.writeBuffer(indicesBuffer, 0, new Uint32Array(indices))
	
		// Read back only top STORE_PER_GENERATION genomes for visualization
		const topGenomes: Float32Array[] = []
		for (let i = 0; i < STORE_PER_GENERATION; i++) {
			const index = indices[i]
			const genomeSize = MAX_GENES * 4 * Float32Array.BYTES_PER_ELEMENT
			const genomeOffset = index * genomeSize
			
			const readEncoder = device.createCommandEncoder()
			readEncoder.copyBufferToBuffer(genomesBuffer, genomeOffset, genomesReadBuffer, 0, genomeSize)
			device.queue.submit([readEncoder.finish()])
			await genomesReadBuffer.mapAsync(GPUMapMode.READ, 0, genomeSize)
			if(controller.signal.aborted) return
			
			const genome = new Float32Array(MAX_GENES * 4)
			genome.set(new Float32Array(genomesReadBuffer.getMappedRange(0, genomeSize)))
			genomesReadBuffer.unmap()
			topGenomes.push(genome)
		}
	
		// Notify generation complete
		onGeneration(generation, topGenomes, bestFitness)
		generation++
		
		// Breed new generation
		{
			const breedConfig = new Uint32Array([
				POPULATION,
				MAX_GENES,
				BREED_PARENTS,
				Math.floor(Math.random() * 4294967295), // RNG seed
			])
			device.queue.writeBuffer(breedConfigBuffer, 0, breedConfig)
		}
		
		{
			const breedEncoder = device.createCommandEncoder()
			const breedPass = breedEncoder.beginComputePass()
			breedPass.setPipeline(breedPipeline)
			breedPass.setBindGroup(0, breedBindGroup)
			breedPass.dispatchWorkgroups(Math.ceil(POPULATION / 64))
			breedPass.end()
			// Copy offspring back to genomes for next generation
			breedEncoder.copyBufferToBuffer(offspringBuffer, 0, genomesBuffer, 0, genomeBufferSize)
			device.queue.submit([breedEncoder.finish()])
			await device.queue.onSubmittedWorkDone()
		}
	}
	
	// Main loop
	async function loop() {
		while (playing && !controller.signal.aborted) {
			await runGeneration()
		}
	}

	return {
		get playing() {
			return playing
		},
		init: (initialGenomes: Float32Array[]) => {
			if (controller.signal.aborted) return
			// Upload initial genomes
			const genomesData = new Float32Array(POPULATION * MAX_GENES * 4)
			for (let i = 0; i < initialGenomes.length; i++) {
				genomesData.set(initialGenomes[i], i * MAX_GENES * 4)
			}
			device.queue.writeBuffer(genomesBuffer, 0, genomesData)
			
			// Start loop
			playing = true
			loop()
		},
		play: () => {
			if (playing) return
			playing = true
			loop()
		},
		pause: () => {
			if (!playing) return
			playing = false
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
			food: Array.from({ length: FOOD_COUNT }, () => ({
				x: Math.random() * WORLD_SIZE,
				y: Math.random() * WORLD_SIZE,
			})),
		}
	}

	function draw() {
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
		
		// Calculate scale to fill canvas
		const scale = ctx.canvas.width / (WORLD_SIZE * devicePixelRatio)
		
		const entity = entities[selectedIndex]
		for (let i = 0; i < world.food.length; i++) {
			const food = world.food[i]
			ctx.fillStyle = entity.state.eaten.has(i) ? "red" : "green"
			ctx.fillRect(food.x * scale, food.y * scale, 2, 2)
		}
		for (let i = 0; i < entities.length; i++) {
			const entity = entities[i]
			const selected = i === selectedIndex
			entity.draw(ctx, selected, scale)
		}
		
		graph.draw(vizCtx, entity)
	}
	
	function startViz() {
		const genIndex = currentGeneration
		if (genIndex < 0 || genIndex * STORE_PER_GENERATION >= store.length) return
		
		onSimulation(currentGeneration)

		selectedIndex = 0
		world = createWorld()
		entities = store
			.slice(genIndex * STORE_PER_GENERATION, (genIndex + 1) * STORE_PER_GENERATION)
			.map((genome) => entityFromGenome(genome, world))
		graph = graphFromGenome(store[genIndex * STORE_PER_GENERATION + selectedIndex])

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
		const scale = ctx.canvas.width / (WORLD_SIZE * devicePixelRatio)
		// Convert click position to world coordinates
		const canvasX = (e.clientX - rect.left) * (ctx.canvas.width / rect.width)
		const canvasY = (e.clientY - rect.top) * (ctx.canvas.height / rect.height)
		const x = canvasX / (scale * devicePixelRatio)
		const y = canvasY / (scale * devicePixelRatio)
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
			const genIndex = currentGeneration
			graph = graphFromGenome(store[genIndex * STORE_PER_GENERATION + selectedIndex])
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
			currentGeneration = generation
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
