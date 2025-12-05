export class Bins {
	width: number
	height: number
	count: number

	width_divisions: number
	height_divisions: number
	to_bin_x: number
	to_bin_y: number

	binSize: Uint16Array
	binOffset: Uint16Array
	binCursor: Uint16Array
	bins: Uint16Array

	constructor(width: number, height: number, cellSize: number, units: number) {
		this.width = width
		this.height = height

		this.width_divisions = Math.ceil(width / cellSize)
		this.height_divisions = Math.ceil(height / cellSize)

		this.to_bin_x = this.width_divisions / width
		this.to_bin_y = this.height_divisions / height

		this.count = this.width_divisions * this.height_divisions

		this.binSize = new Uint16Array(this.count)
		this.binOffset = new Uint16Array(this.count)
		this.binCursor = new Uint16Array(this.count)
		this.bins = new Uint16Array(units)
	}

	clear() {
		this.binSize.fill(0)
		this.binOffset[0] = 0
		this.binCursor.fill(0)
	}

	size(x: Float32Array, y: Float32Array) {
		const wd = this.width_divisions
		const to_bin_x = this.to_bin_x
		const to_bin_y = this.to_bin_y
		const binSize = this.binSize
		for (let i = 0, len = x.length; i < len; i++) {
			const binX = Math.floor(x[i] * to_bin_x)
			const binY = Math.floor(y[i] * to_bin_y)
			const binIndex = binY * wd + binX
			binSize[binIndex]++
		}

		const binOffset = this.binOffset
		for (let i = 1, len = this.count; i < len; i++) {
			binOffset[i] = binOffset[i - 1] + binSize[i - 1]
		}
	}

	fill(x: Float32Array, y: Float32Array) {
		this.clear()
		this.size(x, y)
		const bins = this.bins
		const binOffset = this.binOffset
		const binCursor = this.binCursor
		const wd = this.width_divisions
		const to_bin_x = this.to_bin_x
		const to_bin_y = this.to_bin_y
		for (let i = 0, len = x.length; i < len; i++) {
			const binX = Math.floor(x[i] * to_bin_x)
			const binY = Math.floor(y[i] * to_bin_y)
			const binIndex = binY * wd + binX
			const offset = binOffset[binIndex] + binCursor[binIndex]
			bins[offset] = i
			binCursor[binIndex]++
		}
	}

	query(x: number, y: number, range: number, fn: (index: number) => void) {
		const xmin = Math.floor((x - range) * this.to_bin_x)
		const xmax = Math.floor((x + range) * this.to_bin_x)
		const ymin = Math.floor((y - range) * this.to_bin_y)
		const ymax = Math.floor((y + range) * this.to_bin_y)

		for (let bin_x = xmin; bin_x <= xmax; bin_x++) {
			for (let bin_y = ymin; bin_y <= ymax; bin_y++) {
				if (bin_x >= 0 && bin_x < this.width_divisions && bin_y >= 0 && bin_y < this.height_divisions) {
					const index = bin_y * this.width_divisions + bin_x
					const size = this.binSize[index]
					const offset = this.binOffset[index]
					for (let i = offset, len = offset + size; i < len; i++) {
						fn(this.bins[i])
					}
				}
			}
		}
	}

	queryWrap(x: number, y: number, range: number, fn: (index: number) => void) {
		const xmin = Math.floor((x - range) * this.to_bin_x)
		const xmax = Math.floor((x + range) * this.to_bin_x)
		const ymin = Math.floor((y - range) * this.to_bin_y)
		const ymax = Math.floor((y + range) * this.to_bin_y)

		const wd = this.width_divisions
		const hd = this.height_divisions
		const bins = this.bins
		const binSize = this.binSize
		const binOffset = this.binOffset

		for (let bin_x = xmin; bin_x <= xmax; bin_x++) {
			const wrapped_bin_x = (bin_x + wd) % wd
			for (let bin_y = ymin; bin_y <= ymax; bin_y++) {
				const wrapped_bin_y = (bin_y + hd) % hd
				const index = wrapped_bin_y * wd + wrapped_bin_x
				const size = binSize[index]
				const offset = binOffset[index]
				for (let i = offset, len = offset + size; i < len; i++) {
					fn(bins[i])
				}
			}
		}
	}
}
