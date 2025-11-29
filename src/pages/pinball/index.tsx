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
		const size = Math.min(window.innerWidth, window.innerHeight)
		canvas.width = size * devicePixelRatio
		canvas.height = size * devicePixelRatio
		canvas.style.width = `${size}px`
		canvas.style.height = `${size}px`

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