import styles from './styles.module.css'
import { Head } from "~/components/Head"
import type { RouteMeta } from "~/router"
import type { Incoming, Outgoing } from "./worker"
import Worker from "./worker?worker"
import { useEffect, useRef, useState } from "react"

export const meta: RouteMeta = {
	title: 'Ants',
}

export default function () {
	const [available] = useState(window.crossOriginIsolated)
	const ref = useRef<HTMLCanvasElement | null>(null)

	useEffect(() => {
		const canvas = ref.current
		if (!canvas) return
		const side = Math.min(canvas.clientWidth, canvas.clientHeight)
		canvas.width = side // * window.devicePixelRatio
		canvas.height = side // * window.devicePixelRatio
		const ctx = canvas.getContext("2d")!
		if (!ctx) return

		const workers = [new Worker()]
		function post<I extends Incoming["type"]>(
			i: number,
			type: I,
			data: Extract<Incoming, { type: I }>["data"],
			transfer?: Transferable[]
		) {
			workers[i].postMessage({ type, data }, { transfer })
		}

		const width = ctx.canvas.width
		const height = ctx.canvas.height
		const vision = 20
		const count = 10_000
		let data: Uint8Array
		let done = false

		const channels = 4
		const image = ctx.createImageData(width, height, { colorSpace: 'srgb' })
		const imageData = new Uint8Array(image.data.buffer)
		const colors = {
			ant: [0xcc, 0xcc, 0xcc, 0xff],
			antAndFood: [0xdd, 0xff, 0xdd, 0xff],
			food: [0, 0x80, 0, 0xff],
			pheromoneIn: [0x20, 0xff, 0x20, 0xff],
			pheromoneOut: [0xa0, 0x20, 0x20, 0x80],
			pheromoneBoth: [0x70, 0xff, 0x20, 0xff],
			anthill: [0x80, 0, 0, 0xff],
			obstacle: [0, 0, 0xff, 0xff],
			void: [0, 0, 0, 0xff],
		}

		let i = 0
		function loop() {
			if (!done) rafId = requestAnimationFrame(loop)
			if (!data) return

			i++

			for (let i = 0; i < data.length; i++) {
				const point = data[i]
				const isAnt
					= point & 0b00000001
				const isFood
					= point & 0b00000010
				const isPheromoneIn
					= point & 0b00000100
				const isPheromoneOut
					= point & 0b00001000
				const isAnthill
					= point & 0b00010000
				const isObstacle
					= point & 0b00100000

				const index = i * channels

				if (isAnt && isFood) {
					imageData.set(colors.antAndFood, index)
				} else if (isAnt) {
					imageData.set(colors.ant, index)
				} else if (isFood) {
					imageData.set(colors.food, index)
				} else if (isPheromoneIn && isPheromoneOut) {
					imageData.set(colors.pheromoneBoth, index)
				} else if (isPheromoneIn) {
					imageData.set(colors.pheromoneIn, index)
				} else if (isPheromoneOut) {
					imageData.set(colors.pheromoneOut, index)
				} else if (isAnthill) {
					imageData.set(colors.anthill, index)
				} else if (isObstacle) {
					imageData.set(colors.obstacle, index)
				} else {
					imageData.set(colors.void, index)
				}
			}

			ctx.putImageData(image, 0, 0)
		}
		let rafId = requestAnimationFrame(loop)

		function launch(buffer: SharedArrayBuffer) {
			const parallelism = Math.max(1, navigator.hardwareConcurrency - 1)

			console.log('parallelism', parallelism)

			for (let i = 0; i < parallelism; i++) {
				const from = Math.floor(i * height / parallelism)
				const to = Math.floor((i + 1) * height / parallelism)
				const whose = i === 0 ? 'main' : 'worker'
				console.log(whose, 'from', from, 'to', to)
				if (!workers[i]) workers[i] = new Worker()

				const worker = new Worker()
				worker.postMessage({ type: "share", data: { buffer, width, height, vision, from, to } })
			}
		}

		const onMessage = (e: MessageEvent<Outgoing>) => {
			if (e.data.type === "started") {
				data = new Uint8Array(e.data.data.buffer)
				launch(e.data.data.buffer)
			} else if (e.data.type === "done") {
				done = true
				console.log("done")
			}
		}

		workers[0].addEventListener('message', onMessage)
		post(0, "start", {
			width,
			height,
			count,
		})
		return () => {
			for (const worker of workers)
				worker.terminate()
			workers[0].removeEventListener('message', onMessage)
			cancelAnimationFrame(rafId)
		}
	}, [])

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			{available && <canvas width="1000" height="1000" ref={ref}>
				Your browser does not support the HTML5 canvas tag.
			</canvas>}
			{!available && <p>SharedArrayBuffer is not available, the service worker must have not auto-installed, try reloading the page.</p>}
		</div>
	)
}
