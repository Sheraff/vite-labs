/// <reference lib="webworker" />
import { parse, type Node } from 'acorn'
import { simple as walk } from "acorn-walk"
import MagicString from 'magic-string'

export type Incoming =
	| {
		type: "source",
		data: {
			id: string,
			code: string,
		}
	}

export type Outgoing =
	| {
		type: "transformed",
		data: {
			id: string,
			code: string,
		}
	}
	| {
		type: "error",
		data: {
			id: string,
			error: string,
		}
	}

{
	self.onmessage = (e: MessageEvent<Incoming>) => handleMessage(e.data)
	function handleMessage(message: Incoming) {
		switch (message.type) {
			case "source": {
				let code
				try {
					code = handleSource(message.data.code)
				} catch (err: any) {
					self.postMessage({
						type: "error",
						data: {
							id: message.data.id,
							error: String(err),
						}
					})
					return
				}
				self.postMessage({
					type: "transformed",
					data: {
						id: message.data.id,
						code,
					}
				})
				break
			}
			default:
				console.error('Unknown message type:', message.type)
		}
	}
}

function handleSource(src: string): string {
	if (isCodeMalicious(src)) {
		throw new Error('Malicious code detected')
	}
	const res = transform(src)
	return res
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

TODO:
- Literal that is the initializer of a variable should report the location of the entire parent VariableDeclarator
- Reimplement most common methods (e.g., Math.*, String.*, Array.*, Set.*, Map.*) to use yield (and call them w/ yield*)
*/
function transform(original: string) {
	const prefix = 'function* foo(){\n'
	const suffix = '\n}'
	const src = `${prefix}${original}${suffix}`

	const semis: number[] = []

	let ast = parse(src, {
		sourceType: 'module',
		ecmaVersion: 'latest',
		locations: true,
		ranges: true,
		onInsertedSemicolon(lastTokEnd) {
			semis.push(lastTokEnd)
		},
	})

	const nodesToYield: Array<{ node: Node }> = []

	const queueNode = (node: Node) => {
		for (const n of nodesToYield) {
			if (n.node.start === node.start && n.node.end === node.end) return
		}
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
		},
		VariableDeclarator: (node) => {
			if (node.init) queueNode(node.init)
		}
	})

	if (nodesToYield.length === 0) {
		return original
	}

	const s = new MagicString(src)

	for (const { node } of nodesToYield) {
		let wrap = node.type !== 'AssignmentExpression' && node.type !== 'UpdateExpression'
		if (wrap) {
			const last_new_line = src.slice(0, node.start).lastIndexOf('\n')
			const prefix_semi = last_new_line !== -1 && src.slice(last_new_line, node.start).match(/^[\s\n]*$/)
			if (prefix_semi) wrap = false
		}
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

const forbidden = [
	'constructor',
	'__proto__',
	'prototype',
	'Function',
	'eval',
	'importScripts',
	'postMessage',
	'window',
]
function isCodeMalicious(code: string): boolean {
	return forbidden.some(pattern => code.includes(pattern))
}