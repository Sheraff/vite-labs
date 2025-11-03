
export class StaticTreeNode {
	// immutable properties
	x: number
	y: number
	width: number
	height: number
	maxX: number
	maxY: number
	maxdepth: number
	depth: number
	parent: StaticTreeNode | null
	children: [
		topLeft: StaticTreeNode,
		topRight: StaticTreeNode,
		bottomLeft: StaticTreeNode,
		bottomRight: StaticTreeNode,
	] | null = null
	x_array: Float32Array
	y_array: Float32Array

	// mutable properties
	indices: Set<number> = new Set()
	isEmpty = true

	constructor(
		x: number,
		y: number,
		width: number,
		height: number,
		x_array: Float32Array,
		y_array: Float32Array,
		maxdepth: number = 6,
		depth: number = 0,
		parent: StaticTreeNode | null = null
	) {
		this.x = x
		this.y = y
		this.width = width
		this.height = height
		this.x_array = x_array
		this.y_array = y_array
		this.maxdepth = maxdepth
		this.depth = depth
		this.parent = parent
		this.maxX = x + width
		this.maxY = y + height

		if (depth < this.maxdepth) {
			const halfWidth = width / 2
			const halfHeight = height / 2
			this.children = [
				new StaticTreeNode(x, y, halfWidth, halfHeight, x_array, y_array, this.maxdepth, depth + 1, this),
				new StaticTreeNode(x + halfWidth, y, halfWidth, halfHeight, x_array, y_array, this.maxdepth, depth + 1, this),
				new StaticTreeNode(x, y + halfHeight, halfWidth, halfHeight, x_array, y_array, this.maxdepth, depth + 1, this),
				new StaticTreeNode(x + halfWidth, y + halfHeight, halfWidth, halfHeight, x_array, y_array, this.maxdepth, depth + 1, this),
			]
		}
	}

	isInside(x: number, y: number) {
		return x >= this.x && x <= this.maxX && y >= this.y && y <= this.maxY
	}

	insert(index: number) {
		this.indices.add(index)
		this.isEmpty = false
		if (this.children) {
			for (let i = 0; i < 4; i++) {
				const child = this.children[i]
				if (child.isInside(this.x_array[index], this.y_array[index])) {
					child.insert(index)
					return
				}
			}
		}
	}

	remove(index: number) {
		if (!this.indices.has(index)) return
		this.indices.delete(index)
		this.isEmpty = this.indices.size === 0
		if (this.children) {
			for (let i = 0; i < 4; i++) {
				const child = this.children[i]
				if (!child.isEmpty) child.remove(index)
			}
		}
	}

	query(x: number, y: number, radius: number, result: Array<number> = []): Array<number> {
		if (this.children) {
			for (let i = 0; i < 4; i++) {
				const child = this.children[i]
				if (!child.isEmpty) {
					if (x + radius >= this.x && x - radius <= this.maxX &&
						y + radius >= this.y && y - radius <= this.maxY) {
						child.query(x, y, radius, result)
					}
				}
			}
			return result
		} else {
			for (const index of this.indices) {
				result.push(index)
			}
			return result
		}
	}

	update(index: number) {
		const isInside = this.isInside(this.x_array[index], this.y_array[index])
		if (this.indices.has(index)) {
			if (isInside) {
				if (this.children) {
					for (let i = 0; i < 4; i++) {
						const child = this.children[i]
						if (!child.isEmpty) child.update(index)
					}
				}
			} else {
				this.remove(index)
			}
		} else {
			if (isInside) {
				this.insert(index)
			} else {
				// no-op
			}
		}
	}
}