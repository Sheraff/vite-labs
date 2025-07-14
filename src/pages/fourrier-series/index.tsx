import type { RouteMeta } from "~/router"
import styles from './styles.module.css'
import { Head } from "~/components/Head"
import { useEffect, useRef } from "react"

export const meta: RouteMeta = {
	title: 'Fourrier Series',
	tags: ['animation', 'music'],
	image: './screen.png'
}

export default function FourrierSeriesPage() {
	const ref = useRef<HTMLCanvasElement | null>(null)
	const formRef = useRef<HTMLFormElement | null>(null)
	useEffect(() => {
		const canvas = ref.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return
		const form = formRef.current
		if (!form) return

		canvas.height = window.innerHeight * window.devicePixelRatio
		canvas.width = window.innerWidth * window.devicePixelRatio


		return start(ctx, form)
	}, [])

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<canvas width="1000" height="1000" ref={ref}>
				Your browser does not support the HTML5 canvas tag.
			</canvas>
			<form ref={formRef} className={styles.form}>
				<fieldset>
					<legend>Controls</legend>
					<label htmlFor="series">Series:</label>
					<select name="series" id="series" defaultValue="Square Wave">
						{Object.keys(SERIES).map((name, i) => (
							<option key={i} value={name}>{name}</option>
						))}
					</select>
					<label htmlFor="speed">Speed</label>
					<input type="range" name="speed" id="speed" min="1" max="100" defaultValue="20" />
				</fieldset>
			</form>
		</div>
	)
}

const MAX_FREQUENCY = 5000

const SERIES = {
	'A7 Chord': [440.00, 523.25, 659.26, 783.99],
	'C Major Chord': [261.63, 329.63, 392.00],
	'C Minor Chord': [261.63, 311.13, 392.00],
	'E pentatonic': [329.63, 369.99, 415.30, 493.88, 554.37, 659.26],
	'D octaves': [18.35, 36.71, 73.42, 146.83, 293.66, 587.33, 1174.66, 2349.32, 4698.64],
	'G7 (orchestral)': [98.00, 293.66, 493.88, 698.46],
	'Sawtooth': [440, 880, 1320, 1760, 2200, 2640, 3080, 3520, 3960, 4400],
	'Square Wave': [100, 300, 500, 700, 900, 1100, 1300, 1500, 1700, 1900],
	'Very Square Wave': [100, 300, 500, 700, 900, 1100, 1300, 1500, 1700, 1900, 2100, 2300, 2500, 2700, 2900, 3100, 3300, 3500, 3700, 3900, 4100, 4300, 4500, 4700, 4900, 5100, 5300, 5500, 5700, 5900, 6100, 6300, 6500, 6700, 6900, 7100, 7300, 7500],
}

function start(ctx: CanvasRenderingContext2D, form: HTMLFormElement) {

	const state = {
		series: [] as number[],
		left: 0,
		visualScaling: 0,
		timeScaling: 0,
		origin: [0, 0] as [x: number, y: number],
		speed: 0,
	}

	const store: number[] = []
	let initialTime = 0
	let lastTime = 0
	let paused = false
	let gapStart = 0
	let rafId = requestAnimationFrame(function animate(time) {
		rafId = requestAnimationFrame(animate)
		if (!initialTime) {
			initialTime = time
			return
		}
		if (paused) {
			initialTime += time - gapStart
			paused = false
		}
		lastTime = time

		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

		let [x, y] = state.origin
		for (let i = 0; i < state.series.length; i++) {
			const frequency = MAX_FREQUENCY / state.series[i]
			const radius = frequency * state.visualScaling
			const angle = (time - initialTime) / 1000 / state.timeScaling * state.speed / frequency * Math.PI

			ctx.strokeStyle = `hsl(${i / state.series.length * 360}, 100%, 50%)`
			ctx.lineWidth = 2
			drawCircle(ctx, x, y, radius)

			ctx.strokeStyle = '#FFFFFF22'
			ctx.lineWidth = 1
			ctx.beginPath()
			ctx.moveTo(x, y)
			x += radius * Math.cos(angle)
			y += radius * Math.sin(angle)
			ctx.lineTo(x, y)
			ctx.stroke()
			ctx.closePath()
		}
		store.push(y)
		if (store.length > 10000) {
			store.shift()
		}

		const offset = state.left * 2

		ctx.strokeStyle = '#FFFFFF22'
		ctx.lineWidth = 1
		ctx.beginPath()
		ctx.moveTo(x, y)
		ctx.lineTo(offset, y)
		ctx.stroke()
		ctx.closePath()

		ctx.strokeStyle = 'white'
		ctx.lineWidth = 2
		ctx.beginPath()
		ctx.moveTo(offset, y)
		for (let i = store.length - 2; i >= 0; i--) {
			const y = store[i]
			ctx.lineTo(offset + (store.length - i - 1), y)
		}
		ctx.stroke()
		ctx.closePath()
	})


	const controller = new AbortController()
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			paused = true
			gapStart = lastTime
		}
	}, { signal: controller.signal })

	const onInput = () => {
		const name = getValue<keyof typeof SERIES>(form, 'series')!

		state.series = SERIES[name]
		const { left, visualScaling, timeScaling } = computeScales(ctx, state.series)
		state.left = left
		state.visualScaling = visualScaling
		state.timeScaling = timeScaling
		state.origin = [left, ctx.canvas.height / 2]

		state.speed = getValue<number>(form, 'speed')!
	}
	onInput()
	form.addEventListener('input', onInput, { signal: controller.signal })

	return () => {
		cancelAnimationFrame(rafId)
		controller.abort()
	}
}

function computeScales(ctx: CanvasRenderingContext2D, series: number[]) {
	const baseLeft = series.reduce((acc, val) => acc + MAX_FREQUENCY / val, 0)
	const visualScaling = Math.min(ctx.canvas.width, ctx.canvas.height) / (baseLeft * 4)
	const left = baseLeft * visualScaling

	const timeScaling = series[0] / 100
	return { left, visualScaling, timeScaling }
}

function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
	ctx.beginPath()
	ctx.arc(x, y, radius, 0, Math.PI * 2)
	ctx.stroke()
	ctx.closePath()
}

function getValue<T,>(form: HTMLFormElement, name: string): T | undefined {
	if (!(name in form.elements)) return undefined
	const element = form.elements[name as keyof typeof form.elements]
	if (element instanceof HTMLSelectElement) return element.value as T
	if (element instanceof HTMLInputElement) {
		if (element.type === 'range') {
			return element.valueAsNumber as T
		}
		if (element.type === 'checkbox') {
			return element.checked as T
		}
	}
}