export async function getImageData(url: string | Promise<string>) {
	url = await url
	const data = await fetch(url)
	const blob = await data.blob()
	const bitmap = await createImageBitmap(blob)
	return bitmap
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