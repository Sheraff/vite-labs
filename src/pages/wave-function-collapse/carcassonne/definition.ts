import image from './image.jpg'

export async function getImageBitmap(url: string) {
	const data = await fetch(url)
	const blob = await data.blob()
	const bitmap = await createImageBitmap(blob)
	return bitmap
}

export const tileSet = await getImageBitmap(image)

export const params = {
	tile: {
		width: 256, // px
		height: 256, // px
	},
	grid: {
		width: 16, // tiles
	},
}

export const definition = [
	['castle', 'castle', 'road', 'castle'],
	['castle', 'castle', 'road', 'castle'],
	['castle', 'castle', 'road', 'castle'],
	['castle', 'grass', 'grass', 'castle'],
	['castle', 'grass', 'grass', 'castle'],
	['castle', 'grass', 'grass', 'castle'],
	['castle', 'grass', 'grass', 'castle'],
	['castle', 'grass', 'grass', 'castle'],
	['castle', 'road', 'road', 'castle'],
	['castle', 'road', 'road', 'castle'],
	['castle', 'road', 'road', 'castle'],
	['castle', 'road', 'road', 'castle'],
	['castle', 'road', 'road', 'castle'],
	['grass', 'castle', 'grass', 'castle'],
	['grass', 'castle', 'grass', 'castle'],
	['grass', 'castle', 'grass', 'castle'],
	['castle', 'grass', 'grass', 'castle'],
	['castle', 'grass', 'grass', 'castle'],
	['castle', 'grass', 'castle', 'grass'],
	['castle', 'grass', 'castle', 'grass'],
	['castle', 'grass', 'castle', 'grass'],
	['castle', 'grass', 'grass', 'grass'],
	['castle', 'grass', 'grass', 'grass'],
	['castle', 'grass', 'grass', 'grass'],
	['castle', 'grass', 'grass', 'grass'],
	['castle', 'grass', 'grass', 'grass'],
	['castle', 'grass', 'road', 'road'],
	['castle', 'grass', 'road', 'road'],
	['castle', 'grass', 'road', 'road'],
	['castle', 'road', 'road', 'grass'],
	['castle', 'road', 'road', 'grass'],
	['castle', 'road', 'road', 'grass'],
	['castle', 'road', 'road', 'road'],
	['castle', 'road', 'road', 'road'],
	['castle', 'road', 'road', 'road'],
	['castle', 'road', 'grass', 'road'],
	['castle', 'road', 'grass', 'road'],
	['castle', 'road', 'grass', 'road'],
	['castle', 'road', 'grass', 'road'],
	['road', 'grass', 'road', 'grass'],
	['road', 'grass', 'road', 'grass'],
	['road', 'grass', 'road', 'grass'],
	['road', 'grass', 'road', 'grass'],
	['road', 'grass', 'road', 'grass'],
	['road', 'grass', 'road', 'grass'],
	['road', 'grass', 'road', 'grass'],
	['road', 'grass', 'road', 'grass'],
	['grass', 'grass', 'road', 'road'],
	['grass', 'grass', 'road', 'road'],
	['grass', 'grass', 'road', 'road'],
	['grass', 'grass', 'road', 'road'],
	['grass', 'grass', 'road', 'road'],
	['grass', 'grass', 'road', 'road'],
	['grass', 'grass', 'road', 'road'],
	['grass', 'grass', 'road', 'road'],
	['grass', 'grass', 'road', 'road'],
	['grass', 'road', 'road', 'road'],
	['grass', 'road', 'road', 'road'],
	['grass', 'road', 'road', 'road'],
	['grass', 'road', 'road', 'road'],
	['road', 'road', 'road', 'road'],
	['grass', 'grass', 'grass', 'grass'],
	['grass', 'grass', 'grass', 'grass'],
	['grass', 'grass', 'grass', 'grass'],
	['grass', 'grass', 'grass', 'grass'],
	['grass', 'grass', 'road', 'grass'],
	['grass', 'grass', 'road', 'grass'],
	['castle', 'castle', 'castle', 'castle'],
	['castle', 'castle', 'grass', 'castle'],
	['castle', 'castle', 'grass', 'castle'],
	['castle', 'castle', 'grass', 'castle'],
	['castle', 'castle', 'grass', 'castle'],
	['grass', 'grass', 'road', 'road'],
	['castle', 'grass', 'road', 'grass'],
	['road', 'castle', 'road', 'castle'],
	['grass', 'road', 'grass', 'road'],
	['road', 'road', 'road', 'road'],
	['castle', 'road', 'grass', 'castle'],
	['grass', 'castle', 'grass', 'grass'],
	['castle', 'castle', 'castle', 'castle'],
	['castle', 'castle', 'castle', 'castle'],
	['castle', 'castle', 'castle', 'castle'],
	['grass', 'road', 'grass', 'road'],
	['grass', 'road', 'road', 'road'],
	['castle', 'road', 'road', 'castle'],
	['castle', 'grass', 'road', 'road'],
	['castle', 'grass', 'road', 'castle'],
	['castle', 'grass', 'castle', 'castle'],
	['castle', 'grass', 'castle', 'castle'],
	['road', 'castle', 'road', 'castle'],
	['castle', 'road', 'castle', 'grass'],
	['road', 'road', 'castle', 'castle'],
	['castle', 'castle', 'road', 'castle'],
	['castle', 'castle', 'castle', 'castle'],
	['road', 'grass', 'castle', 'castle'],
	['castle', 'grass', 'grass', 'castle'],
	['castle', 'castle', 'castle', 'castle'],
	['castle', 'castle', 'road', 'road'],
	['castle', 'road', 'castle', 'road'],
	['castle', 'grass', 'castle', 'grass'],
	['castle', 'castle', 'castle', 'grass'],
	['castle', 'castle', 'grass', 'castle'],
	['road', 'grass', 'road', 'road'],
	['road', 'castle', 'castle', 'grass'],
	['castle', 'castle', 'road', 'grass'],
	['road', 'castle', 'castle', 'castle'],
	['castle', 'grass', 'castle', 'castle'],
	['grass', 'castle', 'castle', 'grass'],
	['castle', 'road', 'grass', 'grass'],
	['road', 'road', 'road', 'road'],
	['road', 'castle', 'grass', 'road'],
	['castle', 'road', 'castle', 'grass'],
	['grass', 'road', 'castle', 'castle'],
	['castle', 'castle', 'castle', 'road'],
	['grass', 'grass', 'water', 'grass'],
	['grass', 'water', 'water', 'grass'],
	['grass', 'water', 'water', 'grass'],
	['grass', 'water', 'road', 'water'],
	['road', 'road', 'water', 'water'],
	['water', 'grass', 'water', 'grass'],
	['water', 'grass', 'water', 'grass'],
	['water', 'grass', 'grass', 'grass'],
	['water', 'castle', 'water', 'road'],
	['castle', 'water', 'castle', 'water'],
	['road', 'water', 'road', 'water'],
	['water', 'castle', 'castle', 'water'],
	['road', 'castle', 'road', 'castle'],
	['grass', 'castle', 'grass', 'castle'],
	['castle', 'castle', 'grass', 'castle'],
	['castle', 'grass', 'grass', 'castle'],
	['castle', 'grass', 'road', 'road'],
	['castle', 'road', 'road', 'grass'],
	['castle', 'grass', 'grass', 'grass'],
	['grass', 'road', 'road', 'road'],
	['grass', 'road', 'road', 'road'],
	['grass', 'grass', 'road', 'road'],
	['grass', 'grass', 'road', 'road'],
	['road', 'grass', 'road', 'grass'],
	['grass', 'grass', 'road', 'road'],
	['road', 'grass', 'road', 'grass'],
	['grass', 'grass', 'road', 'grass'],
	['grass', 'grass', 'grass', 'grass'],
	['castle', 'grass', 'grass', 'grass'],
	['castle', 'grass', 'grass', 'castle'],
	['castle', 'castle', 'grass', 'castle'],
	['castle', 'grass', 'grass', 'castle'],
	['grass', 'castle', 'castle', 'castle'],
	['castle', 'grass', 'grass', 'castle'],
	['castle', 'road', 'road', 'castle'],
	['castle', 'road', 'road', 'road'],
	['castle', 'castle', 'grass', 'castle'],
	['castle', 'road', 'road', 'castle'],
	['castle', 'grass', 'road', 'road'],
	['castle', 'road', 'road', 'grass'],
	['road', 'road', 'road', 'road'],
	['grass', 'road', 'road', 'road'],
]