type Point = { x: number; y: number }

export class Rail {
	start: Point
	end: Point
	radius: number
	length: number
	angle: number
	normal: Point
	constructor(startX: number, startY: number, endX: number, endY: number, radius = 15) {
		this.start = { x: startX, y: startY }
		this.end = { x: endX, y: endY }
		this.radius = radius
		this.length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2))
		this.angle = Math.atan2(endY - startY, endX - startX)
		this.normal = {
			x: -Math.sin(this.angle),
			y: Math.cos(this.angle),
		}
	}

	checkBallCollision(ball: { x: number; y: number; radius: number }) {
		// Vector from rail start to ball
		const toBall = {
			x: ball.x - this.start.x,
			y: ball.y - this.start.y,
		}

		// Project ball onto rail direction
		const railDir = {
			x: Math.cos(this.angle),
			y: Math.sin(this.angle),
		}

		const projection = toBall.x * railDir.x + toBall.y * railDir.y

		// Clamp to rail length
		const clampedProjection = Math.max(0, Math.min(this.length, projection))

		// Find closest point on rail
		const closestPoint = {
			x: this.start.x + clampedProjection * railDir.x,
			y: this.start.y + clampedProjection * railDir.y,
		}

		// Distance from ball to closest point
		const distance = Math.sqrt(Math.pow(ball.x - closestPoint.x, 2) + Math.pow(ball.y - closestPoint.y, 2))

		if (distance < ball.radius + this.radius) {
			return {
				collision: true,
				closestPoint,
				distance,
				normal: {
					x: (ball.x - closestPoint.x) / distance,
					y: (ball.y - closestPoint.y) / distance,
				},
			} as const
		}

		return { collision: false } as const
	}

	handleBallCollision(ball: { x: number; y: number; radius: number; vx: number; vy: number }) {
		const collision = this.checkBallCollision(ball)
		if (!collision.collision) return

		// Move ball out of rail
		const overlap = ball.radius + this.radius - collision.distance
		ball.x += collision.normal.x * overlap
		ball.y += collision.normal.y * overlap

		// Reflect velocity
		const dotProduct = ball.vx * collision.normal.x + ball.vy * collision.normal.y
		ball.vx -= 2 * dotProduct * collision.normal.x * 0.8 // 0.8 = bounce factor
		ball.vy -= 2 * dotProduct * collision.normal.y * 0.8
	}

	draw(ctx: CanvasRenderingContext2D) {
		// Draw rail as thick line with rounded ends
		ctx.beginPath()
		ctx.moveTo(this.start.x, this.start.y)
		ctx.lineTo(this.end.x, this.end.y)
		ctx.strokeStyle = "#ddd"
		ctx.lineWidth = this.radius * 2
		ctx.lineCap = "round"
		ctx.stroke()

		// Add highlight
		ctx.beginPath()
		ctx.moveTo(this.start.x, this.start.y)
		ctx.lineTo(this.end.x, this.end.y)
		ctx.strokeStyle = "#fff"
		ctx.lineWidth = this.radius
		ctx.stroke()
	}
}
