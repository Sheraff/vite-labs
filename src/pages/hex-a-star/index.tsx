import type { RouteMeta } from "~/router"
import styles from './styles.module.css'
import { Head } from "~/components/Head"
import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import Worker from "./canvas.worker?worker"
import type { Incoming } from "./canvas.worker"

export const meta: RouteMeta = {
	title: 'Hexagonal A*',
	image: './screen.png',
	tags: ['pathfinding', 'data structures']
}

const setSeed = (state: string) => window.location.replace(`#${state}`)

export default function HexAStarPage() {
	const seed = useSyncExternalStore(
		(sub) => {
			window.addEventListener('hashchange', sub)
			return () => window.removeEventListener('hashchange', sub)
		},
		() => {
			const existing = location.hash
			if (existing) return existing.slice(1)
			const initial = generateSeed()
			setSeed(initial)
			return initial
		},
	)

	const [side, setSide] = useState(0)
	const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
	const [offscreen, setOffscreen] = useState<OffscreenCanvas | null>(null)
	const [worker] = useState(() => new Worker())
	const post = useCallback(function post<I extends Incoming["type"]>(
		type: I,
		data: Extract<Incoming, { type: I }>["data"],
		transfer?: Transferable[]
	) {
		worker.postMessage({ type, data }, { transfer })
	}, [worker])

	useEffect(() => {
		if (!offscreen) return
		post('canvas', { canvas: offscreen, side }, [offscreen])
	}, [offscreen])

	useEffect(() => {
		if (!seed) return
		post('seed', { seed })
	}, [seed])

	useEffect(() => () => {
		worker.terminate()
	}, [worker])

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
				<button type="button" onClick={() => setSeed(generateSeed())}>Retry with a new seed</button>
			</div>
			<canvas width="1000" height="1000" ref={c => {
				if (c && c !== canvas) {
					setCanvas(c)
					const side = Math.min(window.innerHeight, window.innerWidth)
					setSide(side)
					c.height = side * window.devicePixelRatio
					c.width = side * window.devicePixelRatio
					setOffscreen(c.transferControlToOffscreen())
				}
			}}>
				Your browser does not support the HTML5 canvas tag.
			</canvas>
		</div>
	)
}

function generateSeed() {
	return String(Math.round(1_000_000_000_000 * Math.random()))
}