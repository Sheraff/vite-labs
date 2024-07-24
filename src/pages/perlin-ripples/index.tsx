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
		canvas.current.width = window.innerWidth * ((devicePixelRatio - 1) / 2 + 1)
		canvas.current.height = window.innerHeight * ((devicePixelRatio - 1) / 2 + 1)
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
	const width = 128 // Math.floor(ctx.canvas.width / 8)
	const height = 128 // Math.floor(ctx.canvas.width / 8)
	const depth = 14
	const time = 14

	console.log(`init with ${width}x${height}x${depth}x${time} (${width * height * depth * time} values)`)

	const noise = generate4dPerlinNoise(width, height, depth, time, {
		x: 0.06,
		y: 0.06,
		z: 0.04,
		t: 0.04,
		resolution: 256
	})

	const get = (x: number, y: number, z: number, t: number) => noise[t * width * height * depth + z * width * height + y * width + x]

	const clear = draw(ctx, width, height, depth, time, get)

	return () => {
		clear()
	}
}

function draw(
	ctx: CanvasRenderingContext2D,
	noiseW: number, // perlin noise width
	noiseH: number, // perlin noise height
	noiseD: number, // perlin noise depth
	noiseT: number, // perlin noise time
	get: (x: number, y: number, z: number, t: number) => number
) {
	let advancement = 0

	const canvasW = ctx.canvas.width
	const canvasH = ctx.canvas.height

	const tempStore2d = new Float32Array(noiseW * noiseH)
	const tempStore1d = new Float32Array(noiseH)
	const imgStore = new Uint8ClampedArray(canvasW * canvasH)
	const imageData = ctx.createImageData(canvasW, canvasH)

	let lastTime = 0
	let rafId = requestAnimationFrame(function loop(time) {
		rafId = requestAnimationFrame(loop)
		const delta = lastTime ? time - lastTime : 0
		lastTime = time
		advancement += delta * 0.001
		advancement = advancement % (2 * Math.PI)

		const d = (Math.sin(advancement) * 0.5 + 0.5) * (noiseD - 1)
		const t = (Math.cos(advancement) * 0.5 + 0.5) * (noiseT - 1)

		const beforeD = Math.floor(d)
		const afterD = Math.ceil(d)
		const pD = d - beforeD

		const beforeT = Math.floor(t)
		const afterT = Math.ceil(t)
		const pT = t - beforeT

		/**
		 * Create an array of all X, all Y,
		 * where the value of each x,y is lerped
		 * between beforeD and afterD in the D dimension
		 * and beforeT and afterT in the T dimension
		 */
		for (let y = 0; y < noiseH; y++) {
			for (let x = 0; x < noiseW; x++) {
				const beforeBefore = get(x, y, beforeD, beforeT)
				const afterBefore = get(x, y, afterD, beforeT)
				const before = lerp(pD, beforeBefore, afterBefore)
				const beforeAfter = get(x, y, beforeD, afterT)
				const afterAfter = get(x, y, afterD, afterT)
				const after = lerp(pD, beforeAfter, afterAfter)
				const value = lerp(pT, before, after)
				tempStore2d[y * noiseW + x] = value
			}
		}

		for (let cy = 0; cy < canvasH; cy++) {
			const perlinY = cy / canvasH * noiseH
			const beforeY = Math.floor(perlinY)
			const afterY = Math.ceil(perlinY)
			const progressY = perlinY - beforeY

			/**
			 * Create an array of all X,
			 * where the value of each x is lerped
			 * between beforeY and afterY in the Y dimension
			 */
			for (let x = 0; x < noiseW; x++) {
				const before = tempStore2d[beforeY * noiseW + x]
				const after = tempStore2d[afterY * noiseW + x]
				const value = lerp(progressY, before, after)
				tempStore1d[x] = value
			}

			for (let cx = 0; cx < canvasW; cx++) {
				const perlinX = cx / canvasW * noiseW
				const beforeX = Math.floor(perlinX)
				const afterX = Math.ceil(perlinX)
				const progressX = perlinX - beforeX

				const before = tempStore1d[beforeX]
				const after = tempStore1d[afterX]
				const value = lerp(progressX, before, after)

				const i = (cy * canvasW + cx)
				imgStore[i] = Math.floor(value * 255)
			}
		}

		const thresholds = [125, 200, 250]
		for (let y = 0; y < canvasH; y++) {
			const mid = y > 0 && y < canvasH - 1
			for (let x = 0; x < canvasW; x++) {
				const i = (y * canvasW + x) * 4

				vertical: if (mid) {
					const top = imgStore[(y - 1) * canvasW + x]
					const bottom = imgStore[(y + 1) * canvasW + x]
					if (top === bottom) break vertical
					const t = thresholds.find(t => (top <= t && bottom > t) || (top >= t && bottom < t))
					if (t) {
						imageData.data[i] = t
						imageData.data[i + 1] = t
						imageData.data[i + 2] = t
						imageData.data[i + 3] = 255
						continue
					}
				}

				horizontal: if (x > 0 && x < canvasW - 1) {
					const left = imgStore[y * canvasW + x - 1]
					const right = imgStore[y * canvasW + x + 1]
					if (left === right) break horizontal
					const t = thresholds.find(t => (left <= t && right > t) || (left >= t && right < t))
					if (t) {
						imageData.data[i] = t
						imageData.data[i + 1] = t
						imageData.data[i + 2] = t
						imageData.data[i + 3] = 255
						continue
					}
				}

				imageData.data[i] = 0
				imageData.data[i + 1] = 0
				imageData.data[i + 2] = 0
				imageData.data[i + 3] = 255
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

function grad(hash: number, x: number, y: number, z: number, w: number): number {
	const h = hash & 31 // Use 32 gradients for 4D.
	const u = h < 24 ? x : y // Use x or y as the first component.
	const v = h < 16 ? y : z // Use y or z as the second component.
	const s = h < 8 ? z : w // Use z or w as the third component.

	// Calculate the fourth component based on the hash.
	// This uses a similar approach to the 3D version but extends it to 4D.
	const t = h < 4 ? x : h === 12 || h === 20 ? y : h === 14 || h === 22 ? z : w

	// Compute the dot product as in the 3D case, but now with four components.
	return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v) + ((h & 4) === 0 ? s : -s) + ((h & 8) === 0 ? t : -t)
}

function perlin(p: Uint8Array, x: number, y: number, z: number, w: number, resolution: number): number {
	const mask = resolution - 1
	const X = Math.floor(x) & mask, Y = Math.floor(y) & mask, Z = Math.floor(z) & mask, W = Math.floor(w) & mask
	x -= Math.floor(x)
	y -= Math.floor(y)
	z -= Math.floor(z)
	w -= Math.floor(w)
	const u = fade(x), v = fade(y), t = fade(z), s = fade(w)
	const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z,
		B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z,
		AAA = p[AA] + W, AAB = p[AA + 1] + W, ABA = p[AB] + W, ABB = p[AB + 1] + W,
		BAA = p[BA] + W, BAB = p[BA + 1] + W, BBA = p[BB] + W, BBB = p[BB + 1] + W

	return lerp(s,
		lerp(t,
			lerp(v,
				lerp(u, grad(p[AAA], x, y, z, w), grad(p[BAA], x - 1, y, z, w)),
				lerp(u, grad(p[ABA], x, y - 1, z, w), grad(p[BBA], x - 1, y - 1, z, w))),
			lerp(v,
				lerp(u, grad(p[AAB], x, y, z - 1, w), grad(p[BAB], x - 1, y, z - 1, w)),
				lerp(u, grad(p[ABB], x, y - 1, z - 1, w), grad(p[BBB], x - 1, y - 1, z - 1, w)))),
		lerp(t,
			lerp(v,
				lerp(u, grad(p[AAA + 1], x, y, z, w - 1), grad(p[BAA + 1], x - 1, y, z, w - 1)),
				lerp(u, grad(p[ABA + 1], x, y - 1, z, w - 1), grad(p[BBA + 1], x - 1, y - 1, z, w - 1))),
			lerp(v,
				lerp(u, grad(p[AAB + 1], x, y, z - 1, w - 1), grad(p[BAB + 1], x - 1, y, z - 1, w - 1)),
				lerp(u, grad(p[ABB + 1], x, y - 1, z - 1, w - 1), grad(p[BBB + 1], x - 1, y - 1, z - 1, w - 1)))))
}

function permutations(resolution: number): Uint8Array {
	// Generate an array of integers from 0 to 255
	const originalArray = Array.from({ length: resolution }, (_, i) => i)

	// Shuffle the array using the Fisher-Yates (Durstenfeld) shuffle algorithm
	for (let i = originalArray.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[originalArray[i], originalArray[j]] = [originalArray[j], originalArray[i]]
	}

	// Repeat the array to avoid modulo operations for wrapping
	const p = new Uint8Array(originalArray.concat(originalArray))

	return p
}

function generate4dPerlinNoise(width: number, height: number, depth: number, time: number, params: {
	x?: number
	y?: number
	z?: number
	t?: number
	resolution?: number
} = {}): Float32Array {
	params.x ??= 0.05
	params.y ??= 0.05
	params.z ??= 0.05
	params.t ??= 0.05
	params.resolution ??= 256
	const size = width * height * depth * time
	const data = new Float32Array(size)
	const p = permutations(params.resolution) // Ensure this function can handle 4D.
	let index = 0
	for (let t = 0; t < time; t++) {
		for (let z = 0; z < depth; z++) {
			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					// Adjust the scale factor (0.05 here) as needed for your use case
					const noiseValue = perlin(
						p,
						x * params.x,
						y * params.y,
						z * params.z,
						t * params.t,
						params.resolution
					)
					data[index++] = noiseValue
				}
			}
		}
	}
	return data
}
