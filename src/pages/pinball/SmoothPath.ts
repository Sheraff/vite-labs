type Point = { x: number; y: number }

export class SmoothPath {
	points: Point[]
	width: number
	segments: number
	pathPoints: Point[]
	constructor(points: Point[], width = 20) {
		this.points = points // Array of {x, y} control points
		this.width = width
		this.segments = 100 // Resolution for collision detection
		this.pathPoints = this.generatePathPoints()
	}

	generatePathPoints() {
		const points = []
		for (let t = 0; t <= 1; t += 1 / this.segments) {
			const point = this.getBezierPoint(t)
			points.push(point)
		}
		return points
	}

	getBezierPoint(t: number) {
		// Cubic Bezier curve
		const [p0, p1, p2, p3] = this.points
		const mt = 1 - t

		return {
			x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
			y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y
		}
	}

	getTangentAt(t: number) {
		const [p0, p1, p2, p3] = this.points
		const mt = 1 - t

		const dx = 3 * mt * mt * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x)
		const dy = 3 * mt * mt * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y)

		const length = Math.sqrt(dx * dx + dy * dy)
		return { x: dx / length, y: dy / length }
	}

	draw(ctx: CanvasRenderingContext2D) {
		ctx.beginPath()
		ctx.moveTo(this.points[0].x, this.points[0].y)
		ctx.bezierCurveTo(
			this.points[1].x, this.points[1].y,
			this.points[2].x, this.points[2].y,
			this.points[3].x, this.points[3].y
		)
		ctx.strokeStyle = '#48dbfb'
		ctx.lineWidth = this.width
		ctx.lineCap = 'round'
		ctx.stroke()
	}
}