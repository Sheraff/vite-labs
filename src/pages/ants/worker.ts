/// <reference lib="webworker" />

// buffer definition
// 0b0000000000000000
//       ├┴┴┘├┴┴┘│││└─> ant
//       │   │   ││└──> food
//       │   │   │└───> and and food
//       │   │   └────> anthill
//       │   └────────> pheromone to food expiration countdown (left by ants with food, followed by ants without food)
//       └────────────> pheromone to anthill expiration countdown (left by ants without food, followed by ants with food)

const TypedArray = Uint16Array
type TypedArray = Uint16Array

const masks = {
	ant: 0b1,
	food: 0b10,
	antAndFood: 0b100,
	anthill: 0b1000,
	pheromoneToFood: 0b11110000,
	pheromoneToHill: 0b111100000000,
}

const offsets = {
	pheromoneToFood: 4,
	pheromoneToHill: 8,
}

const range = {
	from: 0,
	to: 0,
}

export type Incoming =
	| { type: "start", data: { height: number, width: number, count: number } }
	| { type: "share", data: { buffer: SharedArrayBuffer, width: number, height: number, vision: number, from: number, to: number } }
	| { type: "range", data: { from: number, to: number } }

export type Outgoing =
	| { type: "started", data: { buffer: SharedArrayBuffer } }
	| { type: "collected", data: { count: number } }

console.log('ant worker started')

self.onmessage = (e: MessageEvent<Incoming>) => handleMessage(e.data)

function postMessage(message: Outgoing) { self.postMessage(message) }

function handleMessage(event: Incoming) {
	if (event.type === "start") {
		const buffer = new SharedArrayBuffer(event.data.height * event.data.width * TypedArray.BYTES_PER_ELEMENT)
		const array = new TypedArray(buffer)

		const { width, height } = event.data

		const foodPosition = [width / 3, height / 3]
		const foodRadius = Math.min(width, height) / 10

		const anthillPosition = [width * 2 / 3, height * 2 / 3]
		// const anthillPosition = [width / 7, height / 7]
		// const anthillPosition = [width / 2, height / 2]
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
						array[i] |= masks.food
				}
				{
					const dx = x - anthillPosition[0]
					const dy = y - anthillPosition[1]
					const distance = Math.sqrt(dx * dx + dy * dy)
					if (distance < anthillRadius)
						array[i] |= masks.anthill
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
			const isOccupied = array[y * width + x] & masks.ant
			if (isOccupied) {
				i--
				continue
			}
			array[y * width + x] |= masks.ant
		}

		postMessage({ type: "started", data: { buffer } })
		return
	}

	if (event.type === "share") {
		const { buffer, width, height, vision, from, to } = event.data
		const array = new TypedArray(buffer)
		const onCollected = (count: number) => {
			console.log('onCollected', count)
			postMessage({ type: "collected", data: { count } })
		}
		range.from = from
		range.to = to
		start({ array, width, height, vision, range, onCollected })
		return
	}

	if (event.type === "range") {
		range.from = event.data.from
		range.to = event.data.to
		return
	}
}

const pheromoneDuration = 10_000

