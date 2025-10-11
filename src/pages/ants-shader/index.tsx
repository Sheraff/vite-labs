import styles from './styles.module.css'
import { Head } from "#components/Head"
import type { RouteMeta } from "#router"
import { useEffect, useRef } from "react"

import vertex from './vertex.glsl?raw'
import fragment from './fragment.glsl?raw'

export const meta: RouteMeta = {
	title: 'Ants on shader',
}

export default function AntsShaderPage() {
	const ref = useRef<HTMLCanvasElement | null>(null)

	useEffect(() => {
		const canvas = ref.current
		if (!canvas) return
		const side = Math.min(canvas.clientWidth, canvas.clientHeight) // * window.devicePixelRatio
		canvas.width = side
		canvas.height = side
		const ctx = canvas.getContext("2d")
		if (!ctx) return

		const gl = document.createElement('canvas').getContext('webgl2', { preserveDrawingBuffer: true })
		if (!gl) return
		gl.canvas.width = side
		gl.canvas.height = side
		gl.viewport(0, 0, side, side)
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
		const frame = new ImageData(side, side, { colorSpace: 'srgb' })
		/** visualisation for 2D canvas */
		const image = new ImageData(side, side, { colorSpace: 'srgb' })

		init(frame.data, side, side, 35_000)

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
		const decay_loc = gl.getUniformLocation(program, "decay_pheromone")
		const resolution_loc = gl.getUniformLocation(program, "resolution")
		gl.uniform2f(resolution_loc, side, side)

		let counter = 0

		let rafId = requestAnimationFrame(function loop() {
			rafId = requestAnimationFrame(loop)

			let antcount = 0
			counter += 1
			counter %= 10

			// send previous frame to shader
			gl.activeTexture(gl.TEXTURE0)
			gl.bindTexture(gl.TEXTURE_2D, previous_frame_texture)
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame)

			// send additional data to shader
			gl.uniform1f(seed_loc, Math.random() * 100 - 50)
			gl.uniform1f(decay_loc, +(counter === 0))

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

			// compute image from new frame
			for (let i = 0; i < frame.data.length; i += 4) {
				const point = frame.data[i]
				const isAnt
					= point & 0b00000001
				const isFood
					= point & 0b00000010
				const isAntAndFood
					= point & 0b00000100
				const isAnthill
					= point & 0b00001000
				const isPheromoneToFood
					= frame.data[i + 1]
				const isPheromoneToHill
					= frame.data[i + 2]

				if (isAnt) antcount++
				if (isAntAndFood) antcount++
				// if (isFood) foodcount++
				// if (isAntAndFood) foodcount++
				// if (isFood) untouchedfoodcount++

				if (isAntAndFood) {
					image.data.set(colors.antAndFood, i)
				} else if (isAnt) {
					image.data.set(colors.ant, i)
				} else if (isFood) {
					image.data.set(colors.food, i)
				} else if (isAnthill) {
					image.data.set(colors.anthill, i)
				} else if (isPheromoneToFood && isPheromoneToHill) {
					image.data.set(colors.pheromoneBoth, i)
				} else if (isPheromoneToFood) {
					image.data.set(colors.pheromoneToFood, i)
				} else if (isPheromoneToHill) {
					image.data.set(colors.pheromoneToHill, i)
				} else {
					image.data.set(colors.void, i)
				}
			}

			// console.log('ants:', antcount)

			ctx.putImageData(image, 0, 0)
		})

		return () => {
			cancelAnimationFrame(rafId)

			gl.useProgram(null)
			gl.deleteBuffer(buffer)
			gl.deleteProgram(program)
			gl.deleteShader(vertex_shader)
			gl.deleteShader(fragment_shader)
			gl.deleteTexture(previous_frame_texture)
		}
	}, [])

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<canvas width="1000" height="1000" ref={ref}>
				Your browser does not support the HTML5 canvas tag.
			</canvas>
		</div>
	)
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

const colors = {
	ant: [0xcc, 0xcc, 0xcc, 0xff],
	antAndFood: [0xee, 0x44, 0xee, 0xff],
	food: [0, 0x80, 0, 0xff],
	pheromoneToFood: [0x20, 0xee, 0x20, 0xff],
	pheromoneToHill: [0xa0, 0x20, 0x20, 0x80],
	pheromoneBoth: [0xa0, 0xee, 0x20, 0xff],
	anthill: [0x80, 0, 0, 0xff],
	void: [0, 0, 0, 0xff],
}

function init(array: Uint8ClampedArray, width: number, height: number, count: number) {
	const foodPosition = [width / 3, height / 3]
	const foodRadius = Math.min(width, height) / 10

	const anthillPosition = [width * 2 / 3, height * 2 / 3]
	const anthillRadius = Math.min(width, height) / 10

	const antDistance = [Math.min(width, height) / 20, Math.min(width, height) / 7]

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4
			{
				const dx = x - foodPosition[0]
				const dy = y - foodPosition[1]
				const distance = Math.sqrt(dx * dx + dy * dy)
				if (distance < foodRadius)
					array[i] |= 0b10 // food
			}
			{
				const dx = x - anthillPosition[0]
				const dy = y - anthillPosition[1]
				const distance = Math.sqrt(dx * dx + dy * dy)
				if (distance < anthillRadius)
					array[i] |= 0b1000 // anthill
			}
		}
	}

	for (let i = 0; i < count; i++) {
		const distance = Math.random() * (antDistance[1] - antDistance[0]) + antDistance[0]
		const angle = Math.random() * Math.PI * 2
		const dx = Math.cos(angle) * distance
		const dy = Math.sin(angle) * distance
		const x = Math.round(anthillPosition[0] + dx)
		const y = Math.round(anthillPosition[1] + dy)
		const index = (y * width + x) * 4
		const isOccupied = array[index] & 0b1 // ant
		if (isOccupied) {
			i--
			continue
		}
		array[index] |= 0b1 // ant
	}
}