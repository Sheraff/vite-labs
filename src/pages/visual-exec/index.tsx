import styles from './styles.module.css'
import { Head } from "#components/Head"
import type { RouteMeta } from "#router"
import { useEffect, useRef, useState } from "react"
import { getFormValue } from "#components/getFormValue"

import TransformWorker from './transform.worker?worker'
import IframeSource from './iframe.html?raw'
import type { Incoming, Outgoing } from './transform.worker'

export const meta: RouteMeta = {
	title: 'Visual Exec (WIP)',
	image: './screen.png'
}

// const initialCode = `
// /* Fibonacci sequence */

// const n = 10;
// if (n <= 1) return n;

// let a = 0, b = 1;
// for (let i = 2; i <= n; i++) {
// 	let temp = a + b;
// 	a = b;
// 	b = temp;
// }

// return b;
// `.trim()

const initialCode = `
// Bubble Sort Algorithm
let arr = [64, 34, 25, 12, 22, 11, 90, 88, 76, 50, 47];
let n = arr.length;

console.log("Original array: " + arr.join(", "));

// Bubble sort implementation
for (let i = 0; i < n - 1; i++) {
	let swapped = false;

	for (let j = 0; j < n - i - 1; j++) {

		if (arr[j] > arr[j + 1]) {

			// Swap elements
			let temp = arr[j];
			arr[j] = arr[j + 1];
			arr[j + 1] = temp;

			swapped = true;
		}

	}

	// If no swapping occurred, array is sorted
	if (!swapped) {
		console.log("No swaps needed - array is sorted!");
		break;
	}
}

console.log("Final sorted array: " + arr.join(", "));

// Verify it's sorted
let isSorted = true;
for (let i = 0; i < arr.length - 1; i++) {
	if (arr[i] > arr[i + 1]) {
		isSorted = false;
		break;
	}
}

console.log("Is array sorted? " + isSorted);
`.trim()

export default function VisualExecPage() {
	const formRef = useRef<HTMLFormElement>(null)
	const highlighterRef = useRef<HTMLDivElement>(null)
	const container = useRef<HTMLDivElement>(null)
	const [value, setValue] = useState<string>(initialCode)

	useEffect(() => {
		if (!formRef.current || !highlighterRef.current || !container.current) return
		const form = formRef.current
		const highlighter = highlighterRef.current
		const parent = container.current
		return start(form, highlighter, parent)
	}, [])

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<form ref={formRef} className={styles.form}>
				<button>Run</button>
				<div className={styles.textarea} ref={container}>
					<textarea
						name="code"
						value={value}
						onChange={e => setValue(e.target.value)}
					/>
					<div ref={highlighterRef} className={styles.content}>
						{value}
					</div>
				</div>
			</form>
		</div>
	)
}

function start(form: HTMLFormElement, highlighter: HTMLElement, parent: HTMLElement) {
	const controller = new AbortController()
	let clean: () => void

	const transformWorker = new TransformWorker()

	function getTransformedCode(source: string): Promise<string> {
		const id = Math.random().toString(16).slice(2)
		return new Promise<string>((resolve, reject) => {
			const onMessage = (e: MessageEvent<Outgoing>) => {
				if (e.data.data.id !== id) return
				transformWorker.removeEventListener('message', onMessage)
				switch (e.data.type) {
					case "transformed":
						resolve(e.data.data.code)
						break
					case "error":
						reject(new Error(e.data.data.error))
						break
					default:
						reject(new Error('Unknown message type: ' + (e.data as any).type))
				}
			}
			transformWorker.addEventListener('message', onMessage, { signal: controller.signal })
			transformWorker.postMessage({
				type: "source",
				data: {
					id,
					code: source,
				}
			} satisfies Incoming)
		})
	}

	form.addEventListener('submit', async (e) => {
		e.preventDefault()
		clean?.()
		const source = getFormValue<string>(form, 'code') || ''
		const transformed = await getTransformedCode(source)
		clean = handleSource(transformed, highlighter, parent)
	}, { signal: controller.signal })

	return () => {
		controller.abort()
		clean?.()
		transformWorker.terminate()
	}
}

function handleSource(src: string, highlighter: HTMLElement, parent: HTMLElement) {
	// const highlights_id = CSS.escape(Math.random().toString(16).slice(2))
	const highlights_id = 'foo'

	const iframe = createIframeRealm(src, (data) => {
		switch (data.type) {
			case "yield": {
				console.log('yield', data.data)
				const range = new Range()
				const textNode = highlighter.firstChild!
				range.setStart(textNode, data.data.start)
				range.setEnd(textNode, data.data.end)
				CSS.highlights.delete(highlights_id)
				CSS.highlights.set(highlights_id, new Highlight(range))
				const parentRect = parent.getBoundingClientRect()
				const rect = range.getBoundingClientRect()
				const el = document.createElement('span')
				el.classList.add(styles.value)
				const top = rect.height + rect.top - parentRect.top + parent.scrollTop - el.offsetHeight
				const left = rect.width / 2 + rect.left - parentRect.left + parent.scrollLeft
				const minWidth = rect.width
				el.style.setProperty('--top', `${top}px`)
				el.style.setProperty('--left', `${left}px`)
				el.style.setProperty('--min-width', `${minWidth}px`)

				el.textContent = data.data.value
				parent.appendChild(el)
				el.addEventListener('animationend', () => el.remove(), { once: true })
				break
			}
			case "done":
				console.log('done', data.data)
				iframe.destroy()
				break
			case "error":
				console.error('error', data.data)
				iframe.destroy()
				break
			case "log":
				console.log('log', data.data)
				break
		}
	})


	return () => {
		iframe.destroy()
		CSS.highlights.delete(highlights_id)
	}
}


function createIframeRealm(src: string, onMessage: (e: IframeMessage) => void) {
	const id = Math.random().toString(16).slice(2)

	const iframe = document.createElement('iframe')
	iframe.sandbox.add('allow-scripts')
	iframe.className = styles.iframe

	const html = IframeSource
		.replaceAll('/*-- ORIGIN --*/', window.location.origin)
		.replaceAll('/*-- ID --*/', id)
		.replace('/*-- SOURCE --*/', src)
	iframe.src = 'data:text/html,' + encodeURIComponent(html)
	document.body.appendChild(iframe)

	const controller = new AbortController()
	window.addEventListener('message', (e: MessageEvent<IframeMessage>) => {
		if (e.data.data.id !== id) return
		onMessage(e.data)
	}, { signal: controller.signal })

	return {
		destroy: () => {
			iframe.remove()
			controller.abort()
		},
		postMessage: (message: Incoming) => {
			iframe.contentWindow?.postMessage(message, '*')
		}
	}
}

export type IframeMessage =
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