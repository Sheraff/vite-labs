/// <reference lib="webworker" />
import type { AssignmentExpression, CallExpression, MemberExpression, UpdateExpression } from "acorn"
import { parse, type Node } from 'acorn'
import { ancestor as walk } from "acorn-walk"
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
					code = transform(message.data.code)
					console.log(code)
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
	const prefix = 'async function* foo(){\n'
	const suffix = '\n}'
	const src = `${prefix}${original}${suffix}`

	const semis: number[] = []

	const ast = parse(src, {
		sourceType: 'module',
		ecmaVersion: 'latest',
		locations: true,
		ranges: true,
		onInsertedSemicolon(lastTokEnd) {
			semis.push(lastTokEnd)
		},
	})

	let is_malicious = false
	const isMalicious = () => { is_malicious = true }
	walk(ast, {
		YieldExpression: isMalicious,
		ImportDeclaration: isMalicious,
		ExportNamedDeclaration: isMalicious,
		ExportDefaultDeclaration: isMalicious,
		ExportAllDeclaration: isMalicious,
		DebuggerStatement: isMalicious,
		WithStatement: isMalicious,
		ThisExpression: isMalicious,
		Identifier(node) {
			if (node.name === 'arguments') isMalicious()
			else if (node.name === 'eval') isMalicious()
			else if (node.name === 'importScripts') isMalicious()
			else if (node.name === 'window') isMalicious()
			else if (node.name === 'global') isMalicious()
			else if (node.name === 'globalThis') isMalicious()
			else if (node.name === 'Function') isMalicious()
		},
		MemberExpression(node) {
			// forbid access to 'constructor', '__proto__', 'prototype' properties
			if (!node.computed && node.property.type === 'Identifier') {
				const propName = node.property.name
				if (propName === 'constructor' || propName === '__proto__' || propName === 'prototype' || propName === '__defineGetter__' || propName === '__defineSetter__') {
					isMalicious()
				}
			}
			if (node.computed && node.property.type === 'Literal') {
				const propName = String(node.property.value)
				if (propName === 'constructor' || propName === '__proto__' || propName === 'prototype' || propName === '__defineGetter__' || propName === '__defineSetter__') {
					isMalicious()
				}
			}
		}
	})
	if (is_malicious) {
		throw new Error(`Malicious code detected, ${JSON.stringify(is_malicious)}`)
	}

	const nodesToYield: Array<{ node: Node }> = []
	const bindThis = new Set<Node>()
	const userFunctions = new Set<Node>()

	const queueNode = (node: Node) => {
		const same = nodesToYield.findIndex((n) => n.node.start === node.start && n.node.end === node.end)
		if (same !== -1) {
			if (node.type === 'CallExpression') {
				// prefer yielding CallExpressions
				nodesToYield[same] = { node }
			}
		} else {
			nodesToYield.push({ node })
		}
	}

	// Collect nodes that should be yielded
	walk(ast, {
		FunctionDeclaration: (node) => userFunctions.add(node),
		ArrowFunctionExpression: (node) => userFunctions.add(node),
		// [].map(function() {}) or const a = { foo() { } }
		FunctionExpression: (node) => userFunctions.add(node),
		Literal: queueNode,
		BinaryExpression: queueNode,
		AssignmentExpression: queueNode,
		UpdateExpression: queueNode,
		CallExpression: queueNode,
		MemberExpression: (node, _, ancestors) => {
			// don't yield if
			// - the top parent of the MemberExpression chain is the left side of an AssignmentExpression
			// - the top parent of the MemberExpression chain is the argument of an UpdateExpression
			const top = ancestors.findLast(a => a.type !== 'MemberExpression')
			if (top) {
				if (top.type === 'AssignmentExpression' && (top as AssignmentExpression).left === node) {
					return
				}
				if (top.type === 'UpdateExpression' && (top as UpdateExpression).argument === node) {
					return
				}
			}
			// if the top parent of the MemberExpression chain is the callee of a CallExpression (e.g. `array.join('')`), we need to bind `this`
			if (top && top.type === 'CallExpression' && (top as CallExpression).callee === node) {
				return
				// bindThis.add(node)
			}
			queueNode(node)
		},
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

	nodesToYield.sort((a, b) => {
		if (a.node.start !== b.node.start) {
			return a.node.start - b.node.start
		}
		return b.node.end - a.node.end
	})

	// console.log('nodesToYield')
	// for (const { node } of nodesToYield) {
	// 	console.log(node.start, node.end, src.slice(node.start, node.end))
	// }

	// console.log('semis')
	// for (const semi of semis) {
	// 	console.log(semi)
	// }

	const s = new MagicString(src)

	for (const { node } of nodesToYield) {
		let before = ''
		before += '('
		before += 'yield '
		before += '{ '
		before += `loc: { start: { line: ${node.loc!.start.line - prefix.length}, column: ${node.loc!.start.column - prefix.length} }, end: { line: ${node.loc!.end.line - prefix.length}, column: ${node.loc!.end.column - prefix.length} } },`
		before += `start: ${node.start - prefix.length}, end: ${node.end - prefix.length},`
		before += 'value: ('
		if (node.type === 'CallExpression') before += 'yield* ('
		s.appendLeft(node.start, before)
		let after = ')'
		if (node.type === 'CallExpression') after += ')'
		if (bindThis.has(node)) {
			after += '.bind('
			after += src.slice((node as MemberExpression).object.start, (node as MemberExpression).object.end)
			after += ')'
		}
		after += ' }'
		after += ')'
		s.prependRight(node.end, after)
		const semi_index = semis.indexOf(node.end)
		if (semi_index !== -1) {
			s.appendRight(node.end, ';')
			semis.splice(semi_index, 1)
		}
	}

	return s.toString().slice(prefix.length, -suffix.length)
}