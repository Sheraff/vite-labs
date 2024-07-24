// generated by file-router
/* eslint-disable */
import { lazy } from "react"
import spider_inverse_kinematics_image from "./pages/spider-inverse-kinematics/screen.png"
import quad_tree_image from "./pages/quad-tree/screen.png"
import pong_pang_image from "./pages/pong-pang/screen.png"
import perlin_ripples_image from "./pages/perlin-ripples/screen.png"
import paint_worklet_image from "./pages/paint-worklet/screen.png"
import lightning_image from "./pages/lightning/screen.png"
import bird_inverse_kinematics_image from "./pages/bird-inverse-kinematics/screen.png"

export type Routes = "spider-inverse-kinematics" | "quad-tree" | "pong-pang" | "perlin-ripples" | "paint-worklet" | "modern-modal" | "lightning" | "fragment-portal" | "bird-inverse-kinematics"

export type RouteMeta = {
	title: string
	image?: string
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
	"spider-inverse-kinematics": {
		Component: lazy(() => import("./pages/spider-inverse-kinematics/index.tsx")),
		meta: {
			title: 'Spider Inverse Kinematics',
			image: spider_inverse_kinematics_image
		},
		git: {
			lastModified: 1717364036000,
			firstAdded: 1717339261000
		},
	},
	"quad-tree": {
		Component: lazy(() => import("./pages/quad-tree/index.tsx")),
		meta: {
			title: 'Quad Tree',
			image: quad_tree_image
		},
		git: {
			lastModified: 1717364022000,
			firstAdded: 1717339261000
		},
	},
	"pong-pang": {
		Component: lazy(() => import("./pages/pong-pang/index.tsx")),
		meta: {
			title: 'Pong Pang',
			image: pong_pang_image
		},
		git: {
			lastModified: 1717361196000,
			firstAdded: 1717337533000
		},
	},
	"perlin-ripples": {
		Component: lazy(() => import("./pages/perlin-ripples/index.tsx")),
		meta: {
			title: 'Perlin ripples',
			image: perlin_ripples_image
		},
		git: {
			lastModified: 1721843231000,
			firstAdded: 1717339261000
		},
	},
	"paint-worklet": {
		Component: lazy(() => import("./pages/paint-worklet/index.tsx")),
		meta: {
			title: 'Paint Worklet',
			image: paint_worklet_image
		},
		git: {
			lastModified: 1717361196000,
			firstAdded: 1717321960000
		},
	},
	"modern-modal": {
		Component: lazy(() => import("./pages/modern-modal/index.tsx")),
		meta: {
			title: 'Modern Modal',
		},
		git: {
			lastModified: 1717538613000,
			firstAdded: 1717538613000
		},
	},
	"lightning": {
		Component: lazy(() => import("./pages/lightning/index.tsx")),
		meta: {
			title: 'Lightning',
			image: lightning_image
		},
		git: {
			lastModified: 1717571804000,
			firstAdded: 1717331001000
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
	},
	"bird-inverse-kinematics": {
		Component: lazy(() => import("./pages/bird-inverse-kinematics/index.tsx")),
		meta: {
			title: 'Bird Inverse Kinematics',
			image: bird_inverse_kinematics_image
		},
		git: {
			lastModified: 1717365547000,
			firstAdded: 1717339261000
		},
	}
} as const satisfies Record<Routes, Route>
