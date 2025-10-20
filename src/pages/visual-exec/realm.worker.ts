/// <reference lib="webworker" />

// import { parseForESLint } from '@typescript-eslint/parser/package.json'
// import { simpleTraverse } from '@typescript-eslint/typescript-estree'
import { parse } from 'acorn'
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
			result: IteratorResult<any>
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
		transform(src)
		const generator = new GeneratorFunction(`
			const global = undefined
			const globalThis = undefined
			const self = undefined
			const postMessage = undefined
			${src}
		`) as () => Generator<any, any, any>
		executor(generator(), id)
	}
}

function executor(gen: Generator<any, any, any>, id: string) {
	try {
		let result
		do {
			result = gen.next(result?.value)
			postMessage({ type: "yield", data: { result, id } } satisfies Outgoing)
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
	walk(ast, {
		YieldExpression(node) {
			throw new Error('Yield expressions disallowed in source code')
		}
	})
}
