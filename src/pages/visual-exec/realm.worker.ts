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

	function handleSource(src: string, id: string) {
		const GeneratorFunction = (function* () { }.constructor) as typeof Function
		const yielding = transform(src)
		console.log('yielding source:\n', yielding)
		const generator = new GeneratorFunction(`
			const global = undefined
			const globalThis = undefined
			const self = undefined
			const postMessage = undefined
			${yielding}
		`) as () => Generator<any, any, any>
		executor(generator(), id)
	}
}

function executor(gen: Generator<any, any, any>, id: string) {
	try {
		let result
		do {
			result = gen.next(result?.value)
			postMessage({ type: "yield", data: { value: result.value, id } } satisfies Outgoing)
		} while (!result.done)
		postMessage({ type: "done", data: { result: result.value, id } } satisfies Outgoing)
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

		// Collect nodes that should be yielded
		walk(ast, {
			// YieldExpression() {
			// 	throw new Error('Yield expressions disallowed in source code')
			// },
			Literal(node, _, ancestors) {
				if (ancestors.at(-2)?.type === 'YieldExpression') return
				nodesToYield.push({ node, depth: ancestors.length })
			},
			BinaryExpression(node, _, ancestors) {
				if (ancestors.at(-2)?.type === 'YieldExpression') return
				nodesToYield.push({ node, depth: ancestors.length })
			},
			AssignmentExpression(node, _, ancestors) {
				if (ancestors.at(-2)?.type === 'YieldExpression') return
				nodesToYield.push({ node, depth: ancestors.length })
			},
			UpdateExpression(node, _, ancestors) {
				if (ancestors.at(-2)?.type === 'YieldExpression') return
				nodesToYield.push({ node, depth: ancestors.length })
			},
			CallExpression(node, _, ancestors) {
				if (ancestors.at(-2)?.type === 'YieldExpression') return
				nodesToYield.push({ node, depth: ancestors.length })
			},
			// MemberExpression(node, _,ancestors) {
			ArrayExpression(node, _, ancestors) {
				if (ancestors.at(-2)?.type === 'YieldExpression') return
				nodesToYield.push({ node, depth: ancestors.length })
			}
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
				transformedCode.push('(yield (')
				transformedCode.push(src.slice(node.start, node.end))
				transformedCode.push('))')
				lastIndex = node.end
			}
		}

		// Add remaining code
		transformedCode.push(src.slice(lastIndex))

		src = transformedCode.join('')
	}

	return src.slice(prefix.length, -suffix.length)
}
