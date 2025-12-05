export class Vector {
	x: number
	y: number

	constructor(
		x: number,
		y: number,
	) {
		this.x = x
		this.y = y
	}
	add(v: Vector) {
		return new Vector(this.x + v.x, this.y + v.y)
	}
	sub(v: Vector) {
		return new Vector(this.x - v.x, this.y - v.y)
	}
	dist(v: Vector) {
		return Math.hypot(this.x - v.x, this.y - v.y)
	}
	entrywise(v: Vector) {
		return new Vector(this.x * v.x, this.y * v.y)
	}

	*[Symbol.iterator]() {
		yield this.x
		yield this.y
	}
}
