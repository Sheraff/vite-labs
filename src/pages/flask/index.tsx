import type { RouteMeta } from "#router"

import { Head } from "#components/Head"

import styles from "./styles.module.css"

export const meta: RouteMeta = {
	title: "Flask",
	image: "./screen.png",
	tags: ["animation", "css"],
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
				{/* <div className={styles.bubbles}>
					<div />
					<div />
					<div />
					<div />
					<div />
				</div> */}
				<div className={styles.shadow}></div>
			</div>
		</div>
	)
}
