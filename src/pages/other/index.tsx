import { Titi } from "@other/Titi"
import { Link } from "~/Navigation"
import type { RouteMeta } from "~/router"

export const meta: RouteMeta = {
	title: 'Other'
}

export default function Other() {
	return (
		<>
			<Link href="/">back</Link>
			<h1>hello paint other</h1>
			<Titi />
		</>
	)
}