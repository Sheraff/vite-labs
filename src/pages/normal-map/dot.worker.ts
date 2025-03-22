/// <reference lib="webworker" />

import { computePixelShadow, easings, makeSharedImageData, type Inputs } from "./utils"

export type Incoming =
	| {
		type: "init", data: {
			inputs: SharedArrayBuffer,
			normal_map: { data: SharedArrayBuffer, width: number, height: number },
			color_map: { data: SharedArrayBuffer, width: number, height: number },
			result: { data: SharedArrayBuffer, width: number, height: number },
			range: [start: number, end: number],
			notifier: SharedArrayBuffer,
		}
	}

{
	self.onmessage = (e: MessageEvent<Incoming>) => handleMessage(e.data)
	function handleMessage(event: Incoming) {
		if (event.type === 'init') {
			const inputs = new Float32Array(event.data.inputs) as unknown as Inputs
			const normal_map = makeSharedImageData(event.data.normal_map.width, event.data.normal_map.height, event.data.normal_map.data)
			const color_map = makeSharedImageData(event.data.color_map.width, event.data.color_map.height, event.data.color_map.data)
			const result = makeSharedImageData(event.data.result.width, event.data.result.height, event.data.result.data)
			const range = event.data.range
			const notifier = new Int32Array(event.data.notifier)
			start({
				inputs,
				normal_map,
				color_map,
				result,
				range,
				notifier,
			})
		} else {
			throw new Error('Unknown message type ' + event.type)
		}
	}
}

function start({
	inputs,
	normal_map,
	color_map,
	result,
	range,
	notifier,
}: {
	inputs: Inputs,
	normal_map: ImageData,
	color_map: ImageData,
	result: ImageData,
	range: [start: number, end: number],
	notifier: Int32Array,
}) {
	do {
		const light_source_x = inputs[0]
		const light_source_y = inputs[1]
		const light_source_z = inputs[2]
		const max_distance = inputs[3]
		const easing = easings[inputs[4]].fn
		const color = Boolean(inputs[5])
		const ambient = inputs[6] / 255

		for (let i = range[0]; i < range[1]; i++) {
			const x = i % normal_map.width
			const y = Math.floor(i / normal_map.width)

			const index = i * 4

			const dx = x - light_source_x
			const dy = y - light_source_y

			if (Math.abs(dx) > max_distance || Math.abs(dy) > max_distance) {
				applyFade(result, index, color_map, 0, ambient, color)
				continue
			}

			const distance = Math.hypot(dx, dy)

			if (distance > max_distance) {
				applyFade(result, index, color_map, 0, ambient, color)
				continue
			}

			const normalized_distance = easing(1 - distance / max_distance)

			const dot = computePixelShadow(normal_map, light_source_x, light_source_y, light_source_z, x, y, index)

			const fade = dot * normalized_distance

			applyFade(result, index, color_map, fade, ambient, color)
		}
	} while (Atomics.wait(notifier, 0, 0) === 'ok')
	self.close()
	throw new Error('Atomics.wait() failed, worker has been terminated')
}

function applyFade(
	image: ImageData,
	index: number,
	source: ImageData,
	fade: number,
	ambient: number,
	color: boolean
) {
	if (ambient === 0 && fade === 0) {
		image.data[index] = 0
		image.data[index + 1] = 0
		image.data[index + 2] = 0
		image.data[index + 3] = 255
		return
	}

	const mul = (1 - ambient) * fade + ambient

	if (!color) {
		const value = mul * 255
		image.data[index] = value
		image.data[index + 1] = value
		image.data[index + 2] = value
		image.data[index + 3] = 255
		return
	}

	image.data[index] = mul * source.data[index]
	image.data[index + 1] = mul * source.data[index + 1]
	image.data[index + 2] = mul * source.data[index + 2]
	image.data[index + 3] = 255
}
