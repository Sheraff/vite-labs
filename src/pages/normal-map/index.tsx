import type { RouteMeta } from "~/router"
import styles from './styles.module.css'
import { Head } from "~/components/Head"
import { useEffect, useRef } from "react"

import normal_source from './world/map.jpg'
import color_source from './world/color.jpg'
// import image from './bricks.png'

const screen_width = window.innerWidth // * window.devicePixelRatio
const screen_height = window.innerHeight // * window.devicePixelRatio
const fit: 'contain' | 'cover' = 'contain'

const normal_map = await getImageData(normal_source)
const color_map = await getImageData(color_source)


async function getImageData(url: string | Promise<string>) {
	url = await url
	const data = await fetch(url)
	const blob = await data.blob()
	const bitmap = await createImageBitmap(blob)

	const canvas = document.createElement('canvas')
	const map_ratio = bitmap.width / bitmap.height
	const screen_ratio = screen_width / screen_height
	if ((map_ratio > screen_ratio) === (fit === 'cover')) {
		const side = screen_height
		canvas.width = (bitmap.width / bitmap.height) * side
		canvas.height = side
	} else {
		const side = screen_width
		canvas.width = side
		canvas.height = (bitmap.height / bitmap.width) * side
	}
	const ctx = canvas.getContext('2d')
	if (!ctx) {
		throw new Error('Failed to get canvas context')
	}
	ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, canvas.width, canvas.height)
	return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

export const meta: RouteMeta = {
	title: 'Normal Map',
	image: './screen.png'
}

export default function NormalMapPage() {
	const ref = useRef<HTMLCanvasElement | null>(null)
	useEffect(() => {
		const canvas = ref.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		canvas.width = screen_width
		canvas.height = screen_height

		const light_source = {
			x: 125,
			y: 125,
			z: 50,
		}

		const result = ctx.createImageData(normal_map.width, normal_map.height)

		const { width, height } = normal_map
		const size = width * height

		const max_distance = Math.hypot(canvas.width, canvas.height) / 2

		let rafId = requestAnimationFrame(function loop() {
			rafId = requestAnimationFrame(loop)
			for (
				// init
				let i = 0,
				x = 0,
				y = 0;
				// condition
				i < size;
				// increment
				i += 1,
				x = (x + 1) % width,
				y += +(x === 0)
			) {
				const index = i * 4

				const dx = x - light_source.x
				const dy = y - light_source.y

				if (Math.abs(dx) > max_distance || Math.abs(dy) > max_distance) {
					result.data[index] = 0
					result.data[index + 1] = 0
					result.data[index + 2] = 0
					result.data[index + 3] = 255
					continue
				}

				const distance = Math.hypot(dx, dy)

				if (distance > max_distance) {
					result.data[index] = 0
					result.data[index + 1] = 0
					result.data[index + 2] = 0
					result.data[index + 3] = 255
					continue
				}

				const normalized_distance = 1 - distance / max_distance

				const dot = computePixelShadow(normal_map, light_source, x, y, index)

				// result.data[index] = dot * 255
				// result.data[index + 1] = dot * 255
				// result.data[index + 2] = dot * 255
				// result.data[index + 3] = normalized_distance * 255

				const fade = dot * normalized_distance

				result.data[index] = fade * color_map.data[index]
				result.data[index + 1] = fade * color_map.data[index + 1]
				result.data[index + 2] = fade * color_map.data[index + 2]
				result.data[index + 3] = 255
			}
			ctx.putImageData(result, 0, 0)
		})

		const controller = new AbortController()

		canvas.addEventListener('pointermove', (e) => {
			const event = e.getPredictedEvents().at(0) || e
			const { left, top, width, height } = canvas.getBoundingClientRect()

			const x = (event.clientX - left) / width * screen_width
			const y = (event.clientY - top) / height * screen_height
			light_source.x = x
			light_source.y = y
		}, { signal: controller.signal })

		return () => {
			cancelAnimationFrame(rafId)
			controller.abort()
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

function computePixelShadow(map: ImageData, light_source: { x: number, y: number, z: number }, x: number, y: number, index: number) {
	const r = normal_map.data[index]
	const g = normal_map.data[index + 1]
	const b = normal_map.data[index + 2]

	// normal map to normal vector
	const nx = r / 255 * 2 - 1 // normal x [-1, 1]
	const ny = g / 255 * 2 - 1 // normal y [-1, 1]
	const nz = b / 255 // normal z [0, 1]

	// light vector
	const lx = light_source.x - x
	const ly = light_source.y - y
	const lz = light_source.z

	// normalize light vector
	const lightDistance = Math.hypot(lx, ly, lz)
	const lnx = lx / lightDistance
	const lny = ly / lightDistance
	const lnz = lz / lightDistance

	// Calculate dot product between normal and light direction
	// This gives us the cosine of the angle between vectors
	const dot = nx * lnx + ny * lny + nz * lnz
	const clamped = Math.max(0, Math.min(1, dot))

	return clamped
}