import type { RouteMeta } from "#router"
import styles from './styles.module.css'
import { Head } from "#components/Head"
import { useEffect, useRef, useState, type CSSProperties } from "react"
import { PinballGame } from "./Pinball"

export const meta: RouteMeta = {
	title: 'Pinball',
	tags: ['game', 'wip']

}
export default function PinballPage() {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current!
		const size = Math.min(window.innerWidth, window.innerHeight)
		canvas.width = size * devicePixelRatio
		canvas.height = size * devicePixelRatio
		canvas.style.width = `${size}px`
		canvas.style.height = `${size}px`
		const pinball = new PinballGame({ canvas })
		return () => pinball.destroy()
	}, [])

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<canvas ref={canvasRef} />
		</div>
	)
}