async function start({
	array,
	width,
	height,
	vision,
	range,
	onCollected,
}: {
	array: TypedArray
	width: number
	height: number
	vision: number
	range: { from: number, to: number }
	onCollected: (count: number) => void
}) {
	let lastPheromoneTick = performance.now()
	const pheromoneTickInterval = Math.round(pheromoneDuration / (masks.pheromoneToFood >> offsets.pheromoneToFood))
	let foodCount
	let collectedCount
	do {
		foodCount = 0
		collectedCount = 0
		const now = performance.now()
		const isPheromoneTick = now - lastPheromoneTick > pheromoneTickInterval
		const frame = new Promise(resolve => requestAnimationFrame(resolve))
		if (isPheromoneTick) lastPheromoneTick = now
		for (let i = range.from; i < range.to; i++) {
			const y = Math.floor(i / width)
			const x = i % width
				let value = array[i]

				// pheromone expiration
				if (isPheromoneTick) {
					value = pheromoneTickDown(
						value,
						masks.pheromoneToFood,
						offsets.pheromoneToFood
					)
					value = pheromoneTickDown(
						value,
						masks.pheromoneToHill,
						offsets.pheromoneToHill
					)
				}

				let isAnt = value & masks.ant
				let isFood = value & masks.food
				let isAntAndFood = value & masks.antAndFood
				const isAnthill = value & masks.anthill

				if (isAnt && isFood && !isAntAndFood) {
					value |= masks.antAndFood
					value &= ~masks.ant
					value &= ~masks.food
					isAnt = 0
					isFood = 0
					isAntAndFood = 1
				}

				if (isFood) foodCount++
				if (isAntAndFood) foodCount++

				// leave pheromone
				if (isAnt && !isFood) {
					value |= masks.pheromoneToHill
				}
				if (isAntAndFood && !isAnthill) {
					value |= masks.pheromoneToFood
				}

				// collect food
				if (isAntAndFood && isAnthill && !isAnt) {
					value &= ~masks.antAndFood
					value |= masks.ant
					foodCount--
					collectedCount++
				}

				// move
				if (isAnt) {
					value = moveToGoal(
						array,
						width,
						height,
						vision,
						x,
						y,
						value,
						masks.ant,
						masks.food,
						masks.pheromoneToFood,
						offsets.pheromoneToFood
					)
				}
				if (isAntAndFood) {
					value = moveToGoal(
						array,
						width,
						height,
						vision,
						x,
						y,
						value,
						masks.antAndFood,
						masks.anthill,
						masks.pheromoneToHill,
						offsets.pheromoneToHill
					)
				}

				array[i] = value
		}
		await frame
		if (collectedCount) onCollected(collectedCount)
	} while (true)
	// } while (foodCount)
}

function pheromoneTickDown(
	value: number,
	pheromone: number,
	pheromoneOffset: number,
): number {
	const isPheromone = value & pheromone
	if (isPheromone) {
		let expiration = value >> pheromoneOffset
		expiration--
		value &= ~pheromone
		if (expiration > 0) {
			value |= expiration << pheromoneOffset
		}
	}
	return value
}

function moveToGoal(
	array: TypedArray,
	width: number,
	height: number,
	vision: number,
	x: number,
	y: number,
	value: number,
	self: number,
	goal: number,
	pheromone: number,
	pheromoneOffset: number,
): number {
	let sumX, sumY, count
	sumX = sumY = count = 0
	const low = -vision / 2
	const high = vision / 2
	check: for (let dy = -vision; dy <= vision; dy++) {
		if (dy === low) dy = high
		const yComponent = (y + dy) * width
		for (let dx = -vision; dx <= vision; dx++) {
			if (dx === low) dx = high
			const j = yComponent + (x + dx)
			const cell = array[j]
			const cellIsGoal = cell & goal
			if (cellIsGoal) {
				const intensity = pheromone >> pheromoneOffset
				sumX += dx * intensity
				sumY += dy * intensity
				count += intensity
			}
			const cellPheromone = cell & pheromone
			if (cellPheromone) {
				const intensity = cellPheromone >> pheromoneOffset
				sumX += dx * intensity
				sumY += dy * intensity
				count += intensity
			}
		}
	}
	move: {
		if (count) {
			const divider = Math.abs(sumX) + Math.abs(sumY)
			const dx = Math.round(sumX / divider * 2)
			const dy = Math.round(sumY / divider * 2)
			if (dx || dy) {
				const nx = Math.min(Math.max(0, x + dx), width - 1)
				const ny = Math.min(Math.max(0, y + dy), height - 1)

				const j = ny * width + nx
				if (!(array[j] & self)) {
					array[j] |= self
					value &= ~self
					break move
				}
			}
		}
		const dx = (Math.floor(Math.random() * 7) - 3)
		const dy = (Math.floor(Math.random() * 7) - 3)
		const nx = Math.min(Math.max(0, x + dx), width - 1)
		const ny = Math.min(Math.max(0, y + dy), height - 1)
		const j = ny * width + nx
		if (!(array[j] & self)) {
			array[j] |= self
			value &= ~self
		}
	}
	return value
}