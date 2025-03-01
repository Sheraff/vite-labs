/// <reference lib="webworker" />

import { fieldMap } from "./utils"

export type Incoming =
	| {
		type: "init",
		data: {
			side: number
			grid: SharedArrayBuffer
			field: SharedArrayBuffer
			integration: SharedArrayBuffer
			range: [x1: number, x2: number, y1: number, y2: number]
			index: number
			wx: number
			wy: number
		}
	}
	| { type: "clear", data: undefined }
	| { type: "query", data: { x: number, y: number } }


let side: number
let grid: Uint8Array
let field: Uint8Array
let integration: Uint8Array
let x1: number
let x2: number
let y1: number
let y2: number
let layers: number
let layerLength: number
let computed: boolean[]
let selfSide: number
let workerIndex: number
let workerIndexX: number
let workerIndexY: number

const maxCost = 2 ** (Uint8Array.BYTES_PER_ELEMENT * 8) - 1
const maxIntegration = 2 ** (Uint8Array.BYTES_PER_ELEMENT * 8) - 1

{
	self.onmessage = (e: MessageEvent<Incoming>) => handleMessage(e.data)

	function handleMessage(event: Incoming) {
		if (event.type === "init") {
			side = event.data.side
			grid = new Uint8Array(event.data.grid)
			field = new Uint8Array(event.data.field)
			integration = new Uint8Array(event.data.integration)
			x1 = event.data.range[0]
			x2 = event.data.range[1]
			y1 = event.data.range[2]
			y2 = event.data.range[3]
			selfSide = x2 - x1 + 1
			layers = selfSide * (y2 - y1 + 1)
			layerLength = side * side
			computed = new Array(layers).fill(false)
			workerIndex = event.data.index
			workerIndexX = event.data.wx
			workerIndexY = event.data.wy
			console.log('worker init', workerIndex, {
				side,
				x1,
				x2,
				y1,
				y2,
				selfSide,
				layers,
				layerLength,
				workerIndex,
				workerIndexX,
				workerIndexY,
			})
		} else if (event.type === "clear") {
			for (let l = 0; l < layers; l++) {
				const layer = l * layerLength
				computed[l] = false
				for (let y = y1; y <= y2; y++) {
					const row = y * side + layer
					for (let x = x1; x <= x2; x++) {
						const index = row + x
						integration[index] = maxIntegration
					}
				}
			}
		} else if (event.type === "query") {
			compute([event.data.x, event.data.y])
		}
	}
}

function compute(goal: [x: number, y: number]) {
	const l = (goal[1] - y1) * selfSide + (goal[0] - x1)
	if (computed[l]) return
	const offset = l * layerLength
	computeIntegration(offset, goal)
	computeField(offset, goal)
	computed[l] = true
}

function computeField(offset: number, goal: [x: number, y: number]) {
	// const before = performance.now()
	for (let y = y1; y <= y2; y++) {
		const row = offset + y * side
		for (let x = x1; x <= x2; x++) {
			const index = row + x
			if (x === goal[0] && y === goal[1]) {
				field[index] = fieldMap[0][0]
				continue
			}
			let min = maxIntegration
			let minx = 0
			let miny = 0
			for (let i = -1; i <= 1; i++) {
				for (let j = -1; j <= 1; j++) {
					if (i === 0 && j === 0) continue
					const dx = x + i
					if (dx < x1 || dx >= x2) continue
					const dy = y + j
					if (dy < y1 || dy >= y2) continue
					const index = dy * side + dx
					const cost = grid[index]
					if (cost === maxCost) continue
					const value = integration[offset + index]
					if (value < min) {
						min = value
						minx = i
						miny = j
					}
				}
			}
			field[index] = fieldMap[minx][miny]
		}
	}
	// const after = performance.now()
	// console.log('computeField', workerIndex, after - before)
}

function computeIntegration(offset: number, goal: [x: number, y: number]) {
	// const before = performance.now()
	const queue = [goal[0], goal[1]]
	integration[offset + goal[1] * side + goal[0]] = 0
	// debugger
	while (queue.length > 0) {
		const x = queue.shift()!
		const y = queue.shift()!
		const gridIndex = y * side + x
		const index = offset + gridIndex
		const value = integration[index]
		west: {
			if (x === x1) break west
			const gridNeighbor = gridIndex - 1
			const cost = grid[gridNeighbor] || 1
			if (cost !== maxCost) {
				const next = value + cost
				const neighbor = index - 1
				const prev = integration[neighbor]
				if (next < prev) {
					integration[neighbor] = next
					queue.push(x - 1, y)
				}
			}
		}
		east: {
			if (x === x2) break east
			const gridNeighbor = gridIndex + 1
			const cost = grid[gridNeighbor] || 1
			if (cost !== maxCost) {
				const next = value + cost
				const neighbor = index + 1
				const prev = integration[neighbor]
				if (next < prev) {
					integration[neighbor] = next
					queue.push(x + 1, y)
				}
			}
		}
		north: {
			if (y === y1) break north
			const gridNeighbor = gridIndex - side
			const cost = grid[gridNeighbor] || 1
			if (cost !== maxCost) {
				const next = value + cost
				const neighbor = index - side
				const prev = integration[neighbor]
				if (next < prev) {
					integration[neighbor] = next
					queue.push(x, y - 1)
				}
			}
		}
		south: {
			if (y === y2) break south
			const gridNeighbor = gridIndex + side
			const cost = grid[gridNeighbor] || 1
			if (cost !== maxCost) {
				const next = value + cost
				const neighbor = index + side
				const prev = integration[neighbor]
				if (next < prev) {
					integration[neighbor] = next
					queue.push(x, y + 1)
				}
			}
		}
	}
	// const after = performance.now()
	// console.log('computeIntegration', workerIndex, after - before)
}