import { Link, useNavigation } from "~/file-router/Navigation"
import { ROUTES } from "~/router"
import styles from './Head.module.css'

export function Head() {
	const route = useNavigation()
	if (!route) return null
	const { title } = ROUTES[route].meta

	return (
		<>
			<Link href="/" className={styles.both}>back</Link>
			<h1 style={{ viewTransitionName: route }} className={styles.both}>{title}</h1>
		</>
	)
}