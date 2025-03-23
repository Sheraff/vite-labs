import type { RouteMeta } from "~/router"
import styles from './styles.module.css'
import { Head } from "~/components/Head"
import { useEffect, useRef } from "react"

// textures from https://www.cgbookcase.com/textures
import normal_source from './world/map.jpg'
import color_source from './world/color.jpg'

import vertex from './vertex.glsl?raw'
import fragment from './fragment.glsl?raw'

import { easings, getImageData } from "./utils"

const normal_map = await getImageData(normal_source)
const color_map = await getImageData(color_source)

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
		const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true })
		if (!gl) return
		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
		gl.clearColor(0, 0, 0, 0)
		gl.clear(gl.COLOR_BUFFER_BIT)
		const form = formRef.current
		if (!form) return

		const vertex_shader = createShader(gl, gl.VERTEX_SHADER, vertex)
		const fragment_shader = createShader(gl, gl.FRAGMENT_SHADER, fragment)
		const program = createProgram(gl, vertex_shader, fragment_shader)
		gl.useProgram(program)

		const { inputs, xyz, clear, screen } = handleInputs(canvas, form)

		const resolution_loc = gl.getUniformLocation(program, "resolution")

		const size_loc = gl.getUniformLocation(program, "u_texture_size")
		gl.uniform2f(size_loc, color_map.width, color_map.height)

		const buffer = gl.createBuffer()!
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
		const arr = new Float32Array([-1, -1, -1, 1, 1, -1, 1, 1])
		gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW)
		const position_loc = gl.getAttribLocation(program, "v_position")
		gl.enableVertexAttribArray(position_loc)
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
		gl.vertexAttribPointer(position_loc, 2, gl.FLOAT, false, 0, 0)

		const color_texture = gl.createTexture()
		gl.bindTexture(gl.TEXTURE_2D, color_texture)
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, color_map)
		gl.generateMipmap(gl.TEXTURE_2D)
		const texture_loc = gl.getUniformLocation(program, "u_texture")
		gl.uniform1i(texture_loc, 0)

		const normal_texture = gl.createTexture()
		gl.bindTexture(gl.TEXTURE_2D, normal_texture)
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, normal_map)
		gl.generateMipmap(gl.TEXTURE_2D)
		const normal_loc = gl.getUniformLocation(program, "u_normal_map")
		gl.uniform1i(normal_loc, 1)

		const inputs_loc = gl.getUniformLocation(program, "u_light_position")
		const max_distance_loc = gl.getUniformLocation(program, "max_distance")
		const easing_loc = gl.getUniformLocation(program, "easing")
		const color_flag_loc = gl.getUniformLocation(program, "color_flag")
		const ambient_loc = gl.getUniformLocation(program, "ambient")

		gl.activeTexture(gl.TEXTURE0)
		gl.bindTexture(gl.TEXTURE_2D, color_texture)
		gl.activeTexture(gl.TEXTURE1)
		gl.bindTexture(gl.TEXTURE_2D, normal_texture)



		let rafId = requestAnimationFrame(function loop() {
			rafId = requestAnimationFrame(loop)

			const pixels = new Uint8ClampedArray(
				gl.drawingBufferWidth * gl.drawingBufferHeight * 4,
			)
			gl.readPixels(
				0,
				0,
				gl.drawingBufferWidth,
				gl.drawingBufferHeight,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				pixels,
			)
			const has_something = pixels.some((v) => v !== 0)
			console.log(has_something)


			gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
			gl.uniform2f(resolution_loc, screen.width, screen.height)

			gl.uniform3fv(inputs_loc, xyz)

			gl.uniform1f(max_distance_loc, Math.hypot(screen.width, screen.height) * inputs.falloff)
			gl.uniform1f(easing_loc, inputs.easing)
			gl.uniform1f(color_flag_loc, inputs.color)
			gl.uniform1f(ambient_loc, inputs.ambient)

			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
		})


		return () => {
			gl.useProgram(null)
			gl.deleteBuffer(buffer)
			gl.deleteProgram(program)
			gl.deleteShader(vertex_shader)
			gl.deleteShader(fragment_shader)
			gl.deleteTexture(color_texture)
			gl.deleteTexture(normal_texture)

			cancelAnimationFrame(rafId)
			clear()
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
					<input type="range" id="ambient" name="ambient" min="0" max="100" defaultValue={10} />
				</fieldset>
			</form>
			<canvas width="1000" height="1000" ref={ref}>
				Your browser does not support the HTML5 canvas tag.
			</canvas>
		</div>
	)
}


function handleInputs(canvas: HTMLCanvasElement, form: HTMLFormElement) {
	const screen = {
		width: window.innerWidth * window.devicePixelRatio,
		height: window.innerHeight * window.devicePixelRatio,
	}
	canvas.width = screen.width
	canvas.height = screen.height
	const xyz = new Float32Array([125, 125, 50])
	const inputs = {
		falloff: 0.5,
		easing: 0,
		color: 1,
		ambient: 0.1,
	}

	const controller = new AbortController()

	window.addEventListener('resize', () => {
		screen.width = window.innerWidth * window.devicePixelRatio
		screen.height = window.innerHeight * window.devicePixelRatio
		canvas.width = screen.width
		canvas.height = screen.height
	}, { signal: controller.signal })

	window.addEventListener('pointermove', (e) => {
		const event = e.getPredictedEvents().at(0) || e
		const { left, top, width, height } = canvas.getBoundingClientRect()

		const x = (event.clientX - left) / width * screen.width
		const y = (event.clientY - top) / height * screen.height
		xyz[0] = x
		xyz[1] = y
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
		xyz[2] = z * 500 / 100
		inputs.falloff = falloff / 100
		inputs.easing = parseInt(easing)
		inputs.color = Number(color)
		inputs.ambient = ambient / 100
	}, { signal: controller.signal })

	return {
		xyz,
		inputs,
		screen,
		clear: () => {
			controller.abort()
		}
	}
}



function createShader(gl: WebGLRenderingContext, type: number, source: string) {
	const shader = gl.createShader(type)

	if (!shader) {
		throw new Error('Unable to create shader')
	}

	gl.shaderSource(shader, source)
	gl.compileShader(shader)

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const info = gl.getShaderInfoLog(shader)
		gl.deleteShader(shader)
		throw new Error(`Failed to compile fragment shader: ${info}`)
	}

	return shader
}

function createProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) {
	const program = gl.createProgram()

	if (!program) {
		throw new Error('Unable to create program')
	}

	gl.attachShader(program, vertexShader)
	gl.attachShader(program, fragmentShader)
	gl.linkProgram(program)

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const info = gl.getProgramInfoLog(program)
		gl.deleteProgram(program)
		throw new Error(`Failed to link program: ${info}`)
	}

	return program
}