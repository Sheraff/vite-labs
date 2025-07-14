import { useEffect, useState } from "react"
import { Head } from "~/components/Head"
import styles from './styles.module.css'
import type { RouteMeta } from "~/router"
import type { Incoming } from "./worker"
import Worker from "./worker?worker"

export const meta: RouteMeta = {
	title: 'Perlin ripples',
	image: './screen.png',
	tags: ['random', 'animation']
}

export default function Perlin() {
	const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
	const [offscreen, setOffscreen] = useState<OffscreenCanvas | null>(null)

	useEffect(() => {
		if (!offscreen) return

		const worker = new Worker()
		function post<I extends Incoming["type"]>(
			type: I,
			data: Extract<Incoming, { type: I }>["data"],
			transfer?: Transferable[]
		) {
			worker.postMessage({ type, data }, { transfer })
		}

		post("canvas", {
			canvas: offscreen,
			height: canvas!.width,
			width: canvas!.width
		}, [offscreen])
		return () => worker.terminate()
	}, [offscreen])


	return (
		<div className={styles.main}>
			<Head />
			<canvas ref={c => {
				if (c && c !== canvas) {
					setCanvas(c)
					c.width = window.innerWidth * ((devicePixelRatio - 1) / 2 + 1)
					c.height = window.innerHeight * ((devicePixelRatio - 1) / 2 + 1)
					setOffscreen(c.transferControlToOffscreen())
				}
			}}>
				Your browser does not support the HTML5 canvas tag.
			</canvas>
		</div>
	)
}

