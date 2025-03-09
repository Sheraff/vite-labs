import { useEffect, useRef } from "react"
import styles from './styles.module.css'
import { Head } from "~/components/Head"
import type { RouteMeta } from "~/router"
import { makeEntity, makeStartState, type Entity } from "@neat/entity"
import { makeRandomGenome, mutate } from "@neat/random"
import { simulate } from "@neat/simulate"
import Worker from './worker?worker'
import type { Incoming, Outgoing } from './worker'
import { evaluate } from "@neat/evaluate"

export const meta: RouteMeta = {
	title: 'N.E.A.T',
}

export default function Neat() {
	const ref = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = ref.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		const side = Math.min(innerHeight, innerWidth) * devicePixelRatio
		canvas.width = side
		canvas.height = side

		return start(side, ctx)
	}, [])

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<canvas width="1000" height="1000" ref={ref}>
				Your browser does not support the HTML5 canvas tag.
			</canvas>
		</div>
	)
}

function start(side: number, ctx: CanvasRenderingContext2D) {
	const controller = new AbortController()

	const entities = Array.from({ length: POPULATION }, () => makeEntity(makeRandomGenome(), makeStartState(side)))
	const workers = Array.from({ length: Math.max(1, navigator.hardwareConcurrency - 1) }, () => new Worker())

	loop(side, ctx, controller, entities, workers)

	return () => {
		controller.abort()
		for (const worker of workers) {
			worker.terminate()
		}
	}
}

async function loop(
	side: number,
	ctx: CanvasRenderingContext2D,
	controller: AbortController,
	entities: Entity[],
	workers: Worker[],
) {
	const survivorCount = Math.floor(entities.length * SURVIVE_PERCENT / 100)
	for (let iter = 0; iter < GENERATIONS; iter++) {
		console.log('Generation', iter)
		if (controller.signal.aborted) return
		let scores
		if (iter % 10 === 0) {
			scores = await drawnBatch(entities, { ctx, side, controller })
		} else {
			scores = await asyncBatch(entities, workers, { ctx, side, controller })
		}
		const best = scores
			.map((score, i) => [score, entities[i].genome] as const)
			.filter(([score]) => score > 0)
			.sort(([a], [b]) => b - a)
			.slice(0, survivorCount)
		let i = 0
		const copies = 1
		const mutations = 90
		for (const [, genome] of best) {
			for (let j = 0; j < copies; j++) {
				entities[i] = makeEntity(genome, makeStartState(side))
				i++
			}
			for (let j = 0; j < mutations; j++) {
				entities[i] = makeEntity(mutate(genome), makeStartState(side))
				i++
			}
		}
		for (; i < POPULATION; i++) {
			entities[i] = makeEntity(makeRandomGenome(), makeStartState(side))
		}
	}
}

/** The number of entities to simulate */
const POPULATION = 2000
/** The number of iterations to simulate during 1 generation */
const ITERATIONS = 1000
/** The number of generations to simulate */
const GENERATIONS = 1000
/** The percentage of entities that will survive to the next generation */
const SURVIVE_PERCENT = 20

type BatchOpts = {
	ctx: CanvasRenderingContext2D
	side: number
	controller: AbortController
}

async function drawnBatch(entities: Entity[], opts: BatchOpts) {
	await new Promise<void>(r => simulate({
		entities,
		iterations: ITERATIONS,
		side: opts.side,
		controller: opts.controller,
		async frame(state) {
			const { ctx } = opts
			const size = ctx.canvas.width
			ctx.clearRect(0, 0, size, size)
			for (const entity of state.entities) {
				if (entity.state.alive) entity.draw(ctx)
			}
			await new Promise(requestAnimationFrame)
		},
	}, r))
	const scores = entities.map(e => evaluate(e))
	return scores
}

async function asyncBatch(entities: Entity[], workers: Worker[], opts: BatchOpts) {
	let done = 0
	let i = 0
	const controller = new AbortController()
	const scores = Array.from<number>({ length: entities.length }).fill(0)
	const next = (worker: Worker) => {
		const id = i++
		if (id >= entities.length) return
		postMessage(worker, 'evaluate', {
			id,
			genome: entities[id].genome,
		})
	}
	return new Promise<number[]>((resolve) => {
		for (let w = 0; w < workers.length; w++) {
			const worker = workers[w]
			worker.addEventListener('message', (event: MessageEvent<Outgoing>) => {
				if (event.data.type === 'evaluate') {
					const { id, score } = event.data.data
					scores[id] = score
					done++
					if (done === entities.length) {
						controller.abort()
						resolve(scores)
					} else {
						next(worker)
					}
				}
			}, { signal: controller.signal })
			postMessage(worker, 'config', {
				side: opts.side,
				iterations: ITERATIONS,
			})
			next(worker)
			next(worker)
		}
	})
}


function postMessage<T extends Incoming['type']>(worker: Worker, type: T, data: Extract<Incoming, { type: T }>['data']) {
	worker.postMessage({ type, data })
}