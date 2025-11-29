import type { RouteMeta } from "#router"
import styles from './styles.module.css'
import { Head } from "#components/Head"
import { useEffect, useRef, useState } from "react"
import { PinballGame } from "./Pinball"
import { LevelEditor } from "./LevelEditor"
import type { BoardConfig } from "./types"

export const meta: RouteMeta = {
	title: 'Pinball',
	tags: ['game', 'wip']

}

const STORAGE_KEY = 'pinball-board-config'

const WIDTH = 400
const HEIGHT = 600
// const WIDTH = 500
// const HEIGHT = 750
// const WIDTH = 1000
// const HEIGHT = 1500

export default function PinballPage() {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const [mode, setMode] = useState<'play' | 'edit'>('play')
	const [boardConfig, setBoardConfig] = useState<BoardConfig | undefined>(() => {
		const stored = localStorage.getItem(STORAGE_KEY)
		return stored ? JSON.parse(stored) : undefined
	})
	const gameRef = useRef<PinballGame | null>(null)

	const handleSaveConfig = (config: BoardConfig) => {
		setBoardConfig(config)
		localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
		setMode('play')
	}

	useEffect(() => {
		if (mode !== 'play') return

		const canvas = canvasRef.current!

		// Calculate the aspect ratio of the game
		const gameAspectRatio = WIDTH / HEIGHT

		// Calculate available space
		const availableWidth = window.innerWidth
		const availableHeight = window.innerHeight
		const availableAspectRatio = availableWidth / availableHeight

		// Determine the canvas size that preserves aspect ratio and maximizes space
		let canvasWidth: number
		let canvasHeight: number

		if (availableAspectRatio > gameAspectRatio) {
			// Available space is wider than game ratio - constrain by height
			canvasHeight = availableHeight
			canvasWidth = canvasHeight * gameAspectRatio
		} else {
			// Available space is taller than game ratio - constrain by width
			canvasWidth = availableWidth
			canvasHeight = canvasWidth / gameAspectRatio
		}

		// Set canvas resolution (accounting for device pixel ratio)
		canvas.width = canvasWidth * devicePixelRatio
		canvas.height = canvasHeight * devicePixelRatio

		// Set canvas display size
		canvas.style.width = `${canvasWidth}px`
		canvas.style.height = `${canvasHeight}px`

		gameRef.current = new PinballGame({ canvas, config: boardConfig, width: WIDTH, height: HEIGHT })
		return () => {
			gameRef.current?.destroy()
			gameRef.current = null
		}
	}, [mode, boardConfig])

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
				<button
					className={styles.modeToggle}
					onClick={() => setMode(mode === 'play' ? 'edit' : 'play')}
				>
					{mode === 'play' ? '✏️ Edit' : '▶️ Play'}
				</button>
			</div>
			{mode === 'play' ? (
				<canvas ref={canvasRef} />
			) : (
				<LevelEditor
					width={WIDTH}
					height={HEIGHT}
					onSave={handleSaveConfig}
					initialConfig={boardConfig}
				/>
			)}
		</div>
	)
}