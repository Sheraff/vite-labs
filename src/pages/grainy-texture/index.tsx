import styles from './styles.module.css'
import { Head } from "#components/Head"
import type { RouteMeta } from "#router"

export const meta: RouteMeta = {
	title: 'Grainy Texture',
	tags: ['css', 'svg', 'wip'],
}

export default function GrainyTexture() {
	return (
		<div className={styles.main}>
			<Head />
			{/* <div className={styles.content} /> */}
			<svg viewBox='0 0 600 600'>
				<filter id='a'>
					<feTurbulence
						type='fractalNoise'
						baseFrequency='.85'
						numOctaves='1'
					/>
				</filter>
				<filter id='b'>
					<feTurbulence
						type='fractalNoise'
						baseFrequency='.25'
						numOctaves='5'
					/>
				</filter>
			</svg>
		</div>
	)
}