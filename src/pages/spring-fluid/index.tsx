import type { RouteMeta } from "#router"

import { Head } from "#components/Head"
import { makeFrameCounter } from "#components/makeFrameCounter"
import { useEffect, useRef, useState } from "react"

import fragment from "./fragment.glsl?raw"
import styles from "./styles.module.css"
import vertex from "./vertex.glsl?raw"

export const meta: RouteMeta = {
	title: "Spring fluid",
	description:
		"A fluid simulation based on a spring-mass system, on the GPU. Click and drag to introduce disturbances. Warning: flashing lights.",
	image: "./screen.png",
	tags: ["webgl", "fluid", "shader", "physics"],
}

export default function SpringFluidPage() {
	const canvas_ref = useRef<HTMLCanvasElement | null>(null)
	const form_ref = useRef<HTMLFormElement | null>(null)
	const [fps, setFps] = useState(0)

	useEffect(() => {
		const canvas = canvas_ref.current
		if (!canvas) return

		const form = form_ref.current
		if (!form) return

		const pixels = 500_000
		const viewport_pixels = canvas.clientWidth * canvas.clientHeight
		const scale = Math.sqrt(pixels / viewport_pixels)
		canvas.width = Math.floor(canvas.clientWidth * scale)
		canvas.height = Math.floor(canvas.clientHeight * scale)

		const ctx = canvas.getContext("2d")
		if (!ctx) return

		const frameCounter = makeFrameCounter()
		return start(ctx, form, (dt) => setFps(frameCounter(dt)))
	}, [])

	const [formatter] = useState(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }))

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
				<p>fps: {formatter.format(fps)}</p>
				<form className={styles.form} ref={form_ref}>
					<fieldset name="controls">
						<legend>Controls</legend>
						<button type="button" name="springs">
							reset simulation
						</button>
						<input type="range" name="k" id="k" defaultValue={k_default} min="0" max={k_map.length - 1} step="1" />
						<label htmlFor="k">spring constant (k)</label>
						<hr />
						<input
							type="range"
							name="damping"
							id="damping"
							defaultValue={damping_default}
							min="0"
							max={damping_map.length - 1}
							step="1"
						/>
						<label htmlFor="damping">damping</label>
						<hr />
						<input type="range" name="speed" id="speed" defaultValue="4" min="1" max="16" step="1" />
						<label htmlFor="speed">simulation speed</label>
						<hr />
						<input
							type="range"
							name="clamp"
							id="clamp"
							defaultValue={clamp_default}
							min="0"
							max={clamp_map.length - 1}
							step="1"
						/>
						<label htmlFor="clamp">clamp</label>
						<hr />
						<input type="range" name="turbulence" id="turbulence" defaultValue="0" min="0" max="4" step="0.1" />
						<label htmlFor="turbulence">turbulence</label>
						<button type="reset" name="controls">
							reset controls
						</button>
					</fieldset>
					<fieldset name="brushes">
						<legend>Brushes</legend>
						<input type="radio" name="brush" id="brush1" value="velocity" defaultChecked />
						<label htmlFor="brush1">velocity brush</label>
						<input type="radio" name="brush" id="brush2" value="obstacle" />
						<label htmlFor="brush2">obstacle brush</label>
						<input type="radio" name="brush" id="brush3" value="displacement" />
						<label htmlFor="brush3">displacement brush</label>
					</fieldset>
					<fieldset name="floaters">
						<legend>Floaters</legend>
						<div>
							<input type="checkbox" name="enable_floaters" id="enable_floaters" defaultChecked />
							<label htmlFor="enable_floaters">floating particles</label>
						</div>
						<input type="range" name="num_floaters" id="num_floaters" defaultValue="50" min="0" max="500" step="1" />
						<label htmlFor="num_floaters">number of particles</label>
					</fieldset>
				</form>
			</div>

			<canvas ref={canvas_ref}>Your browser does not support the HTML5 canvas tag.</canvas>
		</div>
	)
}

