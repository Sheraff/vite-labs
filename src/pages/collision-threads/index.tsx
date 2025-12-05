import type { RouteMeta } from "#router"

import { Head } from "#components/Head"
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react"

import type { Incoming as CanvasIncoming } from "./workers/canvas.worker"
import type { Incoming as ProcessIncoming } from "./workers/process.worker"

import styles from "./styles.module.css"
import CanvasWorker from "./workers/canvas.worker?worker"
import ProcessWorker from "./workers/process.worker?worker"

export const meta: RouteMeta = {
	title: "Collision Threads",
	image: "./screen.png",
	tags: ["simulation", "performance", "physics"],
}

function usePost<const T extends { type: string; data: unknown }>(worker: Worker) {
	return useCallback(
		function post<I extends T["type"]>(type: I, data: Extract<T, { type: I }>["data"], transfer?: Transferable[]) {
			worker.postMessage({ type, data }, { transfer })
		},
		[worker],
	)
}

export default function CollisionThreadsPage() {
	const [side] = useState(() => Math.min(window.innerHeight, window.innerWidth) * window.devicePixelRatio)

	const [uiCanvas, setUICanvas] = useState<HTMLCanvasElement | null>(null)
	const [uiOffscreen, setUIOffscreen] = useState<OffscreenCanvas | null>(null)

	const [mainCanvas, setMainCanvas] = useState<HTMLCanvasElement | null>(null)
	const [mainOffscreen, setMainOffscreen] = useState<OffscreenCanvas | null>(null)

	const [canvasWorker] = useState(() => new CanvasWorker())
	const [processWorker] = useState(() => new ProcessWorker())

	const postCanvas = usePost<CanvasIncoming>(canvasWorker)
	const postProcess = usePost<ProcessIncoming>(processWorker)

	useEffect(() => {
		const channel = new MessageChannel()
		postCanvas("channel", { port: channel.port1 }, [channel.port1])
		postProcess("channel", { port: channel.port2 }, [channel.port2])
		return () => {
			canvasWorker.terminate()
			processWorker.terminate()
		}
	}, [canvasWorker, processWorker])

	useEffect(() => {
		if (!uiOffscreen || !mainOffscreen) return
		postCanvas("init", { side, main: mainOffscreen, ui: uiOffscreen }, [mainOffscreen, uiOffscreen])
		postProcess("init", { side })
	}, [uiOffscreen, mainOffscreen])

	useEffect(() => {
		if (!mainCanvas) return

		mainCanvas.addEventListener("click", ({ x, y }) => {
			postProcess("mouse", {
				mouse: {
					x: (x * side) / mainCanvas.offsetWidth,
					y: (y * side) / mainCanvas.offsetHeight,
				},
			})
		})
		window.addEventListener("keydown", (event) => {
			if (event.key === "Escape") {
				event.preventDefault()
				postProcess("mouse", { mouse: null })
			}
		})

		let playing = true
		document.addEventListener("visibilitychange", () => {
			if (playing) {
				const status = document.visibilityState === "visible"
				postProcess("toggle", { status })
				postCanvas("toggle", { status })
			}
		})

		window.addEventListener("keydown", (event) => {
			if (event.key === " ") {
				event.preventDefault()
				playing = !playing
				const status = playing
				postProcess("toggle", { status })
				postCanvas("toggle", { status })
			}
		})
	}, [mainCanvas])

	const canvasRef = (
		current: HTMLCanvasElement | null,
		setter: Dispatch<SetStateAction<HTMLCanvasElement | null>>,
		offscreenSetter: Dispatch<SetStateAction<OffscreenCanvas | null>>,
		canvas: HTMLCanvasElement | null,
	) => {
		if (canvas && canvas !== current) {
			setter(canvas)
			canvas.height = side
			canvas.width = side
			offscreenSetter(canvas.transferControlToOffscreen())
		}
	}

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<canvas width="1000" height="1000" ref={canvasRef.bind(null, uiCanvas, setUICanvas, setUIOffscreen)} />
			<canvas width="1000" height="1000" ref={canvasRef.bind(null, mainCanvas, setMainCanvas, setMainOffscreen)} />
		</div>
	)
}
