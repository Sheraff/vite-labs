/*
 * Constants and functions for NEAT-GPU implementation
 */

export const MAX_GENES = 30 // Maximum genes per genome (120 f32 elements)
export const INNATE_NODES = 9 // 6 inputs + 3 outputs
export const MAX_NODES = MAX_GENES + INNATE_NODES // Maximum possible nodes
export const FOOD_COUNT = 200
export const WORLD_SIZE = 300
export const POPULATION = 1000
export const ITERATIONS = 2000
export const STORE_PER_GENERATION = 4 // Top genomes to store for visualization
export const BREED_PARENTS = Math.round(POPULATION * 0.1) // 10% survival rate for breeding

export const INPUT_NODES = ["food left", "food ahead", "food right", "wall left", "wall ahead", "wall right"]
export const OUTPUT_NODES = ["rotate left", "rotate right", "move ahead"]

export const MAX = 255 // Maximum weight value (0-255)

export const ACTIVATIONS: Array<(x: number) => number> = [
	/*'identity': */ (x) => x,
	/*'opposite': */ (x) => -x,
	/*'abs': */ (x) => Math.abs(x),
	/*'clamped': */ (x) => Math.min(1, Math.max(-1, x)),
	/*'cube': */ (x) => Math.pow(x, 3),
	/*'exp': */ (x) => Math.exp(x),
	/*'gauss': */ (x) => Math.exp(-(x * x)),
	/*'hat': */ (x) => Math.max(0, x < 0 ? 1 + x : 1 - x),
	/*'inv': */ (x) => (x !== 0 ? 1 / x : 0),
	/*'log': */ (x) => (x > 0 ? Math.log(x) : 0),
	/*'relu': */ (x) => (x < 0 ? 0 : x),
	/*'elu': */ (x) => (x < 0 ? Math.exp(x) - 1 : x),
	/*'lelu': */ (x) => (x < 0 ? 0.01 * x : x),
	/*'selu': */ (x) => 1.0507 * (x >= 0 ? x : 1.67326 * (Math.exp(x) - 1)),
	/*'sigmoid': */ (x) => 1 / (1 + Math.exp(-x)),
	/*'sin': */ (x) => Math.sin(x),
	/*'softplus': */ (x) => Math.log(1 + Math.exp(x)),
	/*'square': */ (x) => Math.pow(x, 2),
	/*'tanh': */ (x) => Math.tanh(x),
	/*'binary': */ (x) => (x < 0 ? 0 : 1),
	/*'swish': */ (x) => x / (1 + Math.exp(-x)),
	/*'mish': */ (x) => x * Math.tanh(Math.log(1 + Math.exp(x))),
	/*'softsign': */ (x) => x / (1 + Math.abs(x)),
	/*'bentid': */ (x) => (Math.sqrt(Math.pow(x, 2) + 1) - 1) / 2 + x,
	/*'sinc': */ (x) => (x !== 0 ? Math.sin(x) / x : 1),
	/*'gelu': */ (x) => 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * Math.pow(x, 3)))),
	/*'hardtanh': */ (x) => Math.max(-1, Math.min(1, x)),
	/*'hardsig': */ (x) => Math.max(0, Math.min(1, 0.2 * x + 0.5)),
	/*'step': */ (x) => (x >= 0 ? 1 : 0),
]

export const AGGREGATIONS: Array<(arr: number[]) => number> = [
	/* 'sum': */ (arr) => arr.reduce((accu, curr) => accu + curr, 0),
	/* 'mean': */ (arr) => arr.reduce((accu, curr) => accu + curr, 0) / arr.length,
	/* 'product': */ (arr) => arr.reduce((accu, curr) => accu * curr, 1),
	/* 'max': */ (arr) => Math.max(...arr),
	/* 'min': */ (arr) => Math.min(...arr),
	/* 'maxabs': */ (arr) => Math.max(...arr.map(Math.abs)),
	/* 'median': */ (arr) => arr.sort()[Math.ceil(arr.length / 2)],
	/* 'medianabs': */ (arr) => arr.map(Math.abs).sort()[Math.ceil(arr.length / 2)],
	/* 'mode': */ (arr) => {
		const counts: Record<number, number> = {}
		for (const value of arr) {
			counts[value] = (counts[value] || 0) + 1
		}
		const maxCount = Math.max(...Object.values(counts))
		return Number(Object.entries(counts).find(([_, count]) => count === maxCount)?.[0])
	},
	/* 'modeabs': */ (arr) => {
		const counts: Record<number, number> = {}
		for (const value of arr) {
			counts[Math.abs(value)] = (counts[Math.abs(value)] || 0) + 1
		}
		const maxCount = Math.max(...Object.values(counts))
		return Number(Object.entries(counts).find(([_, count]) => count === maxCount)?.[0])
	},
	/* 'variance': */ (arr) => {
		if (arr.length <= 1) return 0
		const mean = arr.reduce((sum, val) => sum + val, 0) / arr.length
		return arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length
	},
	/* 'stddev': */ (arr) => {
		if (arr.length <= 1) return 0
		const mean = arr.reduce((sum, val) => sum + val, 0) / arr.length
		return Math.sqrt(arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length)
	},
	/* 'rms': */ (arr) => {
		if (arr.length === 0) return 0
		return Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0) / arr.length)
	},
	/* 'range': */ (arr) => {
		if (arr.length === 0) return 0
		return Math.max(...arr) - Math.min(...arr)
	},
	/* 'geometric_mean': */ (arr) => {
		if (arr.length === 0) return 0
		// Filter out negative values and zeros
		const positiveValues = arr.filter((val) => val > 0)
		if (positiveValues.length === 0) return 0
		return Math.pow(
			positiveValues.reduce((prod, val) => prod * val, 1),
			1 / positiveValues.length,
		)
	},
	/* 'harmonic_mean': */ (arr) => {
		// Filter out zeros to avoid division by zero
		const nonZeroVals = arr.filter((val) => val !== 0)
		if (nonZeroVals.length === 0) return 0
		return nonZeroVals.length / nonZeroVals.reduce((sum, val) => sum + 1 / val, 0)
	},
	/* 'top2': */ (arr) => {
		if (arr.length === 0) return 0
		if (arr.length === 1) return arr[0]
		const sorted = [...arr].sort((a, b) => b - a)
		return sorted[0] + sorted[1]
	},
	/* 'softmax_sum': */ (arr) => {
		if (arr.length === 0) return 0
		const maxVal = Math.max(...arr)
		const expValues = arr.map((val) => Math.exp(val - maxVal)) // Subtract max for numerical stability
		const sumExp = expValues.reduce((sum, val) => sum + val, 0)
		return expValues.reduce((sum, val, i) => sum + (val / sumExp) * arr[i], 0)
	},
]
