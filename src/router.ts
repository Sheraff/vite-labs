// generated by file-router
/* eslint-disable */
import { lazy } from "react"
import wave_function_collapse_ascii_image from "./pages/wave-function-collapse-ascii/screen.png"
import wave_function_collapse_image from "./pages/wave-function-collapse/screen.png"
import spider_inverse_kinematics_image from "./pages/spider-inverse-kinematics/screen.png"
import quad_tree_collisions_image from "./pages/quad-tree-collisions/screen.png"
import quad_tree_image from "./pages/quad-tree/screen.png"
import pong_pang_image from "./pages/pong-pang/screen.png"
import perlin_ripples_image from "./pages/perlin-ripples/screen.png"
import paint_worklet_image from "./pages/paint-worklet/screen.png"
import minesweeper_image from "./pages/minesweeper/screen.png"
import lightning_image from "./pages/lightning/screen.png"
import hex_a_star_image from "./pages/hex-a-star/screen.png"
import hacker_background_image from "./pages/hacker-background/screen.png"
import flow_field_image from "./pages/flow-field/screen.png"
import flask_image from "./pages/flask/screen.png"
import collision_threads_image from "./pages/collision-threads/screen.png"
import bird_inverse_kinematics_image from "./pages/bird-inverse-kinematics/screen.png"
import ants_image from "./pages/ants/screen.png"
import a_star_image from "./pages/a-star/screen.png"

export type Routes = "wave-function-collapse-ascii" | "wave-function-collapse" | "spider-inverse-kinematics" | "quad-tree-collisions" | "quad-tree" | "pong-pang" | "perlin-ripples" | "paint-worklet" | "modern-modal" | "minesweeper" | "lightning" | "hex-a-star" | "hacker-background" | "fragment-portal" | "flow-field" | "flask" | "collision-threads" | "bird-inverse-kinematics" | "ants" | "a-star"

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
	"wave-function-collapse-ascii": {
		Component: lazy(() => import("./pages/wave-function-collapse-ascii/index.tsx")),
		meta: {
			title: 'Ascii wave function collapse',
			image: wave_function_collapse_ascii_image
		},
		git: {
			lastModified: 1740479450000,
			firstAdded: 1727995709000
		},
	},
	"wave-function-collapse": {
		Component: lazy(() => import("./pages/wave-function-collapse/index.tsx")),
		meta: {
			title: 'Wave Function Collapse',
			image: wave_function_collapse_image
		},
		git: {
			lastModified: 1740492145000,
			firstAdded: 1727995709000
		},
	},
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
	"quad-tree-collisions": {
		Component: lazy(() => import("./pages/quad-tree-collisions/index.tsx")),
		meta: {
			title: 'Quad Tree Collisions',
			image: quad_tree_collisions_image
		},
		git: {
			lastModified: 1740318653000,
			firstAdded: 1739742825000
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
			lastModified: 1721858837000,
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
	"minesweeper": {
		Component: lazy(() => import("./pages/minesweeper/index.tsx")),
		meta: {
			title: 'Minesweeper',
			image: minesweeper_image
		},
		git: {
			lastModified: 1740477071000,
			firstAdded: 1738530954000
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
	"hex-a-star": {
		Component: lazy(() => import("./pages/hex-a-star/index.tsx")),
		meta: {
			title: 'Hexagonal A*',
			image: hex_a_star_image
		},
		git: {
			lastModified: 1740492272000,
			firstAdded: 1727995709000
		},
	},
	"hacker-background": {
		Component: lazy(() => import("./pages/hacker-background/index.tsx")),
		meta: {
			title: 'Hacker Background',
			image: hacker_background_image
		},
		git: {
			lastModified: 1740529871000,
			firstAdded: 1739742825000
		},
	},
	"fragment-portal": {
		Component: lazy(() => import("./pages/fragment-portal/index.tsx")),
		meta: {
			title: 'Fragment Portal'
		},
		git: {
			lastModified: 1739611669000,
			firstAdded: 1717340075000
		},
	},
	"flow-field": {
		Component: lazy(() => import("./pages/flow-field/index.tsx")),
		meta: {
			title: 'Flow Field',
			image: flow_field_image
		},
		git: {
			lastModified: 1740958810000,
			firstAdded: 1727995709000
		},
	},
	"flask": {
		Component: lazy(() => import("./pages/flask/index.tsx")),
		meta: {
			title: 'Flask',
			image: flask_image
		},
		git: {
			lastModified: 1740307562000,
			firstAdded: 1737497494000
		},
	},
	"collision-threads": {
		Component: lazy(() => import("./pages/collision-threads/index.tsx")),
		meta: {
			title: 'Collision Threads',
			image: collision_threads_image
		},
		git: {
			lastModified: 1740505056000,
			firstAdded: 1727995709000
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
	},
	"ants": {
		Component: lazy(() => import("./pages/ants/index.tsx")),
		meta: {
			title: 'Ants',
			image: ants_image
		},
		git: {
			lastModified: 1733684415000,
			firstAdded: 1727995709000
		},
	},
	"a-star": {
		Component: lazy(() => import("./pages/a-star/index.tsx")),
		meta: {
			title: 'A*',
			image: a_star_image
		},
		git: {
			lastModified: 1740478315000,
			firstAdded: 1727995709000
		},
	}
} as const satisfies Record<Routes, Route>
