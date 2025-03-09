import { useEffect, useRef, useState } from "react"
import styles from './styles.module.css'
import { Head } from "~/components/Head"
import type { RouteMeta } from "~/router"
import { makeEntity, makeStartState, type Entity } from "@neat/entity"
import { makeRandomGenome, mutate } from "@neat/random"
import { simulate } from "@neat/simulate"
import Worker from './worker?worker'
import type { Incoming, Outgoing } from './worker'
import { evaluate } from "@neat/evaluate"
import type { Type } from "@neat/constants"

export const meta: RouteMeta = {
	title: 'N.E.A.T',
}

/** The number of entities to simulate */
const POPULATION = 2000
/** The number of iterations to simulate during 1 generation */
const ITERATIONS = 2000
/** The number of generations to simulate */
const GENERATIONS = 1000
/** The percentage of entities that will survive to the next generation */
const SURVIVE_PERCENT = 1

export default function Neat() {
	const [side] = useState(() => Math.min(innerHeight, innerWidth) * devicePixelRatio)
	const [canvas, setCanvas] = useState<HTMLCanvasElement>()
	const [context, setContext] = useState<CanvasRenderingContext2D>()

	const [progress, setProgress] = useState(0)
	const [generations, setGenerations] = useState<Array<Type[]>>([])
	const [_selected, setSelected] = useState(2)
	const displayGeneration = Math.max(1, generations.length)
	const selected = Math.min(_selected, displayGeneration)

	useEffect(() => {
		if (!context) return
		return start(side, context, setProgress, (genome) => {
			setGenerations((prev) => [...prev, genome])
		})
	}, [context])

	const autoplay = generations.length >= 2
	const generation = autoplay && generations[selected - 1]

	useEffect(() => {
		if (!generation || !context) return
		const entities = generation.map(genome => makeEntity(genome, makeStartState(side)))
		const controller = new AbortController()
		drawnBatch(entities, { ctx: context, side, controller }).then(() => {
			if (controller.signal.aborted) return
			setSelected(p => p + 1)
		})
		return () => controller.abort()
	}, [generation, context])

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<canvas width="1000" height="1000" ref={(element) => {
				if (element && element !== canvas) {
					setCanvas(element)
					element.height = side
					element.width = side
					const context = element.getContext('2d')
					if (!context) throw new Error('Failed to get canvas context')
					setContext(context)
				}
			}}>
				Your browser does not support the HTML5 canvas tag.
			</canvas>
			<form className={styles.form}>
				<fieldset>
					<legend>Controls</legend>
					<progress value={progress} max={1} id="progress" />
					<label htmlFor="progress">Simulating generation {(generations.length + 1).toString().padStart(2, '0')}</label>
					<hr />
					<input
						id="range"
						type="range"
						min={1}
						max={displayGeneration}
						value={selected}
						step={1}
						disabled={!autoplay}
						onChange={e => {
							setSelected(Number(e.target.value))
						}}
					/>
					<label htmlFor="range">Playing generation {selected.toString().padStart(2, '0')} of {displayGeneration.toString().padStart(2, '0')}</label>
				</fieldset>
			</form>
		</div>
	)
}

function start(
	side: number,
	ctx: CanvasRenderingContext2D,
	progress: (progress: number) => void,
	save: (genome: Type[]) => void,
) {
	const controller = new AbortController()

	const entities = Array.from({ length: POPULATION }, () => makeEntity(makeRandomGenome(), makeStartState(side)))
	const workers = Array.from({ length: Math.max(1, navigator.hardwareConcurrency - 1) }, () => new Worker())

	loop(side, ctx, controller, entities, workers, progress, save)

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
	progress: (progress: number) => void,
	save: (genome: Type[]) => void,
) {
	const survivorCount = Math.floor(entities.length * SURVIVE_PERCENT / 100)
	const batchOpts: BatchOpts = { ctx, side, controller, progress }
	for (let iter = 0; iter < GENERATIONS; iter++) {
		console.log('Generation', iter)
		if (controller.signal.aborted) return
		let scores
		if (iter === 0) {
			scores = await drawnBatch(entities, batchOpts)
		} else {
			scores = await asyncBatch(entities, workers, batchOpts)
		}
		const best = scores
			.map((score, i) => [score, entities[i].genome] as const)
			.filter(([score]) => score > 0)
			.sort(([a, ga], [b, gb]) => {
				const diff = b - a
				if (diff !== 0) return diff
				return ga.length - gb.length
			})
			.slice(0, survivorCount)
			.map(([, genome]) => genome)
		save(best)
		let i = 0
		const copies = 1
		const mutations = Math.floor((entities.length - best.length) / (best.length + 1))
		for (const genome of best) {
			for (let j = 0; j < copies; j++) {
				entities[i] = makeEntity(genome, makeStartState(side))
				i++
			}
			for (let j = 0; j < mutations; j++) {
				entities[i] = makeEntity(mutate(genome), makeStartState(side))
				i++
			}
		}
		let j = 0
		for (; i < POPULATION; i++, j++) {
			entities[i] = makeEntity(makeRandomGenome(), makeStartState(side))
		}
	}
}

type BatchOpts = {
	ctx: CanvasRenderingContext2D
	side: number
	controller: AbortController
	progress?: (progress: number) => void
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
			opts.progress?.((ITERATIONS - state.i) / ITERATIONS)
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
		if (opts.controller.signal.aborted) return
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
					opts.progress?.(done / entities.length)
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