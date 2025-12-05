import { Head } from "#components/Head"
import { Link, useNavigation } from "#file-router/Navigation"
import { ROUTES, type Routes } from "#router"
import { Component, Suspense, useMemo, type ReactNode } from "react"

import styles from "./App.module.css"

export default function App() {
	const list = useMemo(
		() =>
			Object.entries(ROUTES)
				.filter(([, { meta }]) =>
					import.meta.env.PROD ? !("tags" in meta) || !(meta.tags as string[]).includes("wip") : true,
				)
				.sort(([a], [b]) => a.localeCompare(b))
				.sort((a, b) => sortDates(b[1].git.lastModified, a[1].git.lastModified))
				.sort((a, b) => sortDates(b[1].git.firstAdded, a[1].git.firstAdded)),
		[],
	)

	const route = useNavigation()
	const Component = route ? ROUTES[route].Component : null
	if (Component)
		return (
			<ErrorBoundary>
				<Suspense>
					<Component />
				</Suspense>
			</ErrorBoundary>
		)

	return (
		<>
			<h1 className={styles.h1}>🤍 none of this is useful 🤍</h1>
			{list.map(([route, { meta, git }], i) => (
				<Link key={route} className={styles.route} href={`/${route as Routes}`}>
					<h2 style={{ viewTransitionName: route }} className={styles.link}>
						{meta.title}
					</h2>
					{"tags" in meta && meta.tags.length > 0 && (
						<p className={styles.tags}>
							{meta.tags.map((t) => (
								<span key={t}>{t}</span>
							))}
						</p>
					)}
					<p>Created on: {git.firstAdded && formatter.format(git.firstAdded)}</p>
					{"image" in meta && meta.image && (
						<img src={meta.image} className={styles.bg} loading={i > 5 ? "lazy" : "eager"} />
					)}
				</Link>
			))}
		</>
	)
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
	state = { hasError: false }
	static getDerivedStateFromError() {
		return { hasError: true }
	}
	render() {
		if (this.state.hasError) {
			return (
				<div className={styles.error}>
					<Head />
					<pre>Something went wrong.</pre>
				</div>
			)
		}

		return this.props.children
	}
}

const formatter = new Intl.DateTimeFormat("en", {
	dateStyle: "full",
	timeStyle: "short",
})

function sortDates(a: number, b: number) {
	if (a === b) return 0
	if (a === 0) return 1
	if (b === 0) return -1
	if (Number.isNaN(a)) return 1
	if (Number.isNaN(b)) return -1
	return a - b
}
