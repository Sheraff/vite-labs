export class Bumper {
	x: number
	y: number
	radius: number
	points: number

	constructor(x: number, y: number, radius: number, points: number) {
		this.x = x
		this.y = y
		this.radius = radius
		this.points = points
	}

	draw(ctx: CanvasRenderingContext2D) {
		ctx.beginPath()
		ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
		ctx.fillStyle = '#ff6b6b'
		ctx.fill()
		ctx.strokeStyle = '#ff4757'
		ctx.lineWidth = 2
		ctx.stroke()
	}

	handleBallCollision(ball: { x: number; y: number; radius: number; vx: number; vy: number }): number {
		const dx = ball.x - this.x
		const dy = ball.y - this.y
		const distance = Math.sqrt(dx * dx + dy * dy)

		if (distance < ball.radius + this.radius) {
			// Collision response
			const angle = Math.atan2(dy, dx)
			ball.vx = Math.cos(angle) * 8
			ball.vy = Math.sin(angle) * 8

			// Move ball out of obstacle
			const overlap = ball.radius + this.radius - distance
			ball.x += Math.cos(angle) * overlap
			ball.y += Math.sin(angle) * overlap

			return this.points
		}
		return 0
	}
}