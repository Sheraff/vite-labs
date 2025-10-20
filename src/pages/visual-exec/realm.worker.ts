/// <reference lib="webworker" />

// import { parseForESLint } from '@typescript-eslint/parser/package.json'
// import { simpleTraverse } from '@typescript-eslint/typescript-estree'
import { parse, type Node } from 'acorn'
import { simple as walk } from "acorn-walk"

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
const foo = yield [1, 2, 3]
for (let i = yield 0; yield (i < foo.length); yield i++) {
	const value = yield foo[i] * 2
	yield foo[i] = value
}
```

*/
function transform(src: string) {
	const ast = parse(src, {
		sourceType: 'module',
		ecmaVersion: 'latest',
		locations: true,
		ranges: true,
	})

	const transformedCode: string[] = []
	let lastIndex = 0

	const nodesToYield: Node[] = []

	// Collect nodes that should be yielded
	walk(ast, {
		YieldExpression() {
			throw new Error('Yield expressions disallowed in source code')
		},
		Literal(node) {
			nodesToYield.push(node)
		},
		BinaryExpression(node) {
			nodesToYield.push(node)
		},
		AssignmentExpression(node) {
			nodesToYield.push(node)
		},
		UpdateExpression(node) {
			nodesToYield.push(node)
		},
		CallExpression(node) {
			nodesToYield.push(node)
		},
		// MemberExpression(node) {
		// 	nodesToYield.push(node)
		// },
		ArrayExpression(node) {
			nodesToYield.push(node)
		}
	})

	// Sort nodes by their start position
	nodesToYield.sort((a, b) => a.start - b.start)

	// Transform the code by inserting yields
	for (const node of nodesToYield) {
		if (node.start > lastIndex) {
			transformedCode.push(src.slice(lastIndex, node.start))
			transformedCode.push('yield ')
			lastIndex = node.start
		}
	}

	// Add remaining code
	transformedCode.push(src.slice(lastIndex))

	return transformedCode.join('')
}
