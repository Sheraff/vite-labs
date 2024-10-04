/// <reference lib="webworker" />

import circularMedian from "./median-angle"

// buffer definition
// 0b00000000
//   ├┘│││││└─> ant
//   │ ││││└──> food
//   │ │││└───> pheromone out // left by ants with food, followed by ants without food
//   │ ││└────> pheromone in  // left by ants without food, followed by ants with food
//   │ │└─────> anthill
//   │ └──────> obstable
//   └────────> pheromone expiration counter

export type Incoming =
	| { type: "start", data: { height: number, width: number, count: number } }
	| { type: "share", data: { buffer: SharedArrayBuffer, width: number, height: number, vision: number, from: number, to: number } }

export type Outgoing =
	| { type: "started", data: { buffer: SharedArrayBuffer } }

console.log('ant worker started')

self.onmessage = (e: MessageEvent<Incoming>) => handleMessage(e.data)

function postMessage(message: Outgoing) { self.postMessage(message) }

function handleMessage(event: Incoming) {
	console.log('handleMessage', event)
	if (event.type === "start") {
		const buffer = new SharedArrayBuffer(event.data.height * event.data.width * Uint8Array.BYTES_PER_ELEMENT)
		const array = new Uint8Array(buffer)

		const { width, height } = event.data

		const foodPosition = [width / 3, height / 3]
		const foodRadius = Math.min(width, height) / 10

		const anthillPosition = [width * 2 / 3, height * 2 / 3]
		const anthillRadius = Math.min(width, height) / 10

		const antDistance = [Math.min(width, height) / 20, Math.min(width, height) / 8]

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const i = y * width + x
				{
					const dx = x - foodPosition[0]
					const dy = y - foodPosition[1]
					const distance = Math.sqrt(dx * dx + dy * dy)
					if (distance < foodRadius)
						array[i] |= 0b00000010
				}
				{
					const dx = x - anthillPosition[0]
					const dy = y - anthillPosition[1]
					const distance = Math.sqrt(dx * dx + dy * dy)
					if (distance < anthillRadius)
						array[i] |= 0b00010000
				}
			}
		}

		for (let i = 0; i < event.data.count; i++) {
			const distance = Math.random() * (antDistance[1] - antDistance[0]) + antDistance[0]
			const angle = Math.random() * Math.PI * 2
			const dx = Math.cos(angle) * distance
			const dy = Math.sin(angle) * distance
			const x = Math.round(anthillPosition[0] + dx)
			const y = Math.round(anthillPosition[1] + dy)
			const isOccupied = array[y * width + x] & 0b00000001
			if (isOccupied) {
				i--
				continue
			}
			array[y * width + x] |= 0b00000001
		}

		postMessage({ type: "started", data: { buffer } })
		return
	}

	if (event.type === "share") {
		const { buffer, width, height, vision, from, to } = event.data
		const array = new Uint8Array(buffer)
		start({ array, width, height, vision, from, to })
	}
}

const pheromoneDuration = 15_000

async function start({
	array,
	width,
	height,
	vision,
	from = 0,
	to = height,
}: {
	array: Uint8Array
	width: number
	height: number
	vision: number
	from?: number
	to?: number
}) {
	let lastPheromoneTick = performance.now()
	const pheromoneTickInterval = Math.round(pheromoneDuration / 0b11)
	let foodCount
	do {
		foodCount = 0
		const now = performance.now()
		const isPheromoneTick = now - lastPheromoneTick > pheromoneTickInterval
		if (isPheromoneTick) lastPheromoneTick = now
		for (let y = from; y < to; y++) {
			for (let x = 0; x < width; x++) {
				const i = y * width + x
				let value = array[i]

				// pheromone expiration
				if (isPheromoneTick) {
					const isPheromone = value & 0b00001100
					if (isPheromone) {
						let expiration = value >> 6
						expiration--
						if (expiration === 0) {
							value &= 0b00110011
						} else {
							value &= 0b00111111
							value |= expiration << 6
						}

					}
				}

				const isAnt = value & 0b01
				const isFood = value & 0b10

				if (isFood) foodCount++

				// leave pheromone
				if (isAnt && isFood) {
					value |= 0b11000100
					const isAnthill = value & 0b10000
					if (isAnthill) {
						value &= ~0b10
						foodCount--
					}
				} else if (isAnt) {
					value |= 0b11001000
				}

				// move
				if (isAnt) {
					const angles: number[] = []

					// gather all angles (in radians) of the pheromones in the vision of the ant
					const interestedMask = isFood ? 0b1000 : 0b0100
					for (let dy = -vision; dy <= vision; dy++) {
						const yComponent = (y + dy) * width
						for (let dx = -vision; dx <= vision; dx++) {
							if (dx === 0 && dy === 0) continue
							const j = yComponent + (x + dx)
							const isPheromone = array[j] & interestedMask
							if (!isPheromone) continue
							const angle = Math.atan2(dy, dx)
							angles.push(angle)
						}
					}

					// compute the average angle of the pheromones and move the ant in that direction
					const dot = isFood ? 0b11 : 0b01
					if (angles.length > 0) {
						const median = angles.length === 1 ? angles[0] : circularMedian(angles)
						const dx = Math.round(Math.cos(median) * 1.4) * 3
						const dy = Math.round(Math.sin(median) * 1.4) * 3
						const nx = Math.min(Math.max(0, x + dx), width - 1)
						const ny = Math.min(Math.max(0, y + dy), height - 1)
						const j = ny * width + nx
						if (array[j] & 0b00100001) continue
						array[j] |= dot
						value &= ~dot
					} else {
						const dx = (Math.floor(Math.random() * 3) - 1) * 3
						const dy = (Math.floor(Math.random() * 3) - 1) * 3
						const nx = Math.min(Math.max(0, x + dx), width - 1)
						const ny = Math.min(Math.max(0, y + dy), height - 1)
						const j = ny * width + nx
						if (array[j] & 0b00100001) continue
						array[j] |= dot
						value &= ~dot
					}
				}

				array[i] = value
			}
		}
		await new Promise(resolve => requestAnimationFrame(resolve))
		// } while (foodCount)
	} while (true)
}
