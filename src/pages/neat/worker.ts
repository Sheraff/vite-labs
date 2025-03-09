/// <reference lib="webworker" />

import type { Type } from "./constants"
import { makeEntity, makeStartState } from "./entity"
import { evaluate } from "./evaluate"
import { simulate } from "./simulate"

export type Incoming =
	| { type: "config", data: { side: number, iterations: number } }
	| { type: "evaluate", data: { genome: Type, id: number } }

export type Outgoing =
	| { type: "evaluate", data: { id: number, score: number } }


{
	self.onmessage = (e: MessageEvent<Incoming>) => handleMessage(e.data)
	const postMessage = <T extends Outgoing['type']>(type: T, data: Extract<Outgoing, { type: T }>['data']) => self.postMessage({ type, data })

	let config = false
	let side = 0
	let iterations = 0

	function handleMessage(event: Incoming) {
		if (event.type === "config") {
			config = true
			side = event.data.side
			iterations = event.data.iterations
			return
		}

		if (event.type === "evaluate") {
			if (!config) throw new Error("Worker not configured")
			const genome = event.data.genome
			const entity = makeEntity(genome, makeStartState(side))
			simulate({
				entities: [entity],
				iterations,
				side,
			}, () => {
				const score = evaluate(entity)
				postMessage('evaluate', { id: event.data.id, score })
			})
		}
	}
}