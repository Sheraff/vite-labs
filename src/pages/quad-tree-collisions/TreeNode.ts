
export class TreeNode<T extends { x: number, y: number } = { x: number, y: number }> {
	// immutable properties
	x: number
	y: number
	width: number
	height: number
	maxX: number
	maxY: number
	maxdepth: number
	depth: number
	parent: TreeNode<T> | null
	children: [
		topLeft: TreeNode<T>,
		topRight: TreeNode<T>,
		bottomLeft: TreeNode<T>,
		bottomRight: TreeNode<T>,
	] | null = null

	// mutable properties
	objects: Set<T> = new Set()
	isEmpty = true

	constructor(
		x: number,
		y: number,
		width: number,
		height: number,
		maxdepth: number = 6,
		depth: number = 0,
		parent: TreeNode<T> | null = null
	) {
		this.x = x
		this.y = y
		this.width = width
		this.height = height
		this.maxdepth = maxdepth
		this.depth = depth
		this.parent = parent
		this.maxX = x + width
		this.maxY = y + height

		if (depth < this.maxdepth) {
			const halfWidth = width / 2
			const halfHeight = height / 2
			this.children = [
				new TreeNode(x, y, halfWidth, halfHeight, this.maxdepth, depth + 1, this),
				new TreeNode(x + halfWidth, y, halfWidth, halfHeight, this.maxdepth, depth + 1, this),
				new TreeNode(x, y + halfHeight, halfWidth, halfHeight, this.maxdepth, depth + 1, this),
				new TreeNode(x + halfWidth, y + halfHeight, halfWidth, halfHeight, this.maxdepth, depth + 1, this),
			]
		}
	}

	isInside(x: number, y: number) {
		return x >= this.x && x <= this.maxX && y >= this.y && y <= this.maxY
	}

	insert(obj: T) {
		this.objects.add(obj)
		this.isEmpty = false
		if (this.children) {
			for (const child of this.children) {
				if (child.isInside(obj.x, obj.y)) {
					child.insert(obj)
					return
				}
			}
		}
	}

	remove(obj: T) {
		if (!this.objects.has(obj)) return
		this.objects.delete(obj)
		this.isEmpty = this.objects.size === 0
		if (this.children) {
			for (const child of this.children) {
				if (!child.isEmpty) child.remove(obj)
			}
		}
	}

	query(x: number, y: number, radius: number, result: Set<T> = new Set()): Set<T> {
		if (x + radius < this.x || x - radius > this.maxX ||
			y + radius < this.y || y - radius > this.maxY) {
			return result
		}
		if (this.children) {
			for (const child of this.children) {
				if (!child.isEmpty) child.query(x, y, radius, result)
			}
			return result
		} else {
			this.objects.forEach(obj => result.add(obj))
			return this.objects
		}
	}

	update(obj: T) {
		const isInside = this.isInside(obj.x, obj.y)
		if (this.objects.has(obj)) {
			if (isInside) {
				if (this.children) {
					for (const child of this.children) {
						if (!child.isEmpty) child.update(obj)
					}
				}
			} else {
				this.remove(obj)
			}
		} else {
			if (isInside) {
				this.insert(obj)
			} else {
				// no-op
			}
		}
	}
}