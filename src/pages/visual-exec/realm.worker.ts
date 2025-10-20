/// <reference lib="webworker" />

// import { parseForESLint } from '@typescript-eslint/parser/package.json'
// import { simpleTraverse } from '@typescript-eslint/typescript-estree'
import { parse, type Node } from 'acorn'
import { ancestor as walk } from "acorn-walk"

export type Incoming =
	| {
		type: "init",
		data: {
			foo: string
		}
	}
	| {
		type: "source",
		data: {
			id: string
			code: string
		}
	}

export type Outgoing =
	| {
		type: "yield",
		data: {
			id: string
			value: string
			loc: {
				start: { line: number, column: number }
				end: { line: number, column: number }
			}
		}
	}
	| {
		type: "log",
		data: {
			id: string
			value: string
			level: 'log' | 'error' | 'warn'
		}
	}
	| {
		type: "done",
		data: {
			id: string
			result: any
		}
	}
	| {
		type: "error",
		data: {
			id: string
			error: any
		}
	}

{
	self.onmessage = (e: MessageEvent<Incoming>) => handleMessage(e.data)
	function handleMessage(data: Incoming) {
		switch (data.type) {
			case "init":
				break
			case "source":
				handleSource(data.data.code, data.data.id)
				break
		}
	}

	const postConsole = {
		log: (...args: any[]) => {
			postMessage({ type: "log", data: { id: 'main', value: args.map(String).join(' '), level: 'log' } } satisfies Outgoing)
		},
		error: (...args: any[]) => {
			postMessage({ type: "log", data: { id: 'main', value: args.map(String).join(' '), level: 'error' } } satisfies Outgoing)
		},
		warn: (...args: any[]) => {
			postMessage({ type: "log", data: { id: 'main', value: args.map(String).join(' '), level: 'warn' } } satisfies Outgoing)
		},
	}

	function handleSource(src: string, id: string) {
		const GeneratorFunction = (async function* () { }.constructor) as typeof Function
		const yielding = transform(src)
		console.log('yielding source:\n', yielding)
		const generator = new GeneratorFunction('postConsole', `
			const console = postConsole
			const global = undefined
			const globalThis = undefined
			const self = undefined
			const postMessage = undefined
			${yielding}
		`).bind(
			null,
			postConsole
		) as () => AsyncGenerator<any, any, any>
		executor(generator(), id)
	}
}

async function executor(gen: AsyncGenerator<any, any, any>, id: string) {
	try {
		let result
		do {
			result = await gen.next(result?.value?.value)
			if (!result.done) {
				postMessage({ type: "yield", data: { value: JSON.stringify(result.value.value), id, loc: result.value.loc } } satisfies Outgoing)
				await new Promise<void>((resolve) => setTimeout(() => resolve(), 500))
			}
		} while (!result.done)
		postMessage({ type: "done", data: { result: JSON.stringify(result.value), id } } satisfies Outgoing)
	} catch (error) {
		postMessage({ type: "error", data: { error: String(error), id } } satisfies Outgoing)
	}
}

/**
 * - Throw if the source contains any yield expressions
 * - Transform the source code to add yield statements everywhere possible

```js
const foo = [1, 2, 3]
for (let i = 0; i < foo.length; i++) {
	const value = foo[i] * 2
	foo[i] = value
}
```
becomes
```js
const foo = (yield ([(yield (1)), (yield (2)), (yield (3))]))
for (let i = (yield (0)); (yield (i < foo.length)); (yield (i++))) {
	const value = (yield ((yield (foo[i] * (yield (2))))
	(yield (foo[i] = value))))
}
```

*/
function transform(src: string) {
	const marker_start = '/*yielded*/'
	const marker_end = '/*unyielded*/'
	const prefix = 'function* foo(){\n'
	const suffix = '\n}'
	src = `${prefix}${src}${suffix}`
	while (true) {
		let ast
		try {
			ast = parse(src, {
				sourceType: 'module',
				ecmaVersion: 'latest',
				locations: true,
				ranges: true,
			})

		} catch (e) {
			console.error('Parse error:', e)
			console.log('Source was:\n', src)
			throw e
		}

		const transformedCode: string[] = []
		let lastIndex = 0

		const nodesToYield: { node: Node, depth: number }[] = []

		const queueNode = (node: Node, state: unknown, ancestors: Node[]) => {
			if (ancestors.at(-2)?.type === 'YieldExpression') return
			const start = src.slice(0, node.start).lastIndexOf(marker_start)
			const end = start !== -1 ? src.slice(start, node.start).lastIndexOf(marker_end) : 0
			if (end === -1) return
			nodesToYield.push({ node, depth: ancestors.length })
		}

		// Collect nodes that should be yielded
		walk(ast, {
			// YieldExpression() {
			// 	throw new Error('Yield expressions disallowed in source code')
			// },
			// we should forbid yield, imports, exports, debugger, arguments, with
			Literal: queueNode,
			BinaryExpression: queueNode,
			AssignmentExpression: queueNode,
			UpdateExpression: queueNode,
			CallExpression: queueNode,
			// MemberExpression: queueNode,
			ArrayExpression: queueNode,
		})

		if (nodesToYield.length === 0) {
			break
		}

		const deepestDepth = Math.max(...nodesToYield.map(n => n.depth))
		// Filter to only deepest nodes to avoid double-yielding
		const filteredNodesToYield = nodesToYield.filter(n => n.depth === deepestDepth)

		// Sort nodes by start position, then by end position (deepest first for same start)
		filteredNodesToYield.sort((a, b) => {
			if (a.node.start !== b.node.start) {
				return a.node.start - b.node.start
			}
			return b.node.end - a.node.end // Deeper nodes first when at same position
		})

		for (const { node } of filteredNodesToYield) {
			if (node.start > lastIndex) {
				transformedCode.push(src.slice(lastIndex, node.start))
				const wrap = node.type !== 'AssignmentExpression' && node.type !== 'UpdateExpression'
				transformedCode.push(marker_start)
				if (wrap) transformedCode.push('(')
				transformedCode.push('yield ')
				transformedCode.push(`{ loc: { start: { line: ${node.loc!.start.line}, column: ${node.loc!.start.column} }, end: { line: ${node.loc!.end.line}, column: ${node.loc!.end.column} } }, value: (`)
				transformedCode.push(src.slice(node.start, node.end))
				transformedCode.push(') }')
				transformedCode.push(marker_end)
				if (wrap) transformedCode.push(')')
				lastIndex = node.end
			}
		}

		// Add remaining code
		transformedCode.push(src.slice(lastIndex))

		src = transformedCode.join('')

		// console.log('\n\n\n')
		// console.log(src)
		// console.log('\n\n\n')
	}

	return src.slice(prefix.length, -suffix.length)
}
