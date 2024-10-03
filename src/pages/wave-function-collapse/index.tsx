import styles from './styles.module.css'
import { Head } from "~/components/Head"
import type { RouteMeta } from "~/router"
import type { Incoming, Outgoing } from "./worker"
import Worker from "./worker?worker"
import { useEffect, useRef } from "react"
import * as utils from './utils'
import * as config from './carcassonne/definition'

export const meta: RouteMeta = {
	title: 'Wave Function Collapse',
	image: './screen.png'
}

const tiles = config.definition.map((row, y) => ({
	name: y,
	sides: row,
}))

const equivalents = tiles.map((tile) => tiles.filter((other) => other.sides.every((side, i) => side === tile.sides[i])))



function drawTile(ctx: CanvasRenderingContext2D, w: number, h: number, index: number, rotate: number, x: number, y: number) {
	if (rotate === 1) x += 1
	if (rotate === 2) y += 1, x += 1
	if (rotate === 3) y += 1
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

export default function () {
	const ref = useRef<HTMLCanvasElement | null>(null)

	// useEffect(() => {
	// 	const ctx = ref.current?.getContext("2d")!
	// 	if (!ctx) return

	// 	drawTile(ctx, 100, 100, 3, 0, 2, 1)
	// }, [])

	useEffect(() => {
		const canvas = ref.current
		if (!canvas) return
		canvas.width = canvas.clientWidth * window.devicePixelRatio
		canvas.height = canvas.clientHeight * window.devicePixelRatio
		const ctx = canvas.getContext("2d")!
		if (!ctx) return

		const worker = new Worker()
		function post<I extends Incoming["type"]>(
			type: I,
			data: Extract<Incoming, { type: I }>["data"],
			transfer?: Transferable[]
		) {
			worker.postMessage({ type, data }, { transfer })
		}

		const height = 30
		const width = 30
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
					const index = indices[i % indices.length]
					// const index = indices[0]
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

		const seed = (count: number) => {
			const forces: Array<[x: number, y: number, t: number]> = []
			for (let i = 0; i < count; i++) {
				forces.push([Math.floor(Math.random() * width), Math.floor(Math.random() * height), tiles[Math.floor(Math.random() * tiles.length)].name])
			}
			return forces
		}

		worker.addEventListener('message', onMessage)
		const force = seed(4)
		console.log(force)
		post("start", { height, width, tiles, force })
		return () => {
			worker.terminate()
			worker.removeEventListener('message', onMessage)
			cancelAnimationFrame(rafId)
		}
	}, [])

	return (
		<div className={styles.main} >
			<Head />
			<canvas width="1000" height="1000" ref={ref}>
				Your browser does not support the HTML5 canvas tag.
			</canvas>
		</div>
	)
}
