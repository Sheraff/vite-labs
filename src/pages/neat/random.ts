import { ACTIVATIONS, AGGREGATIONS, INNATE_NODES, MAX, Type } from "@neat/constants"

export function mutate(genome: Type): Type {
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

export function makeRandomGenome() {
	const nodes = Math.floor(Math.random() * 10) + 1
	const connections = Math.floor(Math.random() * 20) + 1
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
		genome[offset + i * 4 + 2] = i === 0
			? 8
			: Math.floor(Math.random() * nodes) // to
		genome[offset + i * 4 + 3] = Math.floor(Math.random() * MAX) // weight
		if (genome[offset + i * 4 + 2] === 8) {
			console.log('to forward node')
		}
	}
	return genome
}
