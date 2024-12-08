import styles from './styles.module.css'
import { Head } from "~/components/Head"
import type { RouteMeta } from "~/router"
import type { Incoming, Outgoing } from "./worker"
import Worker from "./worker?worker"
import { useEffect, useRef, useState } from "react"

export const meta: RouteMeta = {
	title: 'Ants',
	image: './screen.png'
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
		const vision = 24
		const count = 25_000
		let data: Uint16Array
		let done = false

		const channels = 4
		const image = ctx.createImageData(width, height, { colorSpace: 'srgb' })
		const colors = {
			ant: [0xcc, 0xcc, 0xcc, 0xff],
			antAndFood: [0xee, 0x44, 0xee, 0xff],
			food: [0, 0x80, 0, 0xff],
			pheromoneToFood: [0x20, 0xee, 0x20, 0xff],
			pheromoneToHill: [0xa0, 0x20, 0x20, 0x80],
			pheromoneBoth: [0xa0, 0xee, 0x20, 0xff],
			anthill: [0x80, 0, 0, 0xff],
			void: [0, 0, 0, 0xff],
		}

		let i = 0
		let previousAntCount = count
		function loop() {
			if (!done) rafId = requestAnimationFrame(loop)
			if (!data) return

			i++
			let antcount = 0
			let foodcount = 0
			let untouchedfoodcount = 0
			const ranges = [0]
			let range = 1
			const rangeSize = Math.ceil(previousAntCount / (workers.length + 1))
			for (let i = 0; i < data.length; i++) {
				const point = data[i]
				const isAnt
					= point & 0b00000001
				const isFood
					= point & 0b00000010
				const isAntAndFood
					= point & 0b00000100
				const isAnthill
					= point & 0b00001000
				const isPheromoneToFood
					= (point & 0b11110000) >> 4
				const isPheromoneToHill
					= (point & 0b111100000000) >> 8

				const index = i * channels

				if (isAnt) antcount++
				if (isAntAndFood) antcount++
				if (isFood) foodcount++
				if (isAntAndFood) foodcount++
				if (isFood) untouchedfoodcount++

				if (isAntAndFood) {
					image.data.set(colors.antAndFood, index)
				} else if (isAnt) {
					image.data.set(colors.ant, index)
				} else if (isFood) {
					image.data.set(colors.food, index)
				} else if (isAnthill) {
					image.data.set(colors.anthill, index)
				} else if (isPheromoneToFood && isPheromoneToHill) {
					image.data.set(colors.pheromoneBoth, index)
				} else if (isPheromoneToFood) {
					image.data.set(colors.pheromoneToFood, index)
				} else if (isPheromoneToHill) {
					image.data.set(colors.pheromoneToHill, index)
				} else {
					image.data.set(colors.void, index)
				}

				if (antcount > rangeSize * range) {
					ranges.push(i)
					range++
				}
			}

			if (!(i % 100)) {
				console.log('antcount', antcount, 'foodcount', foodcount, 'untouchedfoodcount', untouchedfoodcount)
			}

			previousAntCount = antcount
			ctx.putImageData(image, 0, 0)

			if (!(i % 100)) {
				ranges[workers.length] = data.length
				ranges.length = workers.length + 1
				console.log('ranges', workers.length, ranges.length, data.length, ranges)
				for (let i = 0; i < workers.length; i++) {
					post(i, "range", { from: ranges[i], to: ranges[i + 1] })
				}
			}
		}
		let rafId = requestAnimationFrame(loop)

		function launch(buffer: SharedArrayBuffer) {
			const parallelism = Math.max(1, navigator.hardwareConcurrency - 1)

			console.log('parallelism', parallelism)

			for (let i = 0; i < parallelism; i++) {
				const from = Math.floor(i * height / parallelism) * width
				const to = Math.floor((i + 1) * height / parallelism) * width
				const whose = i === 0 ? 'main' : 'worker'
				console.log(whose, 'from', from, 'to', to)
				if (!workers[i]) {
					workers[i] = new Worker()
					workers[i].addEventListener('message', onMessage)
				}
				const worker = new Worker()
				worker.postMessage({ type: "share", data: { buffer, width, height, vision, from, to } })
			}
		}

		let collected = 0
		const onMessage = (e: MessageEvent<Outgoing>) => {
			if (e.data.type === "started") {
				data = new Uint16Array(e.data.data.buffer)
				launch(e.data.data.buffer)
			} else if (e.data.type === "collected") {
				collected += e.data.data.count
				console.log("collected", e.data.data.count, "total", collected)
			} else {
				console.log('unknown message', e.data)
			}
			// } else if (e.data.type === "done") {
			// 	done = true
			// 	console.log("done")
			// }
		}

		workers[0].addEventListener('message', onMessage)
		post(0, "start", {
			width,
			height,
			count,
		})
		return () => {
			for (const worker of workers) {
				worker.removeEventListener('message', onMessage)
				worker.terminate()
			}
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