function start(ctx: CanvasRenderingContext2D, form: HTMLFormElement, onFrame: (dt: number) => void) {
	const height = ctx.canvas.height
	const width = ctx.canvas.width

	const gl = document.createElement("canvas").getContext("webgl2", { preserveDrawingBuffer: true })!

	gl.canvas.width = width
	gl.canvas.height = height
	gl.viewport(0, 0, width, height)
	gl.clearColor(0, 0, 0, 0)
	gl.clear(gl.COLOR_BUFFER_BIT)

	const vertex_shader = createShader(gl, gl.VERTEX_SHADER, vertex)
	const fragment_shader = createShader(gl, gl.FRAGMENT_SHADER, fragment)
	const program = createProgram(gl, vertex_shader, fragment_shader)
	gl.useProgram(program)

	const buffer = gl.createBuffer()!
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
	const arr = new Float32Array([-1, -1, -1, 1, 1, -1, 1, 1])
	gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW)
	const position_loc = gl.getAttribLocation(program, "v_position")
	gl.enableVertexAttribArray(position_loc)
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
	gl.vertexAttribPointer(position_loc, 2, gl.FLOAT, false, 0, 0)

	/** data in/out of webGL */
	const frame = new ImageData(width, height, { colorSpace: "srgb" })
	/** obstacles */
	const obstacles = new ImageData(width, height, { colorSpace: "srgb" })
	/** visualisation for 2D canvas */
	const image = new ImageData(width, height, { colorSpace: "srgb" })
	/** mouse effects */
	const mouse_data = new Int8Array(width * height * 4)

	init(frame.data, obstacles.data, width, height)

	const previous_frame_texture = gl.createTexture()
	gl.activeTexture(gl.TEXTURE0)
	gl.bindTexture(gl.TEXTURE_2D, previous_frame_texture)
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
	gl.uniform1i(gl.getUniformLocation(program, "previous_frame"), 0)

	const obstacle_texture = gl.createTexture()
	gl.activeTexture(gl.TEXTURE1)
	gl.bindTexture(gl.TEXTURE_2D, obstacle_texture)
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, obstacles)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
	gl.uniform1i(gl.getUniformLocation(program, "obstacles"), 1)

	const seed_loc = gl.getUniformLocation(program, "seed")
	const dt_loc = gl.getUniformLocation(program, "dt")
	const resolution_loc = gl.getUniformLocation(program, "resolution")
	const k_loc = gl.getUniformLocation(program, "k")
	const damping_loc = gl.getUniformLocation(program, "damping")
	const clamp_loc = gl.getUniformLocation(program, "clamp_value")
	const turbulence_loc = gl.getUniformLocation(program, "turbulence_factor")
	gl.uniform2f(resolution_loc, width, height)

	let lastTime = 0

	const mouse = {
		data: mouse_data,
		frame: false,
	}

	const controls = {
		k: 0,
		damping: 0,
		reset: false,
		speed: 0,
		clamp: 0,
		turbulence: 0,
		brush: "",
		floaters: false,
	}

	const floaters: [vx: number, vy: number, x: number, y: number][] = []

	let rafId = requestAnimationFrame(function loop(time) {
		rafId = requestAnimationFrame(loop)

		const delta = (time - lastTime) / 1000
		const first = lastTime === 0
		lastTime = time
		if (first) return

		onFrame(delta)
		const dt = delta * 2

		if (controls.reset) {
			init(frame.data, obstacles.data, width, height)
			controls.reset = false
			return
		}

		// send obstacles to shader
		gl.activeTexture(gl.TEXTURE1)
		gl.bindTexture(gl.TEXTURE_2D, obstacle_texture)
		gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, obstacles)

		for (let i = 0; i < controls.speed; i++) {
			const seed = Math.random() * 100 - 50

			if (mouse.frame) {
				for (let i = 0; i < mouse.data.length; i += 4) {
					if (controls.brush === "velocity") {
						frame.data[i] += mouse.data[i]
						frame.data[i + 1] += mouse.data[i + 1]
					} else if (controls.brush === "displacement") {
						frame.data[i + 2] += mouse.data[i]
						frame.data[i + 3] += mouse.data[i + 1]
					}
					mouse.data[i] = 0
					mouse.data[i + 1] = 0
				}
				mouse.frame = false
			}

			// send previous frame to shader
			gl.activeTexture(gl.TEXTURE0)
			gl.bindTexture(gl.TEXTURE_2D, previous_frame_texture)
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame)

			// send additional data to shader
			gl.uniform1f(seed_loc, seed)
			gl.uniform1f(dt_loc, dt)
			gl.uniform1f(k_loc, controls.k)
			gl.uniform1f(damping_loc, controls.damping)
			gl.uniform1f(clamp_loc, controls.clamp)
			gl.uniform1f(turbulence_loc, controls.turbulence)

			// compute new frame
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

			// read new from from shader into array
			gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, frame.data)
		}

		for (let i = 0; i < frame.data.length; i += 4) {
			const is_obstacls = obstacles.data[i] > 0
			if (is_obstacls) {
				image.data.set([0xcc, 0xcc, 0xcc, 255], i)
				continue
			}
			const dx = Math.abs(frame.data[i + 2] - 128)
			const dy = Math.abs(frame.data[i + 3] - 128)
			const deltaMag = fastHypot(dx, dy)
			const r = frame.data[i + 2]
			const g = frame.data[i + 3]
			const b = (255 - r + 255 - g) / 2
			const a = deltaMag * 2
			image.data.set([r, g, b, a], i)
		}
		ctx.putImageData(image, 0, 0)

		if (controls.floaters) {
			const radius = 1
			for (const floater of floaters) {
				const index = (Math.floor(floater[3]) * width + Math.floor(floater[2])) * 4
				const vx = (frame.data[index + 2] - 128) / 128 / (dt * controls.speed)
				const vy = (frame.data[index + 3] - 128) / 128 / (dt * controls.speed)

				floater[0] += vx
				floater[1] += vy

				// dampen
				floater[0] *= 0.8
				floater[1] *= 0.8

				// update position
				floater[2] += floater[0] * dt * controls.speed
				floater[3] += floater[1] * dt * controls.speed

				// bounce off walls
				if (floater[2] <= radius) {
					floater[2] = radius + (radius - floater[2]) + 1
					floater[0] *= -1
				}
				if (floater[2] >= width - radius - 1) {
					floater[2] = width - radius - (floater[2] - (width - radius)) - 1
					floater[0] *= -1
				}
				if (floater[3] <= radius) {
					floater[3] = radius + (radius - floater[3]) + 1
					floater[1] *= -1
				}
				if (floater[3] >= height - radius - 1) {
					floater[3] = height - radius - (floater[3] - (height - radius)) - 1
					floater[1] *= -1
				}

				ctx.fillStyle = "#ccc"
				ctx.fillRect(floater[2], floater[3], 1, 1)
			}
		}
	})

	const controller = new AbortController()

	let rect = ctx.canvas.getBoundingClientRect()
	window.addEventListener(
		"resize",
		() => {
			rect = ctx.canvas.getBoundingClientRect()
		},
		{ signal: controller.signal },
	)

	window.addEventListener(
		"pointermove",
		(event) => {
			if (mouse.frame) return
			mouse.frame = true
			const e = event
			const isDown = e.buttons > 0

			if (!isDown) return

			for (const e of event.getCoalescedEvents()) {
				const x = Math.floor(((e.clientX - rect.left) / rect.width) * width)
				const y = Math.floor(((e.clientY - rect.top) / rect.height) * height)
				if (controls.brush === "obstacle") {
					const radius = 10
					for (let j = -radius; j <= radius; j++) {
						const jy = y + j
						if (jy < 0 || jy >= height) continue
						for (let i = -radius; i <= radius; i++) {
							const ix = x + i
							if (ix < 0 || ix >= width) continue
							const d = Math.sqrt(i * i + j * j)
							if (d > radius) continue
							const index = (jy * width + ix) * 4
							obstacles.data[index] = 255
							obstacles.data[index + 1] = 255
							obstacles.data[index + 2] = 255
							obstacles.data[index + 3] = 255
						}
					}
				} else {
					const dx = e.movementX
					const dy = e.movementY
					const radius = 30
					const max = Math.sqrt(2 * radius * radius)
					const mult = 2 // [0 - 128]
					for (let j = -radius; j <= radius; j++) {
						const jy = y + j
						if (jy < 0 || jy >= height) continue
						for (let i = -radius; i <= radius; i++) {
							const ix = x + i
							if (ix < 0 || ix >= width) continue
							const d = Math.sqrt(i * i + j * j)
							if (d > radius) continue
							const index = (jy * width + ix) * 4
							const pow = 1 - d / max
							mouse.data[index] = dx * pow * mult
							mouse.data[index + 1] = dy * pow * mult
						}
					}
				}
			}
		},
		{ signal: controller.signal },
	)

	const onInput = () => {
		controls.k = k_map[getValue<number>(form, "k")!]
		controls.damping = damping_map[getValue<number>(form, "damping")!]
		controls.speed = getValue<number>(form, "speed")!
		controls.clamp = clamp_map[getValue<number>(form, "clamp")!]
		controls.turbulence = getValue<number>(form, "turbulence")!
		controls.brush = getValue<string>(form, "brush")!
		controls.floaters = getValue<boolean>(form, "enable_floaters")!

		const num_floaters = getValue<number>(form, "num_floaters")!
		if (floaters.length > num_floaters) {
			floaters.splice(num_floaters, floaters.length - num_floaters)
		} else if (floaters.length < num_floaters) {
			for (let i = floaters.length; i < num_floaters; i++) {
				floaters.push([0, 0, Math.random() * width, Math.random() * height])
			}
		}
	}
	onInput()
	form.addEventListener("input", onInput, { signal: controller.signal })
	form.addEventListener("reset", setTimeout.bind(null, onInput, 0), { signal: controller.signal })

	const resetButton = form.elements.namedItem("springs") as HTMLButtonElement
	resetButton.addEventListener("click", () => (controls.reset = true), { signal: controller.signal })

	return () => {
		controller.abort()
		cancelAnimationFrame(rafId)

		gl.useProgram(null)
		gl.deleteBuffer(buffer)
		gl.deleteProgram(program)
		gl.deleteShader(vertex_shader)
		gl.deleteShader(fragment_shader)
		gl.deleteTexture(previous_frame_texture)
	}
}

