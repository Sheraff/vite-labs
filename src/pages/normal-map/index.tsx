import type { RouteMeta } from "~/router"
import styles from './styles.module.css'
import { Head } from "~/components/Head"
import { useEffect, useRef } from "react"

// textures from https://www.cgbookcase.com/textures
import normal_source from './world/map.jpg'
import color_source from './world/color.jpg'

import { easings, getImageData, inputs_length, makeSharedImageData, type Inputs } from "./utils"
import DotWorker from './dot.worker?worker'
import type { Incoming as DotIncoming } from './dot.worker'

const screen_width = window.innerWidth // * window.devicePixelRatio
const screen_height = window.innerHeight // * window.devicePixelRatio
const fit: 'contain' | 'cover' = 'cover'

const normal_map = await getImageData(normal_source, { fit, width: screen_width, height: screen_height })
const color_map = await getImageData(color_source, { fit, width: screen_width, height: screen_height })

export const meta: RouteMeta = {
	title: 'Normal Map',
	image: './screen.png'
}

export default function NormalMapPage() {
	const ref = useRef<HTMLCanvasElement | null>(null)
	const formRef = useRef<HTMLFormElement | null>(null)
	useEffect(() => {
		const canvas = ref.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return
		const form = formRef.current
		if (!form) return

		canvas.width = screen_width
		canvas.height = screen_height

		const [inputs, clearLightSource] = handleInputs(canvas, form)

		const result = makeSharedImageData(normal_map.width, normal_map.height)
		const local_copy = new ImageData(result.width, result.height)

		const { width, height } = normal_map

		const dot_workers: Worker[] = []
		const concurrency = Math.max(1, navigator.hardwareConcurrency - 1)
		for (let i = 0; i < concurrency; i++) {
			const worker = new DotWorker()
			const total = width * height
			const segment = Math.ceil(total / concurrency)
			const start = i * segment
			const end = Math.min(start + segment, total)
			worker.postMessage({
				type: 'init',
				data: {
					inputs: inputs.buffer,
					normal_map: {
						data: normal_map.data.buffer as SharedArrayBuffer,
						width: normal_map.width,
						height: normal_map.height,
					},
					color_map: {
						data: color_map.data.buffer as SharedArrayBuffer,
						width: color_map.width,
						height: color_map.height,
					},
					result: {
						data: result.data.buffer as SharedArrayBuffer,
						width: result.width,
						height: result.height,
					},
					range: [start, end],
				},
			} satisfies DotIncoming)
		}


		let rafId = requestAnimationFrame(function loop() {
			rafId = requestAnimationFrame(loop)

			local_copy.data.set(result.data)
			ctx.putImageData(local_copy, 0, 0)
		})

		return () => {
			cancelAnimationFrame(rafId)
			clearLightSource()
			for (const worker of dot_workers) {
				worker.terminate()
			}
		}
	}, [])
	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<form ref={formRef} className={styles.form}>
				<fieldset>
					<legend>Controls</legend>
					<label htmlFor="z">Z Value:</label>
					<input type="range" id="z" name="z" min="0" max="100" defaultValue={50} />
					<hr />
					<label htmlFor="falloff">Fall-off:</label>
					<input type="range" id="falloff" name="falloff" min="0" max="100" defaultValue={50} />
					<hr />
					<label htmlFor="easing">Light easing:</label>
					<select name="easing" id="easing">
						{easings.map((easing, i) => (
							<option key={i} value={i}>{easing.name}</option>
						))}
					</select>
					<hr />
					<label htmlFor="color">Color:
						<input type="checkbox" name="color" id="color" defaultChecked />
					</label>
					<hr />
					<label htmlFor="ambient">Ambient:</label>
					<input type="range" id="ambient" name="ambient" min="0" max="100" defaultValue={0} />
				</fieldset>
			</form>
			<canvas width="1000" height="1000" ref={ref}>
				Your browser does not support the HTML5 canvas tag.
			</canvas>
		</div>
	)
}


function handleInputs(canvas: HTMLCanvasElement, form: HTMLFormElement) {
	let inputs: Float32Array<SharedArrayBuffer> & Inputs
	{
		const inputs_buffer = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * inputs_length)
		inputs = new Float32Array(inputs_buffer) as never
		inputs[0] = 125 // x
		inputs[1] = 125 // y
		inputs[2] = 50  // z
		inputs[3] = Math.hypot(canvas.width, canvas.height) / 2 // falloff
		inputs[4] = 0 // easing
		inputs[5] = 1 // color
		inputs[6] = 0 // ambient
	}

	const controller = new AbortController()

	window.addEventListener('pointermove', (e) => {
		const event = e.getPredictedEvents().at(0) || e
		const { left, top, width, height } = canvas.getBoundingClientRect()

		const x = (event.clientX - left) / width * screen_width
		const y = (event.clientY - top) / height * screen_height
		inputs[0] = x
		inputs[1] = y
	}, { signal: controller.signal })

	const getValue = <T,>(name: string): T | undefined => {
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

	form.addEventListener('input', () => {
		const z = getValue<number>('z')!
		const falloff = getValue<number>('falloff')!
		const easing = getValue<string>('easing')!
		const color = getValue<boolean>('color')!
		const ambient = getValue<number>('ambient')!
		inputs[2] = z * 500 / 100
		inputs[3] = Math.hypot(canvas.width, canvas.height) * falloff / 100
		inputs[4] = parseInt(easing)
		inputs[5] = Number(color)
		inputs[6] = ambient / 100 * 255
	}, { signal: controller.signal })

	return [
		inputs,
		() => {
			controller.abort()
		}
	] as const
}

