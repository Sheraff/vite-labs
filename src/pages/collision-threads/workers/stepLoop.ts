
import { makeBalls, type Balls } from "../classes/Balls"
import { SUB_STEPS, TARGET_UPS } from "../utils/constants"

let paused: boolean

type Entities = {
	balls: Balls
}

const entities = {} as Entities

export function start(side: number) {
	entities.balls = makeBalls(side)
	entities.balls.init()
	entities.balls.initValues()
}

const upsArray: number[] = []
let loopTimeoutId: ReturnType<typeof setTimeout>
export function loop() {
	let lastTime = performance.now()
	const frame = () => {
		loopTimeoutId = setTimeout(() => {
			const time = performance.now()
			const dt = (time - lastTime) / 1000
			lastTime = time
			const subDt = dt / SUB_STEPS
			for (let i = 0; i < SUB_STEPS; i++) {
				Object.values(entities).forEach((entity) => entity.step(subDt, entities))

				upsArray.push(subDt)
				if (upsArray.length > 100) {
					upsArray.shift()
				}
			}
			if (!paused) {
				frame()
			}
		}, 1000 / TARGET_UPS)
	}
	frame()
}

// const asapChannel = new MessageChannel()
// function setAsap(fn, delay) {
// 	const time = performance.now()
// 	asapChannel.port1.onmessage = () => {
// 		const now = performance.now()
// 		const delta = now - time
// 		if (delta < delay) {
// 			setAsap(fn, delay - delta)
// 		} else {
// 			fn()
// 		}
// 	}
// 	asapChannel.port2.postMessage(null)
// }

export function getEntities() {
	return entities
}

export function getUps() {
	const ups = upsArray.length / upsArray.reduce((a, b) => a + b)
	return Math.round(ups)
}

export function pause() {
	paused = true
	clearTimeout(loopTimeoutId)
}

export function play() {
	paused = false
	loop()
}