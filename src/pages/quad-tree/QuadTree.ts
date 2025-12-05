type Entity = { x: number; y: number }

export class QuadTree<T extends Entity = Entity> {
	static MAX_OBJECTS = 4
	static MAX_DEPTH = Infinity

	#objectQuadrantMap: WeakMap<T & Entity, QuadTree<T>>

	nodes: null | [QuadTree<T>, QuadTree<T>, QuadTree<T>, QuadTree<T>] = null

	objects = new Set<T & Entity>()

	constructor(
		public x: number,
		public y: number,
		public width: number,
		public height: number,
		public parent: QuadTree<T> | undefined = undefined,
		public depth: number = 0,
		objectQuadrantMap: WeakMap<T & Entity, QuadTree<T>> = new WeakMap(),
	) {
		this.x = x
		this.y = y
		this.width = width
		this.height = height
		this.parent = parent
		this.depth = depth
		this.#objectQuadrantMap = objectQuadrantMap
	}

	#split() {
		const subWidth = this.width / 2
		const subHeight = this.height / 2
		const x = this.x
		const y = this.y
		this.nodes = [
			new QuadTree(x, y, subWidth, subHeight, this, this.depth + 1, this.#objectQuadrantMap),
			new QuadTree(x + subWidth, y, subWidth, subHeight, this, this.depth + 1, this.#objectQuadrantMap),
			new QuadTree(x, y + subHeight, subWidth, subHeight, this, this.depth + 1, this.#objectQuadrantMap),
			new QuadTree(x + subWidth, y + subHeight, subWidth, subHeight, this, this.depth + 1, this.#objectQuadrantMap),
		]
		this.objects.forEach((obj) => this.insert(obj))
		this.objects.clear()
	}

	#getIndex(obj: T) {
		const indexX = obj.x > this.x + this.width / 2
		const indexY = obj.y > this.y + this.height / 2
		return +indexX + +indexY * 2
	}

	insert(obj: T) {
		if (this.nodes) {
			const index = this.#getIndex(obj)
			this.nodes[index].insert(obj)
			return
		}
		this.objects.add(obj)
		this.#objectQuadrantMap.set(obj, this)
		if (this.objects.size >= QuadTree.MAX_OBJECTS && this.depth < QuadTree.MAX_DEPTH) {
			this.#split()
		}
	}

	displace(obj: T) {
		const quadrant = this.#objectQuadrantMap.get(obj)
		if (quadrant && !quadrant.isWithinBounds(obj)) {
			quadrant.remove(obj)
			this.insert(obj)
		}
	}

	remove(obj: T) {
		this.objects.delete(obj)
		if (this.length < QuadTree.MAX_OBJECTS) {
			this.merge()
		}
	}

	merge() {
		if (this.parent && this.parent.length < QuadTree.MAX_OBJECTS) {
			this.parent.merge()
			return
		}
		if (this.nodes) {
			this.collectChildrenObjects()
			this.objects.forEach((obj) => this.#objectQuadrantMap.set(obj, this))
			this.nodes = null
		}
	}

	get length(): number {
		return this.objects.size + (!this.nodes ? 0 : this.nodes.reduce((acc, node) => acc + node.length, 0))
	}

	collectChildrenObjects(set = this.objects) {
		if (set !== this.objects) {
			this.objects.forEach((obj) => set.add(obj))
		}
		this.nodes?.forEach((node) => {
			node.collectChildrenObjects(set)
		})
	}

	isWithinBounds(obj: Entity) {
		return obj.x >= this.x && obj.x <= this.x + this.width && obj.y >= this.y && obj.y <= this.y + this.height
	}

	filter(callback: (node: QuadTree<T>) => boolean, objects: T[] = []) {
		if (!this.nodes) {
			objects.push(...this.objects)
			return objects
		}
		this.nodes.forEach((node) => {
			if (callback(node)) {
				node.filter(callback, objects)
			}
		})
		return objects
	}
}
