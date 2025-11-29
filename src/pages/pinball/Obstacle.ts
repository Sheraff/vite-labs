export class Bumper {
	x: number
	y: number
	radius: number
	points: number
	hitAnimation: number = 0

	constructor(x: number, y: number, radius: number, points: number) {
		this.x = x
		this.y = y
		this.radius = radius
		this.points = points
	}

	draw(ctx: CanvasRenderingContext2D) {
		// Decrease hit animation
		if (this.hitAnimation > 0) {
			this.hitAnimation--
		}

		const scale = 1 + (this.hitAnimation / 20) * 0.3
		const alpha = 1 - (this.hitAnimation / 20) * 0.5

		ctx.save()
		ctx.translate(this.x, this.y)
		ctx.scale(scale, scale)

		ctx.beginPath()
		ctx.arc(0, 0, this.radius, 0, Math.PI * 2)
		ctx.fillStyle = this.hitAnimation > 0 ? '#ff9ff3' : '#ff6b6b'
		ctx.fill()
		ctx.strokeStyle = '#ff4757'
		ctx.lineWidth = 2
		ctx.stroke()

		// Draw glow when hit
		if (this.hitAnimation > 0) {
			ctx.beginPath()
			ctx.arc(0, 0, this.radius + 5, 0, Math.PI * 2)
			ctx.strokeStyle = `rgba(255, 159, 243, ${alpha * 0.5})`
			ctx.lineWidth = 4
			ctx.stroke()
		}

		ctx.restore()
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

			// Trigger hit animation
			this.hitAnimation = 20

			return this.points
		}
		return 0
	}
}