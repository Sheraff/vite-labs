import styles from './styles.module.css'
import { Head } from "#components/Head"
import type { RouteMeta } from "#router"
import type { Incoming, Outgoing } from "./worker"
import Worker from "./worker?worker"
import { useCallback, useEffect, useRef, useState } from "react"
import * as utils from '#wave-function-collapse/utils'
import * as config from '#wave-function-collapse/carcassonne/definition'

export const meta: RouteMeta = {
	title: 'Wave Function Collapse',
	image: './screen.png',
	tags: ['procedural', 'random']
}

const tiles = config.definition.map((row, y) => ({
	name: y,
	sides: row,
}))

const equivalents = tiles.map((tile) => tiles.filter((other) => other.sides.every((side, i) => side === tile.sides[i])))



function drawTile(ctx: CanvasRenderingContext2D, w: number, h: number, index: number, rotate: number, x: number, y: number) {
	if (rotate === 1) { x += 1 }
	if (rotate === 2) { y += 1; x += 1 }
	if (rotate === 3) { y += 1 }
	ctx.save()
	ctx.translate(x * w, y * h)
	ctx.rotate(rotate * Math.PI / 2)
	const setY = (index / config.params.grid.width) | 0
	const setX = index % config.params.grid.width
	ctx.drawImage(
		config.tileSet,
		setX * config.params.tile.width,
		setY * config.params.tile.height,
		config.params.tile.width,
		config.params.tile.height,
		0,
		0,
		w,
		h
	)
	ctx.restore()
}

const height = 40
const width = 40

const seed = (count: number) => {
	const forces: Array<[x: number, y: number]> = []
	for (let i = 0; i < count; i++) {
		forces.push([Math.floor(Math.random() * width), Math.floor(Math.random() * height)])
	}
	return forces
}

export default function Wave() {
	const [available] = useState(window.crossOriginIsolated)
	const ref = useRef<HTMLCanvasElement | null>(null)

	const [force, setForce] = useState(() => seed(20))

	const [worker] = useState(() => new Worker())
	const post = useCallback(function post<I extends Incoming["type"]>(
		type: I,
		data: Extract<Incoming, { type: I }>["data"],
		transfer?: Transferable[]
	) {
		worker.postMessage({ type, data }, { transfer })
	}, [worker])

	useEffect(() => {
		const canvas = ref.current
		if (!canvas) return
		canvas.width = canvas.clientWidth * window.devicePixelRatio
		canvas.height = canvas.clientHeight * window.devicePixelRatio
		const ctx = canvas.getContext("2d")!
		if (!ctx) return

		const drawX = ctx.canvas.width / width
		const drawY = ctx.canvas.height / height
		let map: Extract<Outgoing, { type: "started" }>["data"]["map"]
		let buffer: Extract<Outgoing, { type: "started" }>["data"]["buffer"]
		let done = false
		let get: (x: number, y: number, t: number) => 0 | 1

		let i = 0
		function loop() {
			if (!done) rafId = requestAnimationFrame(loop)
			// rafId = requestAnimationFrame(loop)
			if (!map || !buffer || !get) return

			i++
			ctx.clearRect(0, 0, width * drawX, height * drawY)

			// const grid = Array.from({ length: height }, () => Array(width).fill(0))

			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					const indices = map.reduce((acc, _, t) => (get(x, y, t) && acc.push(t), acc), [] as number[])
					if (indices.length === 0) continue
					// const index = indices[i % indices.length]
					// const index = indices[0]
					const index = indices[Math.floor(Math.random() * indices.length)]
					// grid[y][x] = indices.length
					const tile = map[index]

					// const options = equivalents[tile.name]
					// const pick = options[Math.floor(Math.random() * options.length)]

					drawTile(ctx, drawX, drawY, tile.name, tile.rotate, x, y)
				}
			}
			for (const [x, y] of force) {
				ctx.rect(x * drawX, y * drawY, drawX, drawY)
				ctx.strokeStyle = "red"
				ctx.lineWidth = 2
				ctx.stroke()
			}

			// console.log("grid")
			// console.log(grid.map(row => row.join(" ")).join("\n"))
		}
		let rafId = requestAnimationFrame(loop)

		const onMessage = (e: MessageEvent<Outgoing>) => {
			if (e.data.type === "started") {
				map = e.data.data.map
				buffer = e.data.data.buffer
				get = utils.get.bind(null, width, height, map.length, new DataView(buffer))
			} else if (e.data.type === "done") {
				done = true
				console.log("done", e.data.data.solved)
			}
		}

		worker.addEventListener('message', onMessage)
		post("start", { height, width, tiles, force })
		return () => {
			worker.removeEventListener('message', onMessage)
			cancelAnimationFrame(rafId)
		}
	}, [force, worker, post])

	useEffect(() => () => {
		worker.terminate()
	}, [])

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
				<button type="button" onClick={() => setForce(seed(20))}>Retry with a new seed</button>
			</div>
			{available && <canvas width="1000" height="1000" ref={ref}>
				Your browser does not support the HTML5 canvas tag.
			</canvas>}
			{!available && <p>SharedArrayBuffer is not available, the service worker must have not auto-installed, try reloading the page.</p>}
		</div>
	)
}
