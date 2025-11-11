import styles from './styles.module.css'
import { Head } from "#components/Head"
import type { RouteMeta } from "#router"
import { useEffect, useState } from "react"

export const meta: RouteMeta = {
	title: 'Any string to CSS color',
	tags: ['wip']
}

const tanstack = [
	'tanstack-start',
	'tanstack-router',
	'tanstack-query',
	'tanstack-table',
	'tanstack-form',
	'tanstack-db',
	'tanstack-virtual',
	'tanstack-pacer',
	'tanstack-store',
	'tanstack-ranger',
	'tanstack-config',
	'tanstack-devtools',
	'tanstack-ai'
]

export default function AnyStringToCSSColorPage() {
	const [colors, setColors] = useState<string[]>(tanstack)

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<div className={styles.content}>
				{colors.map((str, i) => (
					<Box key={i} color={str} onChange={(newColor) => {
						const newColors = [...colors]
						newColors[i] = newColor
						setColors(newColors)
					}} onDelete={() => {
						const newColors = [...colors]
						newColors.splice(i, 1)
						setColors(newColors)
					}} />
				))}
				<button className={styles.addButton} onClick={() => {
					setColors([...colors, ''])
				}}>Add color</button>
			</div>
		</div>
	)
}

function Box({ color, onChange, onDelete }: { color: string, onChange: (newColor: string) => void, onDelete: () => void }) {
	const [result, setResult] = useState<string>('')
	useEffect(() => {
		let active = true
		digestMessage(color).then((hash) => {
			if (!active) return
			const { hue, lightness, chroma } = hashToColorParams(hash)
			const oklch = `oklch(${lightness.toFixed(1)}% ${chroma.toFixed(2)} ${hue.toFixed(1)})`
			setResult(oklch)
		})
		return () => {
			active = false
		}
	}, [color])
	return (
		<article style={{ backgroundColor: result }} className={styles.colorBox}>
			<input type="text" value={color} onChange={(e) => onChange(e.target.value)} />
			→ {result}
			<button onClick={onDelete}>×</button>
		</article>
	)
}

function hashToColorParams(hash: ArrayBuffer): { hue: number, lightness: number, chroma: number } {
	const hashArray = Array.from(new Uint8Array(hash))

	// Use different parts of the hash for different color properties
	const hue = ((hashArray[0] << 8) | hashArray[1]) / 65535 * 360
	const lightness = 55 + (hashArray[2] / 255) * 35 // 55-90% range
	const chroma = 0.12 + (hashArray[3] / 255) * 0.18 // 0.12-0.30 range

	return { hue, lightness, chroma }
}

async function digestMessage(message: string) {
	const encoder = new TextEncoder()
	const data = encoder.encode(message)
	const hash = await window.crypto.subtle.digest("SHA-256", data)
	return hash
}