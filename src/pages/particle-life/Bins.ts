
export class Bins {
	width: number
	height: number
	count: number
	divisions: number

	x: Uint16Array
	y: Uint16Array
	binSize: Uint16Array
	binOffset: Uint16Array
	binCursor: Uint16Array
	bins: Uint16Array

	constructor(width: number, height: number, divisions: number, units: number) {
		this.width = width
		this.height = height
		this.divisions = divisions
		this.count = divisions * divisions

		this.x = new Uint16Array(this.count)
		this.y = new Uint16Array(this.count)
		this.binSize = new Uint16Array(this.count)
		this.binOffset = new Uint16Array(this.count)
		this.binCursor = new Uint16Array(this.count)
		this.bins = new Uint16Array(units)

		for (let i = 0; i < divisions; i++) {
			for (let j = 0; j < divisions; j++) {
				const index = i * divisions + j
				this.x[index] = Math.floor(width / divisions)
				this.y[index] = Math.floor(height / divisions)
			}
		}
	}

	clear() {
		this.binSize.fill(0)
		this.binOffset[0] = 0
		this.binCursor.fill(0)
	}

	size(x: Float32Array, y: Float32Array) {
		for (let i = 0; i < x.length; i++) {
			const binX = Math.floor((x[i] / this.width) * this.divisions)
			const binY = Math.floor((y[i] / this.height) * this.divisions)
			const binIndex = binY * this.divisions + binX
			this.binSize[binIndex]++
		}
		for (let i = 1; i < this.count; i++) {
			this.binOffset[i] = this.binOffset[i - 1] + this.binSize[i - 1]
		}
	}

	fill(x: Float32Array, y: Float32Array) {
		this.clear()
		this.size(x, y)
		for (let i = 0; i < x.length; i++) {
			const binX = Math.floor((x[i] / this.width) * this.divisions)
			const binY = Math.floor((y[i] / this.height) * this.divisions)
			const binIndex = binY * this.divisions + binX
			const offset = this.binOffset[binIndex] + this.binCursor[binIndex]
			this.bins[offset] = i
			this.binCursor[binIndex]++
		}
	}

	query(x: number, y: number, range: number, fn: (index: number) => void) {
		const xmin = Math.floor((x - range) / this.width * this.divisions)
		const xmax = Math.floor((x + range) / this.width * this.divisions)
		const ymin = Math.floor((y - range) / this.height * this.divisions)
		const ymax = Math.floor((y + range) / this.height * this.divisions)

		for (let bin_x = xmin; bin_x <= xmax; bin_x++) {
			for (let bin_y = ymin; bin_y <= ymax; bin_y++) {
				if (bin_x >= 0 && bin_x < this.divisions && bin_y >= 0 && bin_y < this.divisions) {
					const index = bin_y * this.divisions + bin_x
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
		const xmin = Math.floor((x - range) / this.width * this.divisions)
		const xmax = Math.floor((x + range) / this.width * this.divisions)
		const ymin = Math.floor((y - range) / this.height * this.divisions)
		const ymax = Math.floor((y + range) / this.height * this.divisions)

		for (let bin_x = xmin; bin_x <= xmax; bin_x++) {
			const wrapped_bin_x = (bin_x + this.divisions) % this.divisions
			for (let bin_y = ymin; bin_y <= ymax; bin_y++) {
				const wrapped_bin_y = (bin_y + this.divisions) % this.divisions
				const index = wrapped_bin_y * this.divisions + wrapped_bin_x
				const size = this.binSize[index]
				const offset = this.binOffset[index]
				for (let i = offset, len = offset + size; i < len; i++) {
					fn(this.bins[i])
				}
			}
		}
	}
}