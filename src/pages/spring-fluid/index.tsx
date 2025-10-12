import type { RouteMeta } from "#router"
import styles from './styles.module.css'
import { Head } from "#components/Head"
import { useEffect, useRef, useState } from "react"

import vertex from './vertex.glsl?raw'
import fragment from './fragment.glsl?raw'
import { makeFrameCounter } from "#components/makeFrameCounter"

export const meta: RouteMeta = {
	title: 'Spring fluid',
	description: 'A fluid simulation based on a spring-mass system, on the GPU. Click and drag to introduce disturbances. Warning: flashing lights.',
	image: './screen.png',
	tags: ['webgl', 'fluid', 'shader', 'physics'],
}

export default function SpringFluidPage() {
	const ref = useRef<HTMLCanvasElement | null>(null)
	const [fps, setFps] = useState(0)

	useEffect(() => {
		const canvas = ref.current
		if (!canvas) return
		const pixels = 500_000
		const viewport_pixels = canvas.clientWidth * canvas.clientHeight
		const scale = Math.sqrt(pixels / viewport_pixels)
		canvas.width = Math.floor(canvas.clientWidth * scale)
		canvas.height = Math.floor(canvas.clientHeight * scale)
		const ctx = canvas.getContext("2d")
		if (!ctx) return
		const frameCounter = makeFrameCounter()
		return start(ctx, (dt) => setFps(frameCounter(dt)))
	}, [])

	const [formatter] = useState(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }))

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
				<p>fps: {formatter.format(fps)}</p>
			</div>

			<canvas ref={ref}>
				Your browser does not support the HTML5 canvas tag.
			</canvas>
		</div>
	)
}

function start(ctx: CanvasRenderingContext2D, onFrame: (dt: number) => void) {
	const height = ctx.canvas.height
	const width = ctx.canvas.width

	const gl = document.createElement('canvas').getContext('webgl2', { preserveDrawingBuffer: true })!

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
	const frame = new ImageData(width, height, { colorSpace: 'srgb' })
	/** visualisation for 2D canvas */
	const image = new ImageData(width, height, { colorSpace: 'srgb' })
	/** mouse effects */
	const mouse_data = new Int8Array(width * height * 4)

	init(frame.data, width, height)

	const previous_frame_texture = gl.createTexture()
	gl.bindTexture(gl.TEXTURE_2D, previous_frame_texture)
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
	const texture_loc = gl.getUniformLocation(program, "previous_frame")
	gl.uniform1i(texture_loc, 0)
	gl.activeTexture(gl.TEXTURE0)
	gl.bindTexture(gl.TEXTURE_2D, previous_frame_texture)

	const seed_loc = gl.getUniformLocation(program, "seed")
	const dt_loc = gl.getUniformLocation(program, "dt")
	const resolution_loc = gl.getUniformLocation(program, "resolution")
	gl.uniform2f(resolution_loc, width, height)

	let lastTime = 0

	const speed_mult = 4

	let mouse = {
		x: 0,
		y: 0,
		dx: 0,
		dy: 0,
		down: false,
		data: mouse_data,
		frame: false
	}

	let rafId = requestAnimationFrame(function loop(time) {
		rafId = requestAnimationFrame(loop)

		const delta = (time - lastTime) / 1000
		// const first = lastTime === 0

		onFrame(delta)

		for (let i = 0; i < speed_mult; i++) {

			const seed = Math.random() * 100 - 50

			if (mouse.frame) {
				for (let i = 0; i < mouse.data.length; i += 4) {
					frame.data[i] += mouse.data[i]
					frame.data[i + 1] += mouse.data[i + 1]
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
			gl.uniform1f(dt_loc, delta * 2)

			// compute new frame
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

			// read new from from shader into array
			gl.readPixels(
				0,
				0,
				gl.drawingBufferWidth,
				gl.drawingBufferHeight,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				frame.data,
			)
		}

		for (let i = 0; i < frame.data.length; i += 4) {
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

		// // 30px circle around mouse pos
		// ctx.beginPath()
		// ctx.arc(mouse.x, mouse.y, 30, 0, Math.PI * 2)
		// ctx.strokeStyle = 'rgba(255, 0, 255, 0.5)'
		// ctx.lineWidth = 1
		// ctx.stroke()

		lastTime = time
	})

	const controller = new AbortController()

	let rect = ctx.canvas.getBoundingClientRect()
	window.addEventListener('resize', () => {
		rect = ctx.canvas.getBoundingClientRect()
	}, { signal: controller.signal })

	window.addEventListener('pointermove', (event) => {
		if (mouse.frame) return
		mouse.frame = true
		const e = event
		mouse.x = Math.floor(((e.clientX - rect.left) / rect.width) * width)
		mouse.y = Math.floor(((e.clientY - rect.top) / rect.height) * height)
		mouse.dx = e.movementX
		mouse.dy = e.movementY
		mouse.down = e.buttons > 0

		if (!mouse.down) return

		for (const e of event.getCoalescedEvents()) {
			const x = Math.floor(((e.clientX - rect.left) / rect.width) * width)
			const y = Math.floor(((e.clientY - rect.top) / rect.height) * height)
			const dx = e.movementX
			const dy = e.movementY
			const radius = 30
			const max = Math.sqrt(2 * radius * radius)
			const mult = 5 // [0 - 128]
			for (let j = -radius; j <= radius; j++) {
				const jy = y + j
				if (jy < 0 || jy >= height) continue
				for (let i = -radius; i <= radius; i++) {
					const ix = x + i
					if (ix < 0 || ix >= width) continue
					const d = Math.sqrt(i * i + j * j)
					if (d > radius) continue
					const index = (jy * width + ix) * 4
					const pow = 1 - (d / max)
					mouse.data[index] = dx * pow * mult
					mouse.data[index + 1] = dy * pow * mult
				}
			}
		}
	}, { signal: controller.signal })

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

function init(array: Uint8ClampedArray, width: number, height: number) {
	for (let i = 0; i < array.length; i += 4) {
		array[i] = 128
		array[i + 1] = 128
		array[i + 2] = 128
		array[i + 3] = 128
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
		return (x + 0.337 * y)
	}
	return (y + 0.337 * x)
}
