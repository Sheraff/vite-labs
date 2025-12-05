import { makeBalls, type Balls, type SerializedBalls } from "../classes/Balls"

type Entities = {
	balls: Balls
}

let entities = new Proxy(
	{},
	{
		get: (_, key) => {
			throw new Error(`Call \`init\` before accessing entity "${String(key)}"`)
		},
	},
) as Entities

export type EntitiesMessage = { balls: SerializedBalls }

export const server = {
	init: (side: number) => {
		entities = {} as Entities
		entities.balls = makeBalls(side)
		entities.balls.init()
		entities.balls.initValues()
	},
	serialize: (): EntitiesMessage => {
		return { balls: entities.balls.serialize() }
	},
	get: () => entities,
}

export const client = {
	init: (side: number) => {
		entities = {} as Entities
		entities.balls = makeBalls(side)
	},
	hydrate: (bufferStructure: EntitiesMessage) => {
		entities.balls.hydrate(bufferStructure.balls)
	},
	get: () => entities,
}
