import { useEffect } from "react"
import type { RouteMeta } from "~/router"
import styles from './styles.module.css'
import worklet from './waves.worklet?worker&url'
import { Head } from "~/components/Head"

export const meta: RouteMeta = {
	title: 'Paint Worklet',
	image: './screen.png',
	tags: ['css']
}

declare global {
	namespace CSS {
		export const paintWorklet: {
			addModule: (url: string) => void
		}
	}
}

export default function PaintWorklet() {

	useEffect(() => {
		CSS.paintWorklet.addModule(worklet)
	}, [])

	return (
		<div className={styles.main}>
			<Head />
		</div>
	)
}