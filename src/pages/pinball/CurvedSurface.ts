

export class CurvedSurface {
	center: { x: number; y: number }
	radius: number
	startAngle: number
	endAngle: number
	thickness: number
	innerRadius: number
	outerRadius: number
	constructor(centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number, thickness = 10) {
		this.center = { x: centerX, y: centerY }
		this.radius = radius
		this.startAngle = startAngle
		this.endAngle = endAngle
		this.thickness = thickness
		this.innerRadius = radius - thickness / 2
		this.outerRadius = radius + thickness / 2
	}

	checkBallCollision(ball: { x: number; y: number; radius: number }) {
		const dx = ball.x - this.center.x
		const dy = ball.y - this.center.y
		const distance = Math.sqrt(dx * dx + dy * dy)
		const angle = Math.atan2(dy, dx)

		// Normalize angle to 0-2π
		let normalizedAngle = angle
		if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI

		// Check if within angular range
		let startAngle = this.startAngle
		let endAngle = this.endAngle
		if (startAngle < 0) startAngle += 2 * Math.PI
		if (endAngle < 0) endAngle += 2 * Math.PI

		const withinAngle = (startAngle <= endAngle) ?
			(normalizedAngle >= startAngle && normalizedAngle <= endAngle) :
			(normalizedAngle >= startAngle || normalizedAngle <= endAngle)

		if (!withinAngle) return { collision: false } as const

		// Check distance collision
		const minDist = this.innerRadius - ball.radius
		const maxDist = this.outerRadius + ball.radius

		if (distance >= minDist && distance <= maxDist) {
			// Determine which surface (inner or outer)
			const distToInner = Math.abs(distance - this.innerRadius)
			const distToOuter = Math.abs(distance - this.outerRadius)

			const isInnerSurface = distToInner < distToOuter
			const targetRadius = isInnerSurface ? this.innerRadius : this.outerRadius
			const normalDirection = isInnerSurface ? -1 : 1

			return {
				collision: true,
				normal: {
					x: (dx / distance) * normalDirection,
					y: (dy / distance) * normalDirection
				},
				targetRadius,
				distance
			} as const
		}

		return { collision: false } as const
	}

	handleBallCollision(ball: { x: number; y: number; radius: number; vx: number; vy: number }) {
		const collision = this.checkBallCollision(ball)
		if (!collision.collision) return

		// Position correction
		const targetDistance = collision.targetRadius + ball.radius
		const currentDistance = Math.sqrt(
			Math.pow(ball.x - this.center.x, 2) +
			Math.pow(ball.y - this.center.y, 2)
		)

		const correctionFactor = targetDistance / currentDistance
		ball.x = this.center.x + (ball.x - this.center.x) * correctionFactor
		ball.y = this.center.y + (ball.y - this.center.y) * correctionFactor

		// Velocity reflection
		const dotProduct = ball.vx * collision.normal.x + ball.vy * collision.normal.y
		ball.vx -= 2 * dotProduct * collision.normal.x * 0.9
		ball.vy -= 2 * dotProduct * collision.normal.y * 0.9

		// Add some curve momentum
		const tangent = { x: -collision.normal.y, y: collision.normal.x }
		const tangentSpeed = ball.vx * tangent.x + ball.vy * tangent.y
		ball.vx += tangent.x * tangentSpeed * 0.1
		ball.vy += tangent.y * tangentSpeed * 0.1
	}

	draw(ctx: CanvasRenderingContext2D) {
		// Draw the curved surface
		ctx.beginPath()
		ctx.arc(this.center.x, this.center.y, this.radius, this.startAngle, this.endAngle)
		ctx.strokeStyle = '#48dbfb'
		ctx.lineWidth = this.thickness
		ctx.lineCap = 'round'
		ctx.stroke()

		// Add inner highlight
		ctx.beginPath()
		ctx.arc(this.center.x, this.center.y, this.radius - this.thickness / 4,
			this.startAngle, this.endAngle)
		ctx.strokeStyle = '#fff'
		ctx.lineWidth = 2
		ctx.stroke()
	}
}