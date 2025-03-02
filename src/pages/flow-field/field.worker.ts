/// <reference lib="webworker" />

import { fieldMap } from "./utils"

export type Incoming =
	| {
		type: "init",
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
	| { type: "clear", data: undefined }
	| { type: "query", data: { x: number, y: number } }


let grid: Uint8Array
let field: Uint8Array
let integration: Uint8Array
let xLength: number
let yLength: number
let layers: number
let computed: boolean[]

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
			computed = new Array(layers).fill(false)
			const workerIndex = event.data.index
			const workerIndexX = event.data.wx
			const workerIndexY = event.data.wy
			field = new Uint8Array(event.data.field, workerIndex * layers * layers, layers * layers)
			integration = new Uint8Array(layers * xLength * yLength).fill(maxIntegration)
			grid = new Uint8Array(xLength * yLength)
			gridBuffer = event.data.grid
			copyGrid()
			console.log('worker init', workerIndex, {
				side,
				x1,
				x2,
				y1,
				y2,
				layers,
				workerIndex,
				workerIndexX,
				workerIndexY,
			})
		} else if (event.type === "clear") {
			integration.fill(maxIntegration)
			computed.fill(false)
			copyGrid()
		} else if (event.type === "query") {
			const localX = event.data.x - x1
			const localY = event.data.y - y1
			compute(localX, localY)
		}
	}
}

function compute(x: number, y: number) {
	const l = y * xLength + x
	if (computed[l]) return
	const offset = l * layers
	const integration = computeIntegration(offset, x, y)
	computeField(offset, x, y, integration)
	computed[l] = true
}

function computeField(offset: number, goalX: number, goalY: number, integration: Uint8Array) {
	// const before = performance.now()
	for (let y = 0; y < yLength; y++) {
		const row = y * xLength
		for (let x = 0; x < xLength; x++) {
			const index = row + x
			if (x === goalX && y === goalY) {
				field[offset + index] = fieldMap[0][0]
				continue
			}
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
					}
				}
			}
			field[offset + index] = fieldMap[minx][miny]
		}
	}
	// const after = performance.now()
	// console.log('computeField', workerIndex, after - before)
}

function computeIntegration(offset: number, goalX: number, goalY: number) {
	const results = new Uint8Array(integration.buffer, offset, layers)
	// const before = performance.now()
	const queue = [goalX, goalY]
	results[goalY * xLength + goalX] = 0
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