import styles from './styles.module.css'
import { Head } from "#components/Head"
import type { RouteMeta } from "#router"
import { useEffect, useRef } from "react"
import { getFormValue } from "#components/getFormValue"

export const meta: RouteMeta = {
	title: 'Tinkerbell Map',
	image: './screen.png',
	tags: ['math', 'chaos', 'attractor']
}

export default function TinkerbellMap() {
	const ref = useRef<HTMLCanvasElement>(null)
	const formRef = useRef<HTMLFormElement>(null)
	useEffect(() => {
		const canvas = ref.current!
		const form = formRef.current!
		const ctx = canvas.getContext('2d')!
		const width = canvas.width = window.innerWidth
		const height = canvas.height = window.innerHeight
		const controller = new AbortController()

		const params = {
			a: 0.9,
			b: -0.6013,
			c: 2,
			d: 0.5,
			x0: -0.72,
			y0: -0.64,
		}

		const state = {
			x: params.x0,
			y: params.y0,
		}

		const onInput = () => {
			params.a = getFormValue<number>(form, 'a')!
			params.b = getFormValue<number>(form, 'b')!
			params.c = getFormValue<number>(form, 'c')!
			params.d = getFormValue<number>(form, 'd')!
			params.x0 = getFormValue<number>(form, 'x0')!
			params.y0 = getFormValue<number>(form, 'y0')!
			state.x = params.x0
			state.y = params.y0

			console.log(params)
		}
		onInput()
		form.addEventListener('input', onInput, { signal: controller.signal })

		const preset1Button = form.elements.namedItem('preset-1') as HTMLButtonElement
		preset1Button.addEventListener('click', () => {
			const a = form.elements.namedItem('a') as HTMLInputElement
			a.value = '0.9'
			const b = form.elements.namedItem('b') as HTMLInputElement
			b.value = '-0.6013'
			const c = form.elements.namedItem('c') as HTMLInputElement
			c.value = '2'
			const d = form.elements.namedItem('d') as HTMLInputElement
			d.value = '0.5'
			const x0 = form.elements.namedItem('x0') as HTMLInputElement
			x0.value = '-0.72'
			const y0 = form.elements.namedItem('y0') as HTMLInputElement
			y0.value = '-0.64'
			ctx.clearRect(0, 0, width, height)
			onInput()
		}, { signal: controller.signal })

		const preset2Button = form.elements.namedItem('preset-2') as HTMLButtonElement
		preset2Button.addEventListener('click', () => {
			const a = form.elements.namedItem('a') as HTMLInputElement
			a.value = '0.3'
			const b = form.elements.namedItem('b') as HTMLInputElement
			b.value = '0.6'
			const c = form.elements.namedItem('c') as HTMLInputElement
			c.value = '2'
			const d = form.elements.namedItem('d') as HTMLInputElement
			d.value = '0.27'
			const x0 = form.elements.namedItem('x0') as HTMLInputElement
			x0.value = '0.2'
			const y0 = form.elements.namedItem('y0') as HTMLInputElement
			y0.value = '0.2'
			ctx.clearRect(0, 0, width, height)
			onInput()
		}, { signal: controller.signal })

		const randomButton = form.elements.namedItem('random') as HTMLButtonElement
		randomButton.addEventListener('click', () => {
			const a = form.elements.namedItem('a') as HTMLInputElement
			a.value = (Math.random() * 4 - 2).toString()
			const b = form.elements.namedItem('b') as HTMLInputElement
			b.value = (Math.random() * 4 - 2).toString()
			const c = form.elements.namedItem('c') as HTMLInputElement
			c.value = (Math.random() * 4 - 2).toString()
			const d = form.elements.namedItem('d') as HTMLInputElement
			d.value = (Math.random() * 4 - 2).toString()
			const x0 = form.elements.namedItem('x0') as HTMLInputElement
			x0.value = (Math.random() * 4 - 2).toString()
			const y0 = form.elements.namedItem('y0') as HTMLInputElement
			y0.value = (Math.random() * 4 - 2).toString()
			ctx.clearRect(0, 0, width, height)
			onInput()
		}, { signal: controller.signal })

		const updatesPerFrame = 1000
		let rafId = requestAnimationFrame(function draw() {
			rafId = requestAnimationFrame(draw)

			for (let i = 0; i < updatesPerFrame; i++) {
				const nextX = state.x ** 2 - state.y ** 2 + params.a * state.x + params.b * state.y
				const nextY = 2 * state.x * state.y + params.c * state.x + params.d * state.y
				state.x = nextX
				state.y = nextY

				ctx.fillStyle = 'white'
				ctx.fillRect((nextX + 3) / 6 * width, (nextY + 3) / 6 * height, 1, 1)
			}

			ctx.fillStyle = 'rgba(0, 0, 0, 0.01)'
			ctx.fillRect(0, 0, width, height)
		})

		return () => {
			cancelAnimationFrame(rafId)
			controller.abort()
		}
	}, [])
	return (
		<main className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<form ref={formRef}>
				<fieldset>
					<legend>Settings</legend>
					<input type="range" defaultValue="0.9" min="-2" max="2" name="a" id="a" step="0.0000001" />
					<label htmlFor="a">a</label>
					<input type="range" defaultValue="-0.6013" min="-2" max="2" name="b" id="b" step="0.0000001" />
					<label htmlFor="b">b</label>
					<input type="range" defaultValue="2" min="-2" max="2" name="c" id="c" step="0.0000001" />
					<label htmlFor="c">c</label>
					<input type="range" defaultValue="0.5" min="-2" max="2" name="d" id="d" step="0.0000001" />
					<label htmlFor="d">d</label>
					<input type="range" defaultValue="-0.72" min="-2" max="2" name="x0" id="x0" step="0.0000001" />
					<label htmlFor="x0">x0</label>
					<input type="range" defaultValue="-0.64" min="-2" max="2" name="y0" id="y0" step="0.0000001" />
					<label htmlFor="y0">y0</label>
					<button type="button" id="random" name="random">Randomize</button>
					<button type="button" id="preset-1" name="preset-1">Preset 1</button>
					<button type="button" id="preset-2" name="preset-2">Preset 2</button>
				</fieldset>
			</form>
			<canvas ref={ref}></canvas>
		</main>
	)
}