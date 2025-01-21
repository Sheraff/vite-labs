import styles from './styles.module.css'
import { Head } from "~/components/Head"
import type { RouteMeta } from "~/router"

export const meta: RouteMeta = {
	title: 'Flask',
}

export default function Flask() {

	return (
		<div className={styles.main}>
			<Head />

			<div className={styles.content}>

				<div className={styles.bottle}>
					<div className={styles.liquid}></div>
					<div className={styles.lip}></div>
				</div>
				<div className={styles.shadow}></div>
			</div>
		</div>
	)
}
