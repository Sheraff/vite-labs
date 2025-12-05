/// <reference lib="webworker" />

import * as utils from "./utils"

export type Tile = {
	name: number
	sides: string[]
	rotate: number
}

export type Incoming = {
	type: "start"
	data: { height: number; width: number; tiles: Pick<Tile, "name" | "sides">[]; force?: Array<[x: number, y: number]> }
}

export type Outgoing =
	| { type: "started"; data: { buffer: SharedArrayBuffer; map: Pick<Tile, "name" | "rotate">[] } }
	| { type: "done"; data: { solved: boolean; choices: number[] } }

self.onmessage = (e: MessageEvent<Incoming>) => handleMessage(e.data)

function postMessage(message: Outgoing) {
	self.postMessage(message)
}

function handleMessage(event: Incoming) {
	console.log("handleMessage", event)
	if (event.type === "start") {
		const tiles: Tile[] = []
		for (const tile of event.data.tiles) {
			const clone = tiles.find((other) => other.sides.every((side, i) => side === tile.sides[i]))
			if (clone) {
				// if (event.data.force) {
				// 	for (const forced of event.data.force) {
				// 		if (clone.name === forced[2]) forced[2] = tile.name
				// 	}
				// }
				continue
			}
			tiles.push({
				name: tile.name,
				sides: tile.sides,
				rotate: 0,
			})
		}
		// if (event.data.force) for (const forced of event.data.force) {
		// 	const t = tiles.findIndex((tile) => tile.name === forced[2])
		// 	if (t === -1) continue
		// 	forced[2] = t
		// }
		for (let i = 0, l = tiles.length; i < l; i++) {
			const tile = tiles[i]
			for (let r = 1; r < tile.sides.length; r++) {
				const rotated = tile.sides.slice(-r).concat(tile.sides.slice(0, tile.sides.length - r))
				if (tiles.some((other) => other.sides.every((side, i) => side === rotated[i]))) continue
				tiles.push({
					name: tile.name,
					sides: rotated,
					rotate: r,
				})
			}
		}
		const { width, height } = event.data
		const map = tiles.map((tile) => ({ name: tile.name, rotate: tile.rotate }))
		const buffer = new SharedArrayBuffer(Math.ceil((width * height * tiles.length) / 8))
		new Uint8Array(buffer).fill(0xffffff)

		postMessage({ type: "started", data: { buffer, map } })
		const onDone = (solved: boolean, choices: number[]) => postMessage({ type: "done", data: { solved, choices } })
		start({
			height,
			width,
			tiles,
			buffer,
			onDone,
			force: event.data.force?.map(([x, y]) => [x, y, Math.floor(Math.random() * tiles.length)]),
		})
	}
}

