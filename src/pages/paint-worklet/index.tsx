import { Link } from "~/Navigation"
import type { RouteMeta } from "~/router"

export const meta: RouteMeta = {
	title: 'Paint Worklet'
}

export default function PaintWorklet() {
	return (
		<>
			<Link href="/">back</Link>
			<h1>hello paint worklet</h1>
		</>
	)
}