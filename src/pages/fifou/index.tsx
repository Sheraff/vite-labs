import { Link } from "~/Navigation"
import type { RouteMeta } from "~/router"

export const meta: RouteMeta = {
	title: 'Fifou'
}

export default function Fifou() {
	return (
		<>
			<Link href="/">back</Link>
			<h1>hello fifou</h1>
		</>
	)
}