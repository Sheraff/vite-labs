import { Link, useNavigation } from "#file-router/Navigation"
import { ROUTES, type RouteMeta } from "#router"

import styles from "./Head.module.css"

export function Head() {
	const route = useNavigation()
	if (!route) return null
	const { title, description } = ROUTES[route].meta as RouteMeta
	const source = `https://github.com/Sheraff${import.meta.env.BASE_URL}blob/main/src/pages/${route}/index.tsx`

	return (
		<>
			<Link href="/" className={styles.both}>
				back
			</Link>
			<h1 style={{ viewTransitionName: route }} className={styles.both}>
				{title}
			</h1>
			{description && <p className={styles.both + " " + styles.desc}>{description}</p>}
			<a href={source} target="_blank" className={styles.both}>
				view source on github
			</a>
			<title>{`${title} - Sheraff demos`}</title>
		</>
	)
}
