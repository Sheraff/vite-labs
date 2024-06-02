import { createLogger, type Plugin } from 'vite'
import {
	// @ts-expect-error -- glob is not in the types yet
	glob,
	readFile,
	writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { parseForESLint } from '@typescript-eslint/parser'
import { simpleTraverse } from '@typescript-eslint/typescript-estree'
import type { TSESLint } from '@typescript-eslint/utils'

const template = (routes: Array<[key: string, meta: string]>) => `// generated by file-router
/* eslint-disable */
import { lazy } from "react"

export type Routes = "${routes.map(r => r[0]).join('" | "')}"

export type RouteMeta = {
	title: string
}

export type Route = {
	Component: React.LazyExoticComponent<() => JSX.Element>
	meta: RouteMeta
}

export const ROUTES = {
${routes.map(([route, meta]) => `	"${route}": {
		Component: lazy(() => import("./pages/${route}/index.tsx")),
		meta: ${meta.split('\n').join('\n\t\t')},
	}`).join(',\n')}
} as const satisfies Record<Routes, Route>
`

export function fileRouter(): Plugin {
	const logger = createLogger('info', { prefix: '[file-router]' })
	let latestContent = ''

	async function generate() {
		const start = Date.now()
		let count = 0
		const routes: Array<[key: string, meta: string]> = []
		const prefix = 'src/pages/'
		const suffix = '/index.tsx'
		for await (const index of glob(`${prefix}*${suffix}`)) {
			count++
			const source = await readFile(index, 'utf-8')
			const { ast, visitorKeys } = parseForESLint(source, {
				comment: false,
				filePath: index,
				loc: true,
				range: true,
				tokens: false,
			})
			let meta = '{}'
			const listener: TSESLint.RuleListener = ({
				ExportNamedDeclaration(node) {
					if (node.declaration?.type !== 'VariableDeclaration') return
					const decl = node.declaration.declarations[0]
					if (decl.type !== 'VariableDeclarator') return
					if (decl.id.type !== 'Identifier' || decl.id.name !== 'meta') return
					if (decl.init?.type !== 'ObjectExpression') throw new Error('Expected ObjectExpression')
					meta = source.slice(decl.init.range[0], decl.init.range[1])
				}
			})
			simpleTraverse(ast, {
				visitorKeys,
				visitors: listener as never
			})
			routes.push([index.slice(prefix.length, -suffix.length), meta])
		}
		logger.info(`scanned ${count} routes in ${Date.now() - start} ms`, { timestamp: true })

		const content = template(routes)

		if (latestContent === content) return
		latestContent = content

		await writeFile('./src/router.ts', content)
	}


	return {
		name: 'file-router',
		enforce: 'pre',
		configureServer(server) {
			const listener = (file = '') => (file.includes(path.normalize('/src/pages/')) ? generate() : null)
			server.watcher.on('add', listener)
			server.watcher.on('change', listener)
			server.watcher.on('unlink', listener)
		},
		buildStart: generate,
	}
}
