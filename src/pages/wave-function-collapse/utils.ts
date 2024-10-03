export const get = (width: number, height: number, length: number, view: DataView, x: number, y: number, t: number) => {
	const index = (y * width + x) * length + t
	const byte = index >> 3 // index / 8
	const offset = index & ~(byte << 3) // index % 8
	return ((view.getUint8(byte) >> offset) & 1) as 0 | 1
}

export const set = (width: number, height: number, length: number, view: DataView, x: number, y: number, t: number, value: boolean) => {
	const index = (y * width + x) * length + t
	const byte = index >> 3 // index / 8
	const offset = index & ~(byte << 3) // index % 8
	if (value) {
		view.setUint8(byte, view.getUint8(byte) | (1 << offset))
	} else {
		view.setUint8(byte, view.getUint8(byte) & ~(1 << offset))
	}
}