/// <reference lib="webworker" />

import { fieldMap } from "./utils"

export type Incoming =
	| {
			type: "init"
			data: {
				side: number
				grid: SharedArrayBuffer
				field: SharedArrayBuffer
				range: [x1: number, x2: number, y1: number, y2: number]
				index: number
				wx: number
				wy: number
			}
	  }
	| { type: "clear"; data: undefined }
	| {
			type: "query"
			data: {
				goals: Array<[x: number, y: number]>
				layer: number
			}
	  }

let grid: Uint8Array
let field: Uint8Array
let integration: Uint8Array
let xLength: number
let yLength: number
let layers: number

const maxCost = 2 ** (Uint8Array.BYTES_PER_ELEMENT * 8) - 1
const maxIntegration = 2 ** (Uint8Array.BYTES_PER_ELEMENT * 8) - 1

{
	let side: number
	let x1: number
	let x2: number
	let y1: number
	let y2: number
	let gridBuffer: SharedArrayBuffer

	self.onmessage = (e: MessageEvent<Incoming>) => handleMessage(e.data)

	function copyGrid() {
		const gridView = new Uint8Array(gridBuffer)
		for (let y = y1; y <= y2; y++) {
			const row = y * side
			for (let x = x1; x <= x2; x++) {
				const index = row + x
				grid[(y - y1) * xLength + (x - x1)] = gridView[index]
			}
		}
	}

	function handleMessage(event: Incoming) {
		if (event.type === "init") {
			side = event.data.side
			x1 = event.data.range[0]
			x2 = event.data.range[1]
			y1 = event.data.range[2]
			y2 = event.data.range[3]
			xLength = x2 - x1 + 1
			yLength = y2 - y1 + 1
			layers = xLength * yLength
			const workerIndex = event.data.index
			// const workerIndexX = event.data.wx
			// const workerIndexY = event.data.wy
			field = new Uint8Array(event.data.field, workerIndex * layers * layers, layers * layers)
			integration = new Uint8Array(layers * xLength * yLength).fill(maxIntegration)
			grid = new Uint8Array(xLength * yLength)
			gridBuffer = event.data.grid
			copyGrid()
			// console.log('worker init', workerIndex, {
			// 	side,
			// 	x1,
			// 	x2,
			// 	y1,
			// 	y2,
			// 	layers,
			// 	workerIndex,
			// 	workerIndexX,
			// 	workerIndexY,
			// })
		} else if (event.type === "clear") {
			integration.fill(maxIntegration)
			copyGrid()
		} else if (event.type === "query") {
			const goals = event.data.goals
			for (let i = 0; i < goals.length; i++) {
				goals[i][0] -= x1
				goals[i][1] -= y1
			}
			compute(goals, event.data.layer)
		}
	}
}

function compute(goals: Array<[x: number, y: number]>, layer: number) {
	const offset = layer * layers
	const integration = computeIntegration(offset, goals)
	computeField(offset, goals, integration)
}

function computeField(offset: number, goals: Array<[x: number, y: number]>, integration: Uint8Array) {
	// const before = performance.now()
	const seen = new Set()
	for (let i = 0; i < goals.length; i++) {
		const [x, y] = goals[i]
		const index = y * xLength + x
		field[offset + index] = fieldMap[0][0]
		seen.add(index)
	}
	for (let y = 0; y < yLength; y++) {
		const row = y * xLength
		for (let x = 0; x < xLength; x++) {
			const index = row + x
			if (seen.has(index)) continue
			let min = maxIntegration
			let minx = 0
			let miny = 0
			for (let i = -1; i <= 1; i++) {
				for (let j = -1; j <= 1; j++) {
					if (i === 0 && j === 0) continue
					const dx = x + i
					if (dx < 0 || dx >= xLength) continue
					const dy = y + j
					if (dy < 0 || dy >= yLength) continue
					const index = dy * xLength + dx
					const cost = grid[index]
					if (cost === maxCost) continue
					const value = integration[index]
					if (value < min) {
						min = value
						minx = i
						miny = j
					} else if (value === min && Math.abs(i) + Math.abs(j) < Math.abs(minx) + Math.abs(miny)) {
						minx = i
						miny = j
					}
				}
			}
			field[offset + index] = fieldMap[minx][miny]
		}
	}
	// const after = performance.now()
	// console.log('computeField', workerIndex, after - before)
}

function computeIntegration(offset: number, goals: Array<[x: number, y: number]>) {
	const results = new Uint8Array(integration.buffer, offset, layers)
	results.fill(maxIntegration)
	// const before = performance.now()
	const queue: number[] = []
	for (let i = 0; i < goals.length; i++) {
		const [x, y] = goals[i]
		queue.push(x, y)
		results[y * xLength + x] = 0
	}
	while (queue.length > 0) {
		const x = queue.shift()!
		const y = queue.shift()!
		const index = y * xLength + x
		const value = results[index]
		west: {
			if (x === 0) break west
			const neighbor = index - 1
			const cost = grid[neighbor] || 1
			if (cost !== maxCost) {
				const next = value + cost
				const prev = results[neighbor]
				if (next < prev) {
					results[neighbor] = next
					queue.push(x - 1, y)
				}
			}
		}
		east: {
			if (x === xLength - 1) break east
			const neighbor = index + 1
			const cost = grid[neighbor] || 1
			if (cost !== maxCost) {
				const next = value + cost
				const prev = results[neighbor]
				if (next < prev) {
					results[neighbor] = next
					queue.push(x + 1, y)
				}
			}
		}
		north: {
			if (y === 0) break north
			const neighbor = index - xLength
			const cost = grid[neighbor] || 1
			if (cost !== maxCost) {
				const next = value + cost
				const prev = results[neighbor]
				if (next < prev) {
					results[neighbor] = next
					queue.push(x, y - 1)
				}
			}
		}
		south: {
			if (y === yLength - 1) break south
			const neighbor = index + xLength
			const cost = grid[neighbor] || 1
			if (cost !== maxCost) {
				const next = value + cost
				const prev = results[neighbor]
				if (next < prev) {
					results[neighbor] = next
					queue.push(x, y + 1)
				}
			}
		}
	}
	// const after = performance.now()
	// console.log('computeIntegration', workerIndex, after - before)
	return results
}
