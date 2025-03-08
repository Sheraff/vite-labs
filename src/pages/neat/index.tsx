import { useEffect, useRef } from "react"
import styles from './styles.module.css'
import { Head } from "~/components/Head"
import type { RouteMeta } from "~/router"

export const meta: RouteMeta = {
	title: 'N.E.A.T',
}

export default function Neat() {
	const ref = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = ref.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		const side = Math.min(innerHeight, innerWidth) * devicePixelRatio
		canvas.width = side
		canvas.height = side

		const start = (iterations: number, cb: () => void) => {
			rafId = requestAnimationFrame(function loop() {
				if (iterations === 0) return cb()
				rafId = requestAnimationFrame(loop)
				ctx.clearRect(0, 0, canvas.width, canvas.height)
				iterations--
				if (iterations % 100 === 0) {
					console.log(iterations, 'ticks')
				}

				for (const entity of entities) {
					const ahead_future_x = entity.state.x + Math.cos(entity.state.angle) * 10
					const ahead_future_y = entity.state.y + Math.sin(entity.state.angle) * 10
					const has_wall_ahead = ahead_future_x < 0 || ahead_future_x > side || ahead_future_y < 0 || ahead_future_y > side
					const left_future_x = entity.state.x + Math.cos(entity.state.angle - Math.PI / 2) * 10
					const left_future_y = entity.state.y + Math.sin(entity.state.angle - Math.PI / 2) * 10
					const has_wall_left = left_future_x < 0 || left_future_x > side || left_future_y < 0 || left_future_y > side
					const right_future_x = entity.state.x + Math.cos(entity.state.angle + Math.PI / 2) * 10
					const right_future_y = entity.state.y + Math.sin(entity.state.angle + Math.PI / 2) * 10
					const has_wall_right = right_future_x < 0 || right_future_x > side || right_future_y < 0 || right_future_y > side
					entity.tick([
						+has_wall_left,
						+has_wall_ahead,
						+has_wall_right,
						0,
						0,
						0,
					])
					if (entity.state.x < 0) entity.state.x = 0
					if (entity.state.x > side) entity.state.x = side
					if (entity.state.y < 0) entity.state.y = 0
					if (entity.state.y > side) entity.state.y = side
					entity.draw(ctx)
				}
			})
		}

		const makeRandomStart = () => ({
			x: Math.random() * side,
			y: Math.random() * side,
			angle: Math.random() * Math.PI * 2,
		})

		const entities = Array.from({ length: 2000 }, () => makeEntity(makeRandomGenome(), makeRandomStart()))

		let rafId: number
		let rendered = true
		void (async () => {
			for (let iter = 0; iter < 100; iter++) {
				await new Promise<void>(resolve => start(1000, resolve))
				if (!rendered) return
				const generation_size = 10
				const best = entities.map(e => {
					const score = Math.hypot(e.state.x - e.initial.x, e.state.y - e.initial.y)
					return [score, e.genome] as const
				}).filter(([score]) => score > 0).sort(([a], [b]) => b - a).slice(0, generation_size)
				for (let i = best.length; i < generation_size; i++) {
					best.push([0, makeRandomGenome()])
				}
				// const totalScore = best.reduce((accu, [score]) => accu + score, 0)
				let i = 0
				for (const [, genome] of best) {
					for (let j = 0; j < 100; j++) {
						entities[i] = makeEntity(genome, makeRandomStart())
						i++
					}
					for (let j = 0; j < 100; j++) {
						entities[i] = makeEntity(mutate(genome), makeRandomStart())
						i++
					}
				}
			}
		})()

		return () => {
			cancelAnimationFrame(rafId)
			rendered = false
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

/*
 * Innate nodes:
 * - inputs:
 *   - 0: wall left
 *   - 1: wall ahead
 *   - 2: wall right
 *   - 3: food left
 *   - 4: food ahead
 *   - 5: food right
 * - outputs:
 *   - 6: rotate left
 *   - 7: rotate right
 *   - 8: move ahead
 * 
 * 
 * NODE GENE: 0 - index - aggregation - activation
 * CONN GENE: 1 - from - to - weight
 * 
 * Example genome:
 * [
 *   // first gene
 *   0, // node gene
 *   9, // index of node (must start after all innate nodes)
 *   0, // sum aggregation (index in AGGREGATIONS)
 *   0, // identity activation (index in ACTIVATIONS)
 *   // second gene
 *   1, // connexion gene
 *   0, // from 'wall left' input node
 *   9, // to node 9 (first node in genome)
 *   128, // 0.5 weight (assuming Uint8Array is used)
 * ]
 */

const INNATE_NODES = 9

function makeEntity(genome: Type, state: { x: number, y: number, angle: number }) {
	let nodes = 0
	const graph: Array<{
		aggregation: (arr: number[]) => number
		activation: (x: number) => number
		incoming: [from: number, weight: number][]
	}> = []

	const initial = { x: state.x, y: state.y }

	for (let i = 0; i < genome.length; i++) {
		const allele = genome[i]

		// node gene
		if (allele === 0) {
			nodes++
			const index = genome[i + 1]
			const aggregation = AGGREGATIONS[genome[i + 2]]
			const activation = ACTIVATIONS[genome[i + 3]]
			if (typeof activation !== "function") {
				throw new Error(`Invalid activation function: ${activation} @ ${genome[i + 3]}`)
			}
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
			i += 3 // skip index, aggregation, activation
		}

		// connection gene
		else if (allele === 1) {
			const from = genome[i + 1]
			const to = genome[i + 2]
			const weight = genome[i + 3]
			graph[to] ??= {
				incoming: [],
				aggregation: AGGREGATIONS[0],
				activation: ACTIVATIONS[0],
			}
			graph[to].incoming.push([
				from,
				weight / MAX,
			])
			i += 3 // skip from, to, weight
		}

		else {
			throw new Error(`Unknown gene type allele: ${allele}`)
		}
	}

	const memory = new Float32Array(nodes + INNATE_NODES).fill(0)
	const current = new Float32Array(nodes + INNATE_NODES).fill(0)

	function tick(inputs: number[]) {
		for (let i = 0; i < inputs.length; i++) {
			memory[i] = inputs[i]
		}
		current.fill(0)
		for (let i = 0; i < graph.length; i++) {
			const node = graph[i]
			if (!node) continue
			let value = 0
			for (const [from, weight] of node.incoming) {
				value += memory[from] * weight
			}
			value = node.aggregation([value, memory[i]])
			if (typeof node.activation !== "function") {
				console.log({ node, i, graph })
				throw new Error(`Invalid activation function: ${node.activation} @ ${i}`)
			}
			value = node.activation(value)
			current[i] = value
		}
		memory.set(current)

		state.angle += (current[7] - current[6]) * Math.PI / 180
		const speed = Math.min(1, Math.max(0, current[8] / MAX))
		if (speed > 0) {
			state.x += Math.cos(state.angle) * speed
			state.y += Math.sin(state.angle) * speed
		}
	}

	function draw(ctx: CanvasRenderingContext2D) {
		ctx.save()
		ctx.translate(state.x, state.y)
		ctx.rotate(state.angle)
		ctx.fillStyle = 'white'
		ctx.fillRect(-5, -5, 10, 10)
		ctx.restore()

		ctx.save()
		ctx.translate(state.x, state.y)
		ctx.rotate(state.angle)
		ctx.fillStyle = 'red'
		ctx.fillRect(-2.5, -2.5, 5, 5)
		ctx.restore()
	}

	return {
		tick,
		draw,
		state,
		initial,
		genome,
	}
}

function mutate(genome: Type): Type {
	const kind = Math.random()

	const getNodeCount = () => {
		let nodeIndex = 0
		for (let i = 0; i < genome.length; i++) {
			if (genome[i] === 0) {
				nodeIndex++
			}
			i += 3
		}
		return nodeIndex
	}
	const getConnectionCount = () => {
		let connIndex = 0
		for (let i = 0; i < genome.length; i++) {
			if (genome[i] === 1) {
				connIndex++
			}
			i += 3
		}
		return connIndex
	}

	// add node
	if (kind < 0.1) {
		const result = new Type(genome.length + 4)
		result.set(genome)
		const index = getNodeCount()
		result[genome.length] = 0 // node gene
		result[genome.length + 1] = index + INNATE_NODES // index of node
		result[genome.length + 2] = Math.floor(Math.random() * AGGREGATIONS.length) // aggregation
		result[genome.length + 3] = Math.floor(Math.random() * ACTIVATIONS.length) // activation
		return result
	}

	// remove node
	else if (kind < 0.2) {
		const result = new Type(genome.length - 4)
		const total = getNodeCount()
		const index = Math.floor(Math.random() * total)
		for (let i = 0, j = 0; i < genome.length; i++, j++) {
			if (genome[i] === 0 && genome[i + 1] === index) {
				i += 3 // skip node gene
				j -= 1
				continue
			}
			result[j] = genome[i]
			result[j + 1] = genome[i + 1]
			result[j + 2] = genome[i + 2]
			result[j + 3] = genome[i + 3]
			j += 3 // skip index, aggregation, activation
			i += 3
		}
		return result
	}

	// add connection
	else if (kind < 0.3) {
		const result = new Type(genome.length + 4)
		const total = getNodeCount()
		const from = Math.floor(Math.random() * total)
		const to = Math.floor(Math.random() * total)
		result.set(genome)
		result[genome.length] = 1 // connection gene
		result[genome.length + 1] = from // from
		result[genome.length + 2] = to // to
		result[genome.length + 3] = Math.floor(Math.random() * MAX) // weight
		return result
	}

	// remove connection
	else if (kind < 0.4) {
		const result = new Type(genome.length - 4)
		const total = getConnectionCount()
		const index = Math.floor(Math.random() * total)
		let current = 0
		for (let i = 0, j = 0; i < genome.length; i++, j++) {
			if (genome[i] === 1) {
				if (current === index) {
					i += 3 // skip connection gene
					j -= 1
					current++
					continue
				}
				current++
			}
			result[j] = genome[i]
			result[j + 1] = genome[i + 1]
			result[j + 2] = genome[i + 2]
			result[j + 3] = genome[i + 3]
			j += 3 // skip from, to, weight
			i += 3
		}
		return result
	}

	// change node aggregation
	else if (kind < 0.5) {
		const result = new Type(genome.length)
		const total = getNodeCount()
		const index = Math.floor(Math.random() * total)
		for (let i = 0; i < genome.length; i++) {
			if (genome[i] === 0 && genome[i + 1] === index) {
				result[i] = genome[i]
				result[i + 1] = genome[i + 1]
				result[i + 2] = Math.floor(Math.random() * AGGREGATIONS.length)
				result[i + 3] = genome[i + 3]
				i += 3 // skip node gene
			} else {
				result[i] = genome[i]
				result[i + 1] = genome[i + 1]
				result[i + 2] = genome[i + 2]
				result[i + 3] = genome[i + 3]
				i += 3 // skip gene
			}
		}
		return result
	}

	// change node activation
	else if (kind < 0.6) {
		const result = new Type(genome.length)
		const total = getNodeCount()
		const index = Math.floor(Math.random() * total)
		for (let i = 0; i < genome.length; i++) {
			if (genome[i] === 0 && genome[i + 1] === index) {
				result[i] = genome[i]
				result[i + 1] = genome[i + 1]
				result[i + 2] = genome[i + 2]
				result[i + 3] = Math.floor(Math.random() * ACTIVATIONS.length)
				i += 3 // skip node gene
			} else {
				result[i] = genome[i]
				result[i + 1] = genome[i + 1]
				result[i + 2] = genome[i + 2]
				result[i + 3] = genome[i + 3]
				i += 3 // skip gene
			}
		}
		return result
	}

	// change connection nodes
	else if (kind < 0.7) {
		const result = new Type(genome.length)
		const total = getConnectionCount()
		const index = Math.floor(Math.random() * total)
		let current = 0
		for (let i = 0; i < genome.length; i++) {
			if (genome[i] === 1) {
				if (current === index) {
					result[i] = genome[i]
					if (Math.random() < 0.5) {
						result[i + 1] = Math.floor(Math.random() * getNodeCount())
						result[i + 2] = genome[i + 2]
					} else {
						result[i + 1] = genome[i + 1]
						result[i + 2] = Math.floor(Math.random() * getNodeCount())
					}
					result[i + 3] = genome[i + 3]
					i += 3 // skip connection gene
					current++
					continue
				} else {
					current++
				}
			}
			result[i] = genome[i]
			result[i + 1] = genome[i + 1]
			result[i + 2] = genome[i + 2]
			result[i + 3] = genome[i + 3]
			i += 3 // skip gene
		}
		return result
	}

	// change connection weight
	else {
		const result = new Type(genome.length)
		const total = getConnectionCount()
		const index = Math.floor(Math.random() * total)
		let current = 0
		for (let i = 0; i < genome.length; i++) {
			if (genome[i] === 1) {
				if (current === index) {
					result[i] = genome[i]
					result[i + 1] = genome[i + 1]
					result[i + 2] = genome[i + 2]
					result[i + 3] = Math.floor(Math.random() * MAX)
					i += 3 // skip connection gene
					current++
					continue
				} else {
					current++
				}
			}
			result[i] = genome[i]
			result[i + 1] = genome[i + 1]
			result[i + 2] = genome[i + 2]
			result[i + 3] = genome[i + 3]
			i += 3 // skip gene
		}
		return result
	}
}

function makeRandomGenome() {
	const nodes = Math.floor(Math.random() * 10) + 1
	const connections = Math.floor(Math.random() * 10) + 1
	const genome = new Type(nodes * 4 + connections * 4).fill(0)
	for (let i = 0; i < nodes; i++) {
		genome[i * 4] = 0 // node gene
		genome[i * 4 + 1] = i + INNATE_NODES // index of node
		genome[i * 4 + 2] = Math.floor(Math.random() * AGGREGATIONS.length) // aggregation
		genome[i * 4 + 3] = Math.floor(Math.random() * ACTIVATIONS.length) // activation
	}
	const offset = nodes * 4
	for (let i = 0; i < connections; i++) {
		genome[offset + i * 4] = 1 // connection gene
		genome[offset + i * 4 + 1] = Math.floor(Math.random() * nodes) // from
		genome[offset + i * 4 + 2] = Math.floor(Math.random() * nodes) // to
		genome[offset + i * 4 + 3] = Math.floor(Math.random() * MAX) // weight
		if (genome[offset + i * 4 + 2] === 8) console.log('to forward node')
	}
	return genome
}

const Type = Uint8Array
type Type = InstanceType<typeof Type>

const MAX = 2 ** (Type.BYTES_PER_ELEMENT * 8) - 1

const ACTIVATIONS: Array<(x: number) => number> = [
	/*'identity': */x => x,
	/*'abs': */     x => Math.abs(x),
	/*'clamped': */ x => Math.min(1, Math.max(-1, x)),
	/*'cube': */    x => Math.pow(x, 3),
	/*'exp': */     x => Math.exp(x),
	/*'gauss': */ // x => x,
	/*'hat': */     x => Math.max(0, x < 0 ? 1 + x : 1 - x),
	/*'inv': */     x => 1 / x,
	/*'log': */     x => Math.log(x),
	/*'relu': */    x => x < 0 ? 0 : x,
	/*'elu': */     x => x < 0 ? Math.exp(x) - 1 : x,
	/*'lelu': */ // x => x,
	/*'selu': */ // x => x,
	/*'sigmoid': */ x => Math.tanh(x) / 2 + 1,
	/*'sin': */     x => Math.sin(x),
	/*'softplus': */ // x => x,
	/*'square': */  x => Math.pow(x, 2),
	/*'tanh': */    x => Math.tanh(x),
	/*'binary': */  x => x < 0 ? 0 : 1
]
const AGGREGATIONS: Array<(arr: number[]) => number> = [
	/* 'sum': */    arr => arr.reduce((accu, curr) => accu + curr, 0),
	/* 'mean': */   arr => arr.reduce((accu, curr) => accu + curr, 0) / arr.length,
	/* 'product': */arr => arr.reduce((accu, curr) => accu * curr, 1),
	/* 'max': */    arr => Math.max(...arr),
	/* 'min': */    arr => Math.min(...arr),
	/* 'maxabs': */ arr => Math.max(...arr.map(Math.abs)),
	/* 'median': */ arr => arr.sort()[Math.ceil(arr.length / 2)]
]