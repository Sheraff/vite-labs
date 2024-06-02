import { useEffect } from "react"
import { Link } from "~/Navigation"
import type { RouteMeta } from "~/router"
import styles from './styles.module.css'
import worklet from './waves.worklet?worker&url'

export const meta: RouteMeta = {
	title: 'Paint Worklet'
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
			<Link href="/">back</Link>
			<h1>{meta.title}</h1>
		</div>
	)
}