async function start({
	height,
	width,
	tiles,
	buffer,
	onDone,
	force = [],
}: {
	height: number
	width: number
	tiles: Tile[]
	buffer: SharedArrayBuffer
	onDone: (solved: boolean, choices: number[]) => void
	force?: Array<[x: number, y: number, name: number]>
}) {
	const matches = tiles.map((tile) => {
		const north = []
		const east = []
		const south = []
		const west = []
		for (let i = 0; i < tiles.length; i++) {
			const other = tiles[i]
			if (tile.sides[0] === other.sides[2]) north.push(i)
			if (tile.sides[1] === other.sides[3]) east.push(i)
			if (tile.sides[2] === other.sides[0]) south.push(i)
			if (tile.sides[3] === other.sides[1]) west.push(i)
		}
		return [north, east, south, west]
	})

	function resetBoard() {
		const view = new Uint8Array(buffer)
		view.fill(0xffffff)
		for (const [x, y, t] of force) {
			for (let i = 0; i < tiles.length; i++) {
				set(x, y, i, i === t)
			}
		}
	}

	const view = new DataView(buffer)

	const get: (x: number, y: number, t: number) => 0 | 1 = utils.get.bind(null, width, height, tiles.length, view)

	const set: (x: number, y: number, t: number, value: boolean) => void = utils.set.bind(
		null,
		width,
		height,
		tiles.length,
		view,
	)

	function lowestEntropy() {
		let min = Infinity
		let index = -1
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				let count = 0
				for (let t = 0; t < tiles.length; t++) {
					if (get(x, y, t)) count++
				}
				if (count <= 1) continue
				if (count < min) {
					min = count
					index = y * width + x
				}
			}
		}
		return index
	}

	function propagate(x: number, y: number) {
		const stack = [[x, y]]
		const directions = [
			[0, -1, 2],
			[1, 0, 3],
			[0, 1, 0],
			[-1, 0, 1],
		]
		do {
			const [x, y] = stack.pop()!
			const here = tiles.reduce<number[]>((acc, _, t) => (get(x, y, t) && acc.push(t), acc), [])
			for (const [dx, dy, cardinal] of directions) {
				const nx = x + dx
				const ny = y + dy
				if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
				let count = 0
				let pushed = false
				for (let t = 0; t < tiles.length; t++) {
					if (!get(nx, ny, t)) continue
					const possible = matches[t][cardinal].some((other) => here.includes(other))
					if (!possible) {
						set(nx, ny, t, false)
						if (!pushed) {
							stack.push([nx, ny])
							pushed = true
						}
					} else {
						count++
					}
				}
				if (count === 0) {
					return false
				}
			}
		} while (stack.length)
		return true
	}

	function isSolved() {
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				let count = 0
				for (let t = 0; t < tiles.length; t++) {
					if (get(x, y, t)) count++
				}
				if (count !== 1) return false
			}
		}
		return true
	}

	function isBlocked() {
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				let count = 0
				for (let t = 0; t < tiles.length; t++) {
					if (get(x, y, t)) count++
				}
				if (count === 0) return true
			}
		}
		return false
	}

	const choices: number[] = []
	let solved = false
	do {
		resetBoard()
		for (let i = 0; i < force.length; i++) {
			const [x, y] = force[i]
			const some = propagate(x, y)
			if (!some) break
		}
		if (isBlocked()) break
		let choiceIndex = 0
		let lowest = lowestEntropy()
		let loops = 0
		do {
			loops++
			const x = lowest % width
			const y = (lowest - x) / width
			const possible = tiles.reduce<number[]>((acc, _, t) => (get(x, y, t) && acc.push(t), acc), [])
			let t
			if (possible.length === 0) {
				break
			} else if (possible.length === 1) {
				t = possible[0]
			} else if (choiceIndex === choices.length) {
				const i = possible.length - 1
				choices.push(i)
				choiceIndex++
				t = possible[i]
			} else if (
				choices.every((c, i) => i < choiceIndex || (i === choiceIndex && c > 0) || (i > choiceIndex && c === 0))
			) {
				const i = choices[choiceIndex] - 1
				choices[choiceIndex] = i
				choices.length = choiceIndex + 1
				choiceIndex++
				t = possible[i]
			} else {
				const i = choices[choiceIndex]
				t = possible[i]
				choiceIndex++
			}
			for (let i = 0; i < tiles.length; i++) {
				set(x, y, i, i === t)
			}
			const some = propagate(x, y)
			if (!some) break
			lowest = lowestEntropy()
			// await new Promise((resolve) => setTimeout(resolve, 20))
		} while (lowest !== -1)
		console.log("loops", loops)
		solved = isSolved()
	} while (!solved && choices.some((c) => c > 0))

	console.log("choices", choices.join(" "))
	onDone(solved, choices)
}

// const initial_board = new Array(WIDTH * HEIGHT).fill(null)

// const facts = []

// const index = (x: number, y: number) => y * WIDTH + x

// // evaluate entropy
// const board = structuredClone(initial_board)
// for (let y = 0; y < WIDTH; y++) {
// 	for (let x = 0; x < HEIGHT; x++) {
// 		const north = y > 0 && board[index(x, y - 1)] !== null
// 			? tiles[board[index(x, y - 1)]].sides[2]
// 			: null
// 		const east = x < WIDTH - 1 && board[index(x + 1, y)] !== null
// 			? tiles[board[index(x + 1, y)]].sides[3]
// 			: null
// 		const south = y < HEIGHT - 1 && board[index(x, y + 1)] !== null
// 			? tiles[board[index(x, y + 1)]].sides[0]
// 			: null
// 		const west = x > 0 && board[index(x - 1, y)] !== null
// 			? tiles[board[index(x - 1, y)]].sides[1]
// 			: null
// 		let choices = []
// 		for (let t = 0; t < tiles.length; t++) {
// 			if (north !== null && north !== tiles[t].sides[0]) continue
// 			if (east !== null && east !== tiles[t].sides[1]) continue
// 			if (south !== null && south !== tiles[t].sides[2]) continue
// 			if (west !== null && west !== tiles[t].sides[3]) continue
// 			choices.push(t)
// 		}
// 	}
// }