const k_map = [0, 0.01, 0.1, 1, 10, 25, 50, 80, 100, 150, 200]
const k_default = k_map.indexOf(50)

const damping_map = [1, 0.99999, 0.9999, 0.999, 0.99, 0.98, 0.95, 0.9]
const damping_default = damping_map.indexOf(0.9999)

const clamp_map = [0, 0.001, 0.003, 0.01, 0.05, 0.075, 0.1, 0.25, 1]
const clamp_default = clamp_map.indexOf(0.003)

function getValue<T>(form: HTMLFormElement, name: string): T | undefined {
	if (!(name in form.elements)) return undefined
	const element = form.elements[name as keyof typeof form.elements]
	if (element instanceof RadioNodeList) return element.value as T
	if (element instanceof HTMLSelectElement) return element.value as T
	if (element instanceof HTMLInputElement) {
		if (element.type === "range") {
			return element.valueAsNumber as T
		}
		if (element.type === "checkbox") {
			return element.checked as T
		}
	}
}

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
	const shader = gl.createShader(type)

	if (!shader) {
		throw new Error("Unable to create shader")
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
		throw new Error("Unable to create program")
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

function init(array: Uint8ClampedArray, obstacles: Uint8ClampedArray, width: number, height: number) {
	for (let i = 0; i < array.length; i += 4) {
		array[i] = 128
		array[i + 1] = 128
		array[i + 2] = 128
		array[i + 3] = 128
	}
	for (let i = 0; i < obstacles.length; i += 4) {
		obstacles[i] = 0
		obstacles[i + 1] = 0
		obstacles[i + 2] = 0
		obstacles[i + 3] = 0
	}
}

// Pythagorean theorem approximation
// https://stackoverflow.com/questions/3506404/fast-hypotenuse-algorithm-for-embedded-processor
// All these assume 0 ≤ a ≤ b.
// h = b + 0.337 * a                 // max error ≈ 5.5 %
// h = max(b, 0.918 * (b + (a>>1)))  // max error ≈ 2.6 %
// h = b + 0.428 * a * a / b         // max error ≈ 1.04 %
function fastHypot(x: number, y: number) {
	if (x > y) {
		return x + 0.337 * y
	}
	return y + 0.337 * x
}
