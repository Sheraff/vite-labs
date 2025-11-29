export class Flipper {
	x: number
	y: number
	length: number
	width: number
	angle: number
	targetAngle: number
	side: 'left' | 'right'
	angularSpeed: number = 0.3
	maxRotation: number = Math.PI / 4

	constructor(x: number, y: number, side: 'left' | 'right', length: number = 80, width: number = 15) {
		this.x = x
		this.y = y
		this.side = side
		this.length = length
		this.width = width
		this.angle = 0
		this.targetAngle = 0

		// Set initial resting angle
		// Left flipper (pivot left) points right. Resting should be slightly down (positive angle)
		// Right flipper (pivot right) points left. Resting should be slightly down (negative angle relative to pointing left?)

		// Let's define angle 0 as horizontal.
		// Left flipper: 0 is pointing right. +angle is clockwise (down).
		// Right flipper: 0 is pointing left. +angle is clockwise (up? no).

		// Let's stick to standard canvas rotation.
		// Left flipper: Pivot at (x,y). Drawn from (0,0) to (length, 0).
		// Resting angle: 30 degrees (Math.PI/6).
		// Active angle: -30 degrees (-Math.PI/6).

		// Right flipper: Pivot at (x,y). Drawn from (0,0) to (-length, 0).
		// Resting angle: -30 degrees (-Math.PI/6) ? No.
		// If drawn to (-length, 0), it points left.
		// Rotation is clockwise.
		// To point down, we need negative rotation? No, positive rotation rotates the whole system clockwise.
		// If it points left (negative x), rotating clockwise (positive angle) moves the tip UP.
		// So we need negative angle to move tip DOWN.

		if (this.side === 'left') {
			this.angle = Math.PI / 6
			this.targetAngle = Math.PI / 6
		} else {
			this.angle = -Math.PI / 6
			this.targetAngle = -Math.PI / 6
		}
	}

	update() {
		this.angle += (this.targetAngle - this.angle) * this.angularSpeed
	}

	flipUp() {
		if (this.side === 'left') {
			this.targetAngle = -Math.PI / 6
		} else {
			this.targetAngle = Math.PI / 6
		}
	}

	flipDown() {
		if (this.side === 'left') {
			this.targetAngle = Math.PI / 6
		} else {
			this.targetAngle = -Math.PI / 6
		}
	}

	checkCollision(ball: { x: number, y: number, radius: number, vx: number, vy: number }) {
		// Calculate flipper vector
		const cos = Math.cos(this.angle)
		const sin = Math.sin(this.angle)

		let p1x = this.x
		let p1y = this.y
		let p2x, p2y

		if (this.side === 'left') {
			p2x = this.x + cos * this.length
			p2y = this.y + sin * this.length
		} else {
			p2x = this.x - cos * this.length
			p2y = this.y - sin * this.length
		}

		// Closest point on segment to ball
		const dx = p2x - p1x
		const dy = p2y - p1y
		const lenSq = dx * dx + dy * dy

		let t = ((ball.x - p1x) * dx + (ball.y - p1y) * dy) / lenSq
		t = Math.max(0, Math.min(1, t))

		const closestX = p1x + t * dx
		const closestY = p1y + t * dy

		const distX = ball.x - closestX
		const distY = ball.y - closestY
		const distSq = distX * distX + distY * distY

		const minDist = ball.radius + this.width / 2

		if (distSq < minDist * minDist) {
			// Collision!
			const dist = Math.sqrt(distSq)
			if (dist === 0) return

			const nx = distX / dist
			const ny = distY / dist

			// Move ball out
			const overlap = minDist - dist
			ball.x += nx * overlap
			ball.y += ny * overlap

			// Reflect velocity
			const vDotN = ball.vx * nx + ball.vy * ny
			ball.vx -= 2 * vDotN * nx
			ball.vy -= 2 * vDotN * ny

			// Add flipper kick
			const angularVel = (this.targetAngle - this.angle) * this.angularSpeed

			// Flipper velocity vector at closest point
			// V = omega x R
			// R = (closestX - this.x, closestY - this.y)
			// V_x = -omega * R_y
			// V_y = omega * R_x

			const fvx = -angularVel * (closestY - this.y)
			const fvy = angularVel * (closestX - this.x)

			const vRel = fvx * nx + fvy * ny

			if (vRel > 0) {
				ball.vx += nx * vRel * 1.5
				ball.vy += ny * vRel * 1.5
			}

			// Add some elasticity
			ball.vx *= 0.95
			ball.vy *= 0.95
		}
	}

	draw(ctx: CanvasRenderingContext2D) {
		ctx.save()
		ctx.translate(this.x, this.y)
		ctx.rotate(this.angle)

		ctx.fillStyle = '#48dbfb'
		ctx.strokeStyle = '#0abde3'
		ctx.lineWidth = 2

		if (this.side === 'left') {
			// Pivot is left, points right
			ctx.fillRect(0, -this.width / 2, this.length, this.width)
			ctx.strokeRect(0, -this.width / 2, this.length, this.width)

			// Draw pivot
			ctx.beginPath()
			ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2)
			ctx.fill()
			ctx.stroke()

			// Draw tip
			ctx.beginPath()
			ctx.arc(this.length, 0, this.width / 2, 0, Math.PI * 2)
			ctx.fill()
			ctx.stroke()
		} else {
			// Pivot is right, points left
			ctx.fillRect(-this.length, -this.width / 2, this.length, this.width)
			ctx.strokeRect(-this.length, -this.width / 2, this.length, this.width)

			// Draw pivot
			ctx.beginPath()
			ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2)
			ctx.fill()
			ctx.stroke()

			// Draw tip
			ctx.beginPath()
			ctx.arc(-this.length, 0, this.width / 2, 0, Math.PI * 2)
			ctx.fill()
			ctx.stroke()
		}

		ctx.restore()
	}
}
