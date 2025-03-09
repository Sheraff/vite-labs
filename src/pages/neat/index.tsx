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

		const start = async (opts: { iterations: number, draw: boolean }, cb: () => void) => {
			while (opts.iterations > 0) {
				if (controller.signal.aborted) return
				if (opts.iterations === 0) return
				if (opts.draw) ctx.clearRect(0, 0, canvas.width, canvas.height)
				opts.iterations--
				if (opts.iterations % 100 === 0) {
					console.log(opts.iterations, 'ticks')
				}

				for (const entity of entities) {
					if (!entity.state.alive) continue
					if (entity.state.x < 0) entity.state.alive = false
					if (entity.state.x > side) entity.state.alive = false
					if (entity.state.y < 0) entity.state.alive = false
					if (entity.state.y > side) entity.state.alive = false
					if (entity.state.angle < 0) entity.state.angle = (-((-entity.state.angle) % (Math.PI * 2))) + Math.PI * 2
					if (entity.state.angle > Math.PI * 2) entity.state.angle %= Math.PI * 2

					let has_wall_left = false
					let has_wall_ahead = false
					let has_wall_right = false
					const angle = -entity.state.angle + Math.PI / 2
					{
						const ahead_future_x = entity.state.x + Math.sin(angle) * 100
						const ahead_future_y = entity.state.y + Math.cos(angle) * 100
						has_wall_ahead = ahead_future_x < 0 || ahead_future_x > side || ahead_future_y < 0 || ahead_future_y > side
					}
					if (!has_wall_ahead) {
						const left_future_x = entity.state.x + Math.sin(angle + Math.PI / 2) * 100
						const left_future_y = entity.state.y + Math.cos(angle + Math.PI / 2) * 100
						has_wall_left = left_future_x < 0 || left_future_x > side || left_future_y < 0 || left_future_y > side
						if (!has_wall_left) {
							const right_future_x = entity.state.x + Math.sin(angle - Math.PI / 2) * 100
							const right_future_y = entity.state.y + Math.cos(angle - Math.PI / 2) * 100
							has_wall_right = right_future_x < 0 || right_future_x > side || right_future_y < 0 || right_future_y > side
						}
					}

					entity.tick([
						+has_wall_left,
						+has_wall_ahead,
						+has_wall_right,
						0,
						0,
						0,
					])

					if (opts.iterations % 10 === 0) {
						entity.state.history.push(entity.state.x, entity.state.y)
						if (entity.state.history.length >= 20) {
							const firstx = entity.state.history.shift()!
							const firsty = entity.state.history.shift()!
							const distance = Math.hypot(entity.state.x - firstx, entity.state.y - firsty)
							entity.state.score += distance
						}
					}

					if (opts.draw) entity.draw(ctx)
				}

				if (opts.draw) {
					await new Promise((r) => requestAnimationFrame(r))
				}
			}
			cb()
		}

		const controller = new AbortController()

		const makeRandomStart = () => ({
			x: Math.random() * side,
			y: Math.random() * side,
			angle: Math.random() * Math.PI * 2,
		})

		const count = 2000

		const entities = Array.from({ length: count }, () => makeEntity(makeRandomGenome(), makeRandomStart()))

		void (async () => {
			for (let iter = 0; iter < 1000; iter++) {
				const draw = iter % 10 === 0
				await new Promise<void>(resolve => start({ draw, iterations: 1300 }, resolve))
				if (controller.signal.aborted) return
				const generation_size = 20
				const best = entities.map(e => {
					const score = e.state.alive
						? e.state.score * Math.hypot(e.state.x - e.initial.x, e.state.y - e.initial.y)
						: 0
					return [score, e.genome] as const
				}).filter(([score]) => score > 0).sort(([a], [b]) => b - a).slice(0, generation_size)
				// for (let i = best.length; i < generation_size; i++) {
				// 	best.push([0, makeRandomGenome()])
				// }
				// const totalScore = best.reduce((accu, [score]) => accu + score, 0)
				let i = 0
				const copies = 20
				const mutations = 70
				for (const [, genome] of best) {
					for (let j = 0; j < copies; j++) {
						entities[i] = makeEntity(genome, makeRandomStart())
						i++
					}
					for (let j = 0; j < mutations; j++) {
						entities[i] = makeEntity(mutate(genome), makeRandomStart())
						i++
					}
				}
				for (; i < count; i++) {
					entities[i] = makeEntity(makeRandomGenome(), makeRandomStart())
				}
			}
		})()

		// const entity = makeEntity(makeRandomGenome(), { angle: 3.14, x: side / 2, y: side / 2 })
		// const mouse = { x: 0, y: 0 }
		// window.addEventListener('mousemove', (e) => {
		// 	const { x, y } = canvas.getBoundingClientRect()
		// 	mouse.x = (e.clientX - x) * devicePixelRatio
		// 	mouse.y = (e.clientY - y) * devicePixelRatio
		// }, { signal: controller.signal })
		// requestAnimationFrame(function loop() {
		// 	if (controller.signal.aborted) return
		// 	requestAnimationFrame(loop)
		// 	ctx.clearRect(0, 0, canvas.width, canvas.height)
		// 	ctx.fillStyle = 'red'
		// 	// ctx.fillRect(mouse.x - 5, mouse.y - 5, 10, 10)

		// 	entity.state.x = mouse.x
		// 	entity.state.y = mouse.y

		// 	entity.draw(ctx)

		// 	const angle = -entity.state.angle + Math.PI / 2
		// 	const ahead_future_x = entity.state.x + Math.sin(angle) * 100
		// 	const ahead_future_y = entity.state.y + Math.cos(angle) * 100
		// 	const has_wall_ahead = ahead_future_x < 0 || ahead_future_x > side || ahead_future_y < 0 || ahead_future_y > side
		// 	const left_future_x = entity.state.x + Math.sin(angle + Math.PI / 2) * 100
		// 	const left_future_y = entity.state.y + Math.cos(angle + Math.PI / 2) * 100
		// 	const has_wall_left = left_future_x < 0 || left_future_x > side || left_future_y < 0 || left_future_y > side
		// 	const right_future_x = entity.state.x + Math.sin(angle - Math.PI / 2) * 100
		// 	const right_future_y = entity.state.y + Math.cos(angle - Math.PI / 2) * 100
		// 	const has_wall_right = right_future_x < 0 || right_future_x > side || right_future_y < 0 || right_future_y > side

		// 	// const angle_to_mouse = Math.atan2(mouse.y - entity.state.y, mouse.x - entity.state.x) + Math.PI / 2 - entity.state.angle

		// 	// const distance_to_mouse = Math.hypot(mouse.x - entity.state.x, mouse.y - entity.state.y)
		// 	// const has_mouse_ahead = Math.abs(angle_to_mouse) < Math.PI / 5 && distance_to_mouse < 100
		// 	// const has_mouse_left = !has_mouse_ahead && angle_to_mouse < 0 && angle_to_mouse > - Math.PI / 2 && distance_to_mouse < 100
		// 	// const has_mouse_right = !has_mouse_ahead && angle_to_mouse > 0 && angle_to_mouse < Math.PI / 2 && distance_to_mouse < 100

		// 	let text = 'Logs:'
		// 	// text += `\n angle_to_mouse: ${angle_to_mouse}`
		// 	// text += `\n angle: ${entity.state.angle}`
		// 	if (has_wall_left) text += '\n wall left'
		// 	if (has_wall_ahead) text += '\n wall ahead'
		// 	if (has_wall_right) text += '\n wall right'
		// 	// if (has_mouse_left) text += '\n mouse left'
		// 	// if (has_mouse_ahead) text += '\n mouse ahead'
		// 	// if (has_mouse_right) text += '\n mouse right'
		// 	ctx.fillStyle = 'white'
		// 	ctx.font = '20px sans-serif'
		// 	ctx.fillText(text, 10, 20)
		// })

		return () => {
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

function makeEntity(genome: Type, initial: { x: number, y: number, angle: number }) {
	let nodes = 0
	const graph: Array<{
		aggregation: (arr: number[]) => number
		activation: (x: number) => number
		incoming: [from: number, weight: number][]
	}> = []

	const state = {
		x: initial.x,
		y: initial.y,
		angle: initial.angle,
		alive: true,
		score: 0,
		history: [] as number[],
	}

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

		const rotate = (Math.max(0, Math.min(current[7], 10)) - Math.max(0, Math.min(current[6], 10)))
		state.angle += rotate / 100
		const speed = Math.min(4, Math.max(0, current[8] / MAX))
		if (speed > 0) {
			state.x += Math.cos(state.angle) * speed
			state.y += Math.sin(state.angle) * speed
		}
	}

	function draw(ctx: CanvasRenderingContext2D) {
		// draw square at position, rotated by angle
		ctx.save()
		ctx.translate(state.x, state.y)
		ctx.rotate(state.angle)
		ctx.fillStyle = 'white'
		ctx.fillRect(-5, -5, 10, 10)
		ctx.restore()

		// draw small line ahead to indicate direction
		ctx.save()
		ctx.translate(state.x, state.y)
		ctx.rotate(state.angle)
		ctx.strokeStyle = 'red'
		ctx.lineWidth = 2
		ctx.beginPath()
		ctx.moveTo(0, 0)
		ctx.lineTo(100, 0)
		ctx.stroke()
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
	/*'opposite': */x => -x,
	/*'abs': */     x => Math.abs(x),
	/*'clamped': */ x => Math.min(1, Math.max(-1, x)),
	/*'cube': */    x => Math.pow(x, 3),
	/*'exp': */     x => Math.exp(x),
	/*'gauss': */   x => Math.exp(-(x * x)),
	/*'hat': */     x => Math.max(0, x < 0 ? 1 + x : 1 - x),
	/*'inv': */     x => x !== 0 ? 1 / x : 0,
	/*'log': */     x => x > 0 ? Math.log(x) : 0,
	/*'relu': */    x => x < 0 ? 0 : x,
	/*'elu': */     x => x < 0 ? Math.exp(x) - 1 : x,
	/*'lelu': */    x => x < 0 ? 0.01 * x : x,
	/*'selu': */    x => 1.0507 * (x >= 0 ? x : 1.67326 * (Math.exp(x) - 1)),
	/*'sigmoid': */ x => 1 / (1 + Math.exp(-x)),
	/*'sin': */     x => Math.sin(x),
	/*'softplus': */x => Math.log(1 + Math.exp(x)),
	/*'square': */  x => Math.pow(x, 2),
	/*'tanh': */    x => Math.tanh(x),
	/*'binary': */  x => x < 0 ? 0 : 1,
	/*'swish': */   x => x / (1 + Math.exp(-x)),
    /*'mish': */    x => x * Math.tanh(Math.log(1 + Math.exp(x))),
    /*'softsign': */x => x / (1 + Math.abs(x)),
    /*'bentid': */  x => (Math.sqrt(Math.pow(x, 2) + 1) - 1) / 2 + x,
    /*'sinc': */    x => x !== 0 ? Math.sin(x) / x : 1,
    /*'gelu': */    x => 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * Math.pow(x, 3)))),
    /*'hardtanh': */x => Math.max(-1, Math.min(1, x)),
    /*'hardsig': */ x => Math.max(0, Math.min(1, 0.2 * x + 0.5)),
    /*'step': */    x => x >= 0 ? 1 : 0,
]
const AGGREGATIONS: Array<(arr: number[]) => number> = [
	/* 'sum': */    arr => arr.reduce((accu, curr) => accu + curr, 0),
	/* 'mean': */   arr => arr.reduce((accu, curr) => accu + curr, 0) / arr.length,
	/* 'product': */arr => arr.reduce((accu, curr) => accu * curr, 1),
	/* 'max': */    arr => Math.max(...arr),
	/* 'min': */    arr => Math.min(...arr),
	/* 'maxabs': */ arr => Math.max(...arr.map(Math.abs)),
	/* 'median': */ arr => arr.sort()[Math.ceil(arr.length / 2)],
	/* 'medianabs': */ arr => arr.map(Math.abs).sort()[Math.ceil(arr.length / 2)],
	/* 'mode': */   arr => {
		const counts: Record<number, number> = {}
		for (const value of arr) {
			counts[value] = (counts[value] || 0) + 1
		}
		const maxCount = Math.max(...Object.values(counts))
		return Number(Object.entries(counts).find(([_, count]) => count === maxCount)?.[0])
	},
	/* 'modeabs': */ arr => {
		const counts: Record<number, number> = {}
		for (const value of arr) {
			counts[Math.abs(value)] = (counts[Math.abs(value)] || 0) + 1
		}
		const maxCount = Math.max(...Object.values(counts))
		return Number(Object.entries(counts).find(([_, count]) => count === maxCount)?.[0])
	},
	/* 'variance': */ arr => {
		if (arr.length <= 1) return 0
		const mean = arr.reduce((sum, val) => sum + val, 0) / arr.length
		return arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length
	},
	  /* 'stddev': */ arr => {
		if (arr.length <= 1) return 0
		const mean = arr.reduce((sum, val) => sum + val, 0) / arr.length
		return Math.sqrt(arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length)
	},
	  /* 'rms': */ arr => {
		if (arr.length === 0) return 0
		return Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0) / arr.length)
	},
	  /* 'range': */ arr => {
		if (arr.length === 0) return 0
		return Math.max(...arr) - Math.min(...arr)
	},
	  /* 'geometric_mean': */ arr => {
		if (arr.length === 0) return 0
		// Filter out negative values and zeros
		const positiveValues = arr.filter(val => val > 0)
		if (positiveValues.length === 0) return 0
		return Math.pow(positiveValues.reduce((prod, val) => prod * val, 1), 1 / positiveValues.length)
	},
	  /* 'harmonic_mean': */ arr => {
		// Filter out zeros to avoid division by zero
		const nonZeroVals = arr.filter(val => val !== 0)
		if (nonZeroVals.length === 0) return 0
		return nonZeroVals.length / nonZeroVals.reduce((sum, val) => sum + (1 / val), 0)
	},
	  /* 'top2': */ arr => {
		if (arr.length === 0) return 0
		if (arr.length === 1) return arr[0]
		const sorted = [...arr].sort((a, b) => b - a)
		return sorted[0] + sorted[1]
	},
	  /* 'softmax_sum': */ arr => {
		if (arr.length === 0) return 0
		const maxVal = Math.max(...arr)
		const expValues = arr.map(val => Math.exp(val - maxVal)) // Subtract max for numerical stability
		const sumExp = expValues.reduce((sum, val) => sum + val, 0)
		return expValues.reduce((sum, val, i) => sum + (val / sumExp) * arr[i], 0)
	},
]