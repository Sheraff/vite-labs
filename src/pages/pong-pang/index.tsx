import { Link } from "~/Navigation"
import styles from './styles.module.css'
import { useEffect, useState } from "react"
import type { Incoming } from "./worker"
import Worker from "./worker?worker"

export const meta = {
	title: 'Pong Pang'
}

export default function PongPang() {
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

		post("canvas", { canvas: offscreen }, [offscreen])
		return () => worker.terminate()
	}, [offscreen])
	return (
		<div className={styles.main}>
			<Link href="/">back</Link>
			<h1>{meta.title}</h1>
			<canvas width="1000" height="1000" ref={c => {
				if (c && c !== canvas) {
					setCanvas(c)
					setOffscreen(c.transferControlToOffscreen())
				}
			}}>
				Your browser does not support the HTML5 canvas tag.
			</canvas>
		</div>
	)
}