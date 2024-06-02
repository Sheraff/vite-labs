// generated by file-router
/* eslint-disable */
import { lazy } from "react"

export type Routes = "quad-tree" | "pong-pang" | "paint-worklet" | "lightning" | "fragment-portal"

export type RouteMeta = {
	title: string
	image?: string | Promise<string>
	description?: string
}

export type GitMeta = {
	lastModified: number
	firstAdded: number
}

export type Route = {
	Component: React.LazyExoticComponent<() => JSX.Element>
	meta: RouteMeta
	git: GitMeta
}

export const ROUTES = {
	"quad-tree": {
		Component: lazy(() => import("./pages/quad-tree/index.tsx")),
		meta: {
			title: 'Quad Tree',
			image: import("./pages/quad-tree/screen.png").then(m => m.default)
		},
		git: {
			lastModified: NaN,
			firstAdded: NaN
		},
	},
	"pong-pang": {
		Component: lazy(() => import("./pages/pong-pang/index.tsx")),
		meta: {
			title: 'Pong Pang',
			image: import("./pages/pong-pang/screen.png").then(m => m.default)
		},
		git: {
			lastModified: NaN,
			firstAdded: NaN
		},
	},
	"paint-worklet": {
		Component: lazy(() => import("./pages/paint-worklet/index.tsx")),
		meta: {
			title: 'Paint Worklet',
			image: import("./pages/paint-worklet/screen.png").then(m => m.default)
		},
		git: {
			lastModified: NaN,
			firstAdded: NaN
		},
	},
	"lightning": {
		Component: lazy(() => import("./pages/lightning/index.tsx")),
		meta: {
			title: 'Lightning',
			image: import("./pages/lightning/screen.png").then(m => m.default)
		},
		git: {
			lastModified: NaN,
			firstAdded: NaN
		},
	},
	"fragment-portal": {
		Component: lazy(() => import("./pages/fragment-portal/index.tsx")),
		meta: {
			title: 'Fragment Portal'
		},
		git: {
			lastModified: 1717341556000,
			firstAdded: 1717340075000
		},
	}
} as Record<Routes, Route>
