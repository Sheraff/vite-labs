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
			y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
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

	checkBallCollision(ball: { x: number; y: number; radius: number }) {
		// Check collision with each segment of the path
		for (let i = 0; i < this.pathPoints.length - 1; i++) {
			const p1 = this.pathPoints[i]
			const p2 = this.pathPoints[i + 1]

			// Vector from p1 to p2
			const dx = p2.x - p1.x
			const dy = p2.y - p1.y
			const lenSq = dx * dx + dy * dy

			if (lenSq === 0) continue

			// Project ball onto segment
			let t = ((ball.x - p1.x) * dx + (ball.y - p1.y) * dy) / lenSq
			t = Math.max(0, Math.min(1, t))

			// Closest point on segment
			const closestX = p1.x + t * dx
			const closestY = p1.y + t * dy

			// Distance to ball
			const distX = ball.x - closestX
			const distY = ball.y - closestY
			const distSq = distX * distX + distY * distY
			const minDist = ball.radius + this.width / 2

			if (distSq < minDist * minDist) {
				const dist = Math.sqrt(distSq)
				return {
					collision: true,
					closestX,
					closestY,
					distance: dist,
					normal: { x: distX / dist, y: distY / dist },
					tangent: { x: dx / Math.sqrt(lenSq), y: dy / Math.sqrt(lenSq) },
				}
			}
		}
		return null
	}

	handleBallCollision(ball: { x: number; y: number; radius: number; vx: number; vy: number }) {
		const collision = this.checkBallCollision(ball)
		if (!collision) return

		// Move ball out of path
		const overlap = ball.radius + this.width / 2 - collision.distance
		ball.x += collision.normal.x * overlap
		ball.y += collision.normal.y * overlap

		// Reflect velocity along normal
		const dotProduct = ball.vx * collision.normal.x + ball.vy * collision.normal.y
		ball.vx -= 2 * dotProduct * collision.normal.x * 0.8
		ball.vy -= 2 * dotProduct * collision.normal.y * 0.8

		// Add some tangential speed for smooth rolling
		const tangentSpeed = ball.vx * collision.tangent.x + ball.vy * collision.tangent.y
		ball.vx += collision.tangent.x * tangentSpeed * 0.05
		ball.vy += collision.tangent.y * tangentSpeed * 0.05
	}

	draw(ctx: CanvasRenderingContext2D) {
		ctx.beginPath()
		ctx.moveTo(this.points[0].x, this.points[0].y)
		ctx.bezierCurveTo(
			this.points[1].x,
			this.points[1].y,
			this.points[2].x,
			this.points[2].y,
			this.points[3].x,
			this.points[3].y,
		)
		ctx.strokeStyle = "#48dbfb"
		ctx.lineWidth = this.width
		ctx.lineCap = "round"
		ctx.stroke()
	}
}
