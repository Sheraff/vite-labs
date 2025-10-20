import styles from './styles.module.css'
import { Head } from "#components/Head"
import type { RouteMeta } from "#router"
import { useEffect, useRef, useState } from "react"
import { getFormValue } from "#components/getFormValue"
import { makeFrameCounter } from "#components/makeFrameCounter"

import UpdateWorker from './realm.worker?worker'
import type { Incoming, Outgoing } from './realm.worker'

export const meta: RouteMeta = {
	title: 'Visual Exec',
	tags: ['wip']
}

const initialCode = `
const foo = [1, 2, 3]
for (let i = 0; i < foo.length; i++) {
	const value = foo[i] * 2
	foo[i] = value
}
console.log(foo)
return foo[0]
`.trim()

export default function VisualExecPage() {
	const formRef = useRef<HTMLFormElement>(null)
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		if (!formRef.current) return
		const form = formRef.current

		const controller = new AbortController()

		let clean: () => void

		form.addEventListener('submit', (e) => {
			e.preventDefault()
			clean?.()
			const source = getFormValue<string>(form, 'code') || ''
			clean = handleSource(source)
		}, { signal: controller.signal })

		return () => {
			controller.abort()
			clean?.()
		}
	}, [])

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<form ref={formRef} className={styles.form}>
				<textarea name="code" defaultValue={initialCode} />
				<canvas className={styles.canvas} />
				<button>Run</button>
			</form>
		</div>
	)
}

function handleSource(src: string) {
	const worker = new UpdateWorker()
	const controller = new AbortController()

	worker.addEventListener('message', (e: MessageEvent<Outgoing>) => {
		const data = e.data
		switch (data.type) {
			case "yield":
				console.log('yield', data.data)
				break
			case "done":
				console.log('done', data.data)
				break
			case "error":
				console.error('error', data.data)
				break
			case "log":
				console.log('log', data.data)
				break
		}
	}, { signal: controller.signal })

	worker.postMessage({
		type: "source",
		data: {
			id: 'main',
			code: src,
		}
	} satisfies Incoming)


	return () => {
		worker.terminate()
		controller.abort()
	}
}