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
			start({
				inputs,
				normal_map,
				color_map,
				result,
				range,
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
}: {
	inputs: Inputs,
	normal_map: ImageData,
	color_map: ImageData,
	result: ImageData,
	range: [start: number, end: number],
}) {
	let last_inputs: Inputs | null = null
	requestAnimationFrame(function loop() {
		requestAnimationFrame(loop)
		if (last_inputs && last_inputs.every((v, i) => v === inputs[i])) {
			return
		}
		last_inputs = [...inputs]

		const light_source_x = inputs[0]
		const light_source_y = inputs[1]
		const light_source_z = inputs[2]
		const max_distance = inputs[3]
		const easing = easings[inputs[4]].fn
		const color = Boolean(inputs[5])

		for (let i = range[0]; i < range[1]; i++) {
			const x = i % normal_map.width
			const y = Math.floor(i / normal_map.width)

			const index = i * 4

			const dx = x - light_source_x
			const dy = y - light_source_y

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

			const normalized_distance = easing(1 - distance / max_distance)

			const dot = computePixelShadow(normal_map, light_source_x, light_source_y, light_source_z, x, y, index)

			const fade = dot * normalized_distance

			if (color) {
				result.data[index] = fade * color_map.data[index]
				result.data[index + 1] = fade * color_map.data[index + 1]
				result.data[index + 2] = fade * color_map.data[index + 2]
				result.data[index + 3] = 255
			} else {
				result.data[index] = fade * 255
				result.data[index + 1] = fade * 255
				result.data[index + 2] = fade * 255
				result.data[index + 3] = 255
			}
		}
	})
}
