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
		canvas.width = side * window.devicePixelRatio
		canvas.height = side * window.devicePixelRatio
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

		const width = ctx.canvas.width
		const height = ctx.canvas.height
		let data: Uint8Array
		let done = false

		const channels = 4
		const image = ctx.createImageData(width, height, { colorSpace: 'srgb' })
		const imageData = new Uint8Array(image.data.buffer)
		const colors = {
			ant: [0xaa, 0xaa, 0xaa, 0xff],
			antAndFood: [0xdd, 0xff, 0xdd, 0xff],
			food: [0, 0xff, 0, 0xff],
			pheromoneIn: [0, 0x80, 0, 0x80],
			pheromoneOut: [0x80, 0, 0, 0x80],
			pheromoneBoth: [0x80, 0x80, 0, 0x80],
			anthill: [0xff, 0, 0, 0xff],
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

		const onMessage = (e: MessageEvent<Outgoing>) => {
			if (e.data.type === "started") {
				data = new Uint8Array(e.data.data.buffer)
			} else if (e.data.type === "done") {
				done = true
				console.log("done")
			}
		}

		worker.addEventListener('message', onMessage)
		post("start", {
			width,
			height,
			count: 10000,
			vision: 20,
		})
		return () => {
			worker.terminate()
			worker.removeEventListener('message', onMessage)
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
