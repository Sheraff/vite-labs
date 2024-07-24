import { useEffect, useRef } from "react"
import { Head } from "~/components/Head"
import styles from './styles.module.css'
import type { RouteMeta } from "~/router"



export const meta: RouteMeta = {
	title: 'Perlin ripples',
}

export default function () {
	const canvas = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		if (!canvas.current) return
		const ctx = canvas.current.getContext('2d')
		canvas.current.width = window.innerWidth
		canvas.current.height = window.innerHeight
		if (!ctx) throw new Error('No context found')
		const clear = start(ctx)
		return () => clear()
	}, [])

	return (
		<div className={styles.main}>
			<Head />
			<canvas ref={canvas}></canvas>
		</div>
	)
}


function start(ctx: CanvasRenderingContext2D) {
	const width = 300
	const height = 300
	const depth = 50
	const noise = generate3dPerlinNoise(width, height, depth)
	const get = (x: number, y: number, z: number) => getValue(x, y, z, noise, width, height, depth)


	const clear = draw(ctx, width, height, depth, get)

	return () => {
		clear()
	}
}

function draw(
	ctx: CanvasRenderingContext2D,
	noiseW: number, // perlin noise width
	noiseH: number, // perlin noise height
	noiseD: number, // perlin noise depth
	get: (x: number, y: number, z: number) => number
) {
	let d = 0
	let direction = 1

	const canvasW = ctx.canvas.width
	const canvasH = ctx.canvas.height

	let lastTime = 0
	let rafId = requestAnimationFrame(function loop(time) {
		rafId = requestAnimationFrame(loop)
		const delta = lastTime ? time - lastTime : 0
		lastTime = time
		d += delta * 0.01 * direction
		if (d >= noiseD - 1) {
			d = noiseD - 1
			direction *= -1
		} else if (d <= 0) {
			d = 0
			direction *= -1
		}

		const before = Math.floor(d)
		const after = Math.ceil(d)
		const p = d - before

		// ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

		// take all pixels at depth `d` and convert to ImageData
		const imageData = ctx.createImageData(canvasW, canvasH)
		for (let cy = 0; cy < canvasH; cy++) {
			const perlinY = cy / canvasH * noiseH
			const beforeY = Math.floor(perlinY)
			const afterY = Math.ceil(perlinY)
			const progressY = perlinY - beforeY
			for (let cx = 0; cx < canvasW; cx++) {
				const perlinX = cx / canvasW * noiseW
				const beforeX = Math.floor(perlinX)
				const afterX = Math.ceil(perlinX)
				const progressX = perlinX - beforeX
				// value at depth before, y before, x lerped
				const valueBeforeBefore = lerp(progressX, get(beforeX, beforeY, before), get(afterX, beforeY, before))
				// value at depth before, y after, x lerped
				const valueAfterBefore = lerp(progressX, get(beforeX, afterY, before), get(afterX, afterY, before))
				// value at depth before, y lerped, x lerped
				const valueBefore = lerp(progressY, valueBeforeBefore, valueAfterBefore)
				// value at depth after, y before, x lerped
				const valueBeforeAfter = lerp(progressX, get(beforeX, beforeY, after), get(afterX, beforeY, after))
				// value at depth after, y after, x lerped
				const valueAfterAfter = lerp(progressX, get(beforeX, afterY, after), get(afterX, afterY, after))
				// value at depth after, y lerped, x lerped
				const valueAfter = lerp(progressY, valueBeforeAfter, valueAfterAfter)
				// value at depth lerped, y lerped, x lerped
				const value = lerp(p, valueBefore, valueAfter)
				const index = (cy * canvasW + cx) * 4
				imageData.data[index] = value * 255
				imageData.data[index + 1] = value * 255
				imageData.data[index + 2] = value * 255
				imageData.data[index + 3] = 255
			}
		}

		// put the ImageData on the canvas
		ctx.putImageData(imageData, 0, 0)
	})

	return () => cancelAnimationFrame(rafId)
}







function fade(t: number): number {
	return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(t: number, a: number, b: number): number {
	return a + t * (b - a)
}

function grad(hash: number, x: number, y: number, z: number): number {
	const h = hash & 15
	const u = h < 8 ? x : y
	const v = h < 4 ? y : h === 12 || h === 14 ? x : z
	return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
}

function perlin(p: Uint8Array, x: number, y: number, z: number): number {
	const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255
	x -= Math.floor(x)
	y -= Math.floor(y)
	z -= Math.floor(z)
	const u = fade(x), v = fade(y), w = fade(z)
	const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z

	return lerp(w, lerp(v, lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
		lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z))),
		lerp(v, lerp(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)),
			lerp(u, grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1))))
}

function permutations(): Uint8Array {
	// Generate an array of integers from 0 to 255
	const originalArray = Array.from({ length: 256 }, (_, i) => i)

	// Shuffle the array using the Fisher-Yates (Durstenfeld) shuffle algorithm
	for (let i = originalArray.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[originalArray[i], originalArray[j]] = [originalArray[j], originalArray[i]]
	}

	// Repeat the array to avoid modulo operations for wrapping
	const p = new Uint8Array(originalArray.concat(originalArray))

	return p
}

function generate3dPerlinNoise(width: number, height: number, depth: number): Float32Array {
	const size = width * height * depth
	const data = new Float32Array(size)
	const p = permutations()
	let index = 0
	for (let z = 0; z < depth; z++) {
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const noiseValue = perlin(p, x * 0.05, y * 0.05, z * 0.05)
				data[index++] = noiseValue
			}
		}
	}
	return data
}

function getValue(x: number, y: number, z: number, data: Float32Array, width: number, height: number, depth: number): number {
	return data[z * width * height + y * width + x]
}