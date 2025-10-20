/// <reference lib="webworker" />

// import { parseForESLint } from '@typescript-eslint/parser/package.json'
// import { simpleTraverse } from '@typescript-eslint/typescript-estree'
import { parse, type Node } from 'acorn'
import { simple as walk } from "acorn-walk"
import MagicString from 'magic-string'

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
			},
			start: number
			end: number
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
				postMessage({
					type: "yield",
					data: {
						value: JSON.stringify(result.value.value),
						id,
						loc: result.value.loc,
						start: result.value.start,
						end: result.value.end,
					}
				} satisfies Outgoing)
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
function transform(original: string) {
	const prefix = 'function* foo(){\n'
	const suffix = '\n}'
	const src = `${prefix}${original}${suffix}`

	let ast = parse(src, {
		sourceType: 'module',
		ecmaVersion: 'latest',
		locations: true,
		ranges: true,
	})

	const nodesToYield: { node: Node }[] = []

	const queueNode = (node: Node) => {
		nodesToYield.push({ node })
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
		ReturnStatement: (node) => {
			if (node.argument) queueNode(node.argument)
		}
	})

	if (nodesToYield.length === 0) {
		return original
	}

	const s = new MagicString(src)

	for (const { node } of nodesToYield) {
		const wrap = node.type !== 'AssignmentExpression' && node.type !== 'UpdateExpression'
		let before = ''
		if (wrap) before += '('
		before += 'yield '
		before += '{ '
		before += `loc: { start: { line: ${node.loc!.start.line - prefix.length}, column: ${node.loc!.start.column - prefix.length} }, end: { line: ${node.loc!.end.line - prefix.length}, column: ${node.loc!.end.column - prefix.length} } },`
		before += `start: ${node.start - prefix.length}, end: ${node.end - prefix.length},`
		before += 'value: ('
		s.prependLeft(node.start, before)
		let after = ''
		after += ') }'
		if (wrap) after += ')'
		s.appendRight(node.end, after)
	}

	return s.toString().slice(prefix.length, -suffix.length)
}
