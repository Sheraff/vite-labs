export function makeSharedImageData(width: number, height: number, buffer?: SharedArrayBuffer): ImageData {
	const byteLength = width * height * Uint8ClampedArray.BYTES_PER_ELEMENT * 4
	if (buffer && buffer.byteLength !== byteLength) {
		throw new Error(`Buffer size mismatch: expected ${byteLength}, got ${buffer.byteLength}`)
	}
	buffer ??= new SharedArrayBuffer(byteLength)
	const data = new Uint8ClampedArray(buffer)
	return {
		data,
		width,
		height,
		colorSpace: 'srgb',
	} as ImageData
}

export type Inputs = [
	light_x: number,
	light_y: number,
	light_z: number,
	max_distance: number,
	easing: number,
	color: number,
	ambient: number,
]
export const inputs_length = 7

export function computePixelShadow(map: ImageData, lx: number, ly: number, lz: number, x: number, y: number, index: number) {
	const r = map.data[index]
	const g = map.data[index + 1]
	const b = map.data[index + 2]

	// normal map to normal vector
	const nx = r / 255 * 2 - 1 // normal x [-1, 1]
	const ny = g / 255 * 2 - 1 // normal y [-1, 1]
	const nz = b / 255 // normal z [0, 1]

	// light vector
	lx -= x
	ly -= y

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

export async function getImageData(url: string | Promise<string>, options: {
	fit: 'contain' | 'cover'
	width: number
	height: number
}) {
	url = await url
	const data = await fetch(url)
	const blob = await data.blob()
	const bitmap = await createImageBitmap(blob)

	const canvas = document.createElement('canvas')
	const map_ratio = bitmap.width / bitmap.height
	const screen_ratio = options.width / options.height
	if ((map_ratio > screen_ratio) === (options.fit === 'cover')) {
		const side = options.height
		canvas.width = (bitmap.width / bitmap.height) * side
		canvas.height = side
	} else {
		const side = options.width
		canvas.width = side
		canvas.height = (bitmap.height / bitmap.width) * side
	}
	const ctx = canvas.getContext('2d')
	if (!ctx) {
		throw new Error('Failed to get canvas context')
	}
	ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, canvas.width, canvas.height)
	const result = ctx.getImageData(0, 0, canvas.width, canvas.height, { colorSpace: 'srgb' })
	const imageData = makeSharedImageData(result.width, result.height)
	imageData.data.set(result.data)
	return imageData
}

export const easings = [
	{
		name: 'linear',
		fn: (x: number) => x,
	},
	{
		name: 'ease-in',
		fn: (x: number) => x * x,
	},
	{
		name: 'ease-out',
		fn: (x: number) => 1 - (1 - x) * (1 - x),
	},
	{
		name: 'ease-in-out',
		fn: (x: number) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2,
	},
	{
		name: 'ease-in-sine',
		fn: (x: number) => 1 - Math.cos((x * Math.PI) / 2),
	},
	{
		name: 'ease-out-sine',
		fn: (x: number) => Math.sin((x * Math.PI) / 2),
	},
	{
		name: 'ease-in-out-sine',
		fn: (x: number) => 0.5 * (1 - Math.cos(x * Math.PI)),
	},
	{
		name: 'ease-in-cubic',
		fn: (x: number) => x * x * x,
	},
	{
		name: 'ease-out-cubic',
		fn: (x: number) => 1 - Math.pow(1 - x, 3),
	},
	{
		name: 'ease-in-out-cubic',
		fn: (x: number) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
	},
	{
		name: 'ease-in-quart',
		fn: (x: number) => x * x * x * x,
	},
	{
		name: 'ease-out-quart',
		fn: (x: number) => 1 - Math.pow(1 - x, 4),
	},
	{
		name: 'ease-in-out-quart',
		fn: (x: number) => x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2,
	},
]