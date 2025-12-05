import type { RouteMeta } from "#router"

import { Head } from "#components/Head"
import { Fragment, useEffect, useState } from "react"

import styles from "./styles.module.css"

export const meta: RouteMeta = {
	title: "Intl Tuesday",
	image: "./screen.png",
	tags: ["Intl", "locales"],
}

export default function IntlTuesdayPage() {
	const [translations, setTranslations] = useState<{ locale: string; name: string }[]>([])

	useEffect(() => {
		const delay = 50 // ms
		const day = 2 // Tuesday

		const locales = new Set<string>()
		const date = new Date()
		date.setDate(date.getDate() + ((day + 7 - date.getDay()) % 7))
		const format = { weekday: "long" } as const

		async function push(candidate: string) {
			const [locale] = Intl.getCanonicalLocales(Intl.DateTimeFormat.supportedLocalesOf(candidate))
			if (!locale || locales.has(locale)) return
			locales.add(locale)
			await new Promise((r) => setTimeout(r, delay))
			const name = new Intl.DateTimeFormat(locale, format).format(date)
			setTranslations((t) => [...t, { locale, name }])
		}

		void (async function () {
			const letters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))
			for (const a of letters) {
				for (const b of letters) {
					await push(a + b)
					for (const c of letters) {
						await push(a + b + c)
					}
				}
			}
		})()
	}, [])

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
				<output htmlFor="content">{translations.length.toString().padStart(2, "0")} locales</output>
			</div>
			<div className={styles.content} id="content">
				{translations.map((t, i) => (
					<Fragment key={t.locale}>
						{i > 0 ? " " : null}
						<span lang={t.locale}>{t.name}</span>
					</Fragment>
				))}
			</div>
		</div>
	)
}
