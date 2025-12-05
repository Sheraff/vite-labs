import { ACTIVATIONS, AGGREGATIONS, INNATE_NODES, MAX, type Type } from "./constants"

export type Entity = ReturnType<typeof makeEntity>

export function makeStartState(side: number) {
	return {
		x: side / 2,
		y: side / 2,
		angle: 0,
	}
}

export function makeEntity(genome: Type, initial: { x: number; y: number; angle: number }) {
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
			graph[to].incoming.push([from, weight / MAX])
			i += 3 // skip from, to, weight
		} else {
			throw new Error(`Unknown gene type allele: ${allele}`)
		}
	}

	const memory = new Float32Array(nodes + INNATE_NODES).fill(0)
	const current = new Float32Array(nodes + INNATE_NODES).fill(0)

	function tick(inputs: number[]) {
		current.fill(0)
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

		const rotate = Math.max(0, Math.min(current[7], 10)) - Math.max(0, Math.min(current[6], 10))
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
		ctx.fillStyle = "white"
		ctx.fillRect(-5, -5, 10, 10)
		ctx.restore()

		// draw small line ahead to indicate direction
		ctx.save()
		ctx.translate(state.x, state.y)
		ctx.rotate(state.angle)
		ctx.strokeStyle = "red"
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
		memory,
	}
}
