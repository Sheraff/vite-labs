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
			const angle = Math.atan2(dy, dx)
			
			// Move ball out of obstacle
			const overlap = ball.radius + this.radius - distance
			ball.x += Math.cos(angle) * overlap
			ball.y += Math.sin(angle) * overlap
			
			// Only apply bounce if ball is moving towards bumper
			const nx = Math.cos(angle)
			const ny = Math.sin(angle)
			const vDotN = ball.vx * nx + ball.vy * ny
			
			if (vDotN < 0) { // Moving towards bumper
				// Collision response
				ball.vx = nx * 8
				ball.vy = ny * 8

				// Trigger hit animation
				this.hitAnimation = 20

				return this.points
			}
		}
		return 0
	}
}

export class TriangularBumper {
	points: number
	hitAnimation: number = 0
	vertices: Array<{ x: number; y: number }>
	centerX: number
	centerY: number
	edgeBouncy: [boolean, boolean, boolean] // edge 0: v1->v2, edge 1: v2->v3, edge 2: v3->v1
	hitEdge: number = -1 // Track which edge was hit for animation

	constructor(
		v1: { x: number; y: number }, 
		v2: { x: number; y: number }, 
		v3: { x: number; y: number }, 
		points: number,
		edge1Bouncy: boolean = true,
		edge2Bouncy: boolean = true,
		edge3Bouncy: boolean = true
	) {
		this.vertices = [v1, v2, v3]
		this.points = points
		this.centerX = (v1.x + v2.x + v3.x) / 3
		this.centerY = (v1.y + v2.y + v3.y) / 3
		this.edgeBouncy = [edge1Bouncy, edge2Bouncy, edge3Bouncy]
	}

	draw(ctx: CanvasRenderingContext2D) {
		// Decrease hit animation
		if (this.hitAnimation > 0) {
			this.hitAnimation--
		}

		const scale = 1 + (this.hitAnimation / 20) * 0.2
		const alpha = 1 - (this.hitAnimation / 20) * 0.5

		ctx.save()
		ctx.translate(this.centerX, this.centerY)
		ctx.scale(scale, scale)
		ctx.translate(-this.centerX, -this.centerY)

		// Draw triangle fill
		ctx.beginPath()
		ctx.moveTo(this.vertices[0].x, this.vertices[0].y)
		ctx.lineTo(this.vertices[1].x, this.vertices[1].y)
		ctx.lineTo(this.vertices[2].x, this.vertices[2].y)
		ctx.closePath()
		ctx.fillStyle = this.hitAnimation > 0 ? '#ffd93d' : '#f6b93b'
		ctx.fill()

		// Draw each edge with different style based on type
		for (let i = 0; i < 3; i++) {
			const v1 = this.vertices[i]
			const v2 = this.vertices[(i + 1) % 3]
			const isBouncy = this.edgeBouncy[i]
			
			ctx.beginPath()
			ctx.moveTo(v1.x, v1.y)
			ctx.lineTo(v2.x, v2.y)
			
			if (isBouncy) {
				// Bouncy edge - bright orange
				ctx.strokeStyle = this.hitAnimation > 0 && this.hitEdge === i ? '#ffd93d' : '#e55039'
				ctx.lineWidth = 3
			} else {
				// Static edge - gray/white like walls
				ctx.strokeStyle = '#ddd'
				ctx.lineWidth = 3
			}
			ctx.stroke()

			// Draw glow when bouncy edge is hit
			if (this.hitAnimation > 0 && this.hitEdge === i && isBouncy) {
				ctx.strokeStyle = `rgba(255, 217, 61, ${alpha * 0.6})`
				ctx.lineWidth = 6
				ctx.stroke()
			}
		}

		ctx.restore()
	}

	handleBallCollision(ball: { x: number; y: number; radius: number; vx: number; vy: number }): number {
		// Check if ball's bounding box intersects with triangle's bounding box
		const minX = Math.min(this.vertices[0].x, this.vertices[1].x, this.vertices[2].x) - ball.radius
		const maxX = Math.max(this.vertices[0].x, this.vertices[1].x, this.vertices[2].x) + ball.radius
		const minY = Math.min(this.vertices[0].y, this.vertices[1].y, this.vertices[2].y) - ball.radius
		const maxY = Math.max(this.vertices[0].y, this.vertices[1].y, this.vertices[2].y) + ball.radius
		
		if (ball.x < minX || ball.x > maxX || ball.y < minY || ball.y > maxY) {
			return 0 // No collision possible
		}
		
		// Use ray casting to check if ball center is inside triangle
		// Cast a horizontal ray from ball position to the right
		let intersections = 0
		for (let i = 0; i < 3; i++) {
			const v1 = this.vertices[i]
			const v2 = this.vertices[(i + 1) % 3]
			
			// Check if ray intersects this edge
			// Edge goes from v1 to v2
			if ((v1.y > ball.y) !== (v2.y > ball.y)) {
				// Edge crosses the horizontal line at ball.y
				const intersectX = v1.x + (ball.y - v1.y) * (v2.x - v1.x) / (v2.y - v1.y)
				if (ball.x < intersectX) {
					intersections++
				}
			}
		}
		
		const isInside = (intersections % 2) === 1

		// Check each edge of the triangle
		let closestPoint = { x: ball.x, y: ball.y }
		let minDist = Infinity
		let closestEdge = -1

		// Check both current and previous ball position for swept collision
		const prevBallX = ball.x - ball.vx
		const prevBallY = ball.y - ball.vy
		
		for (let i = 0; i < 3; i++) {
			const v1 = this.vertices[i]
			const v2 = this.vertices[(i + 1) % 3]

			// Find closest point on this edge for current position
			const edgeX = v2.x - v1.x
			const edgeY = v2.y - v1.y
			const edgeLenSq = edgeX * edgeX + edgeY * edgeY
			
			// Check current position
			const ballX = ball.x - v1.x
			const ballY = ball.y - v1.y
			let t = (ballX * edgeX + ballY * edgeY) / edgeLenSq
			t = Math.max(0, Math.min(1, t))
			const pointX = v1.x + t * edgeX
			const pointY = v1.y + t * edgeY
			const distX = ball.x - pointX
			const distY = ball.y - pointY
			const dist = Math.sqrt(distX * distX + distY * distY)
			
			// Check previous position
			const prevBallXrel = prevBallX - v1.x
			const prevBallYrel = prevBallY - v1.y
			let tPrev = (prevBallXrel * edgeX + prevBallYrel * edgeY) / edgeLenSq
			tPrev = Math.max(0, Math.min(1, tPrev))
			const prevPointX = v1.x + tPrev * edgeX
			const prevPointY = v1.y + tPrev * edgeY
			const prevDistX = prevBallX - prevPointX
			const prevDistY = prevBallY - prevPointY
			const prevDist = Math.sqrt(prevDistX * prevDistX + prevDistY * prevDistY)
			
			// Use whichever is closer
			const useDist = Math.min(dist, prevDist)

			if (useDist < minDist) {
				minDist = useDist
				closestPoint = { x: pointX, y: pointY }
				closestEdge = i
			}
		}

		// If ball is inside triangle, push it out forcefully
		if (isInside) {
			if (closestEdge < 0) return 0
			
			const dx = ball.x - closestPoint.x
			const dy = ball.y - closestPoint.y
			const dist = Math.sqrt(dx * dx + dy * dy)

			if (dist === 0) {
				// Ball is exactly on the edge point, push away from triangle center
				const centerX = (this.vertices[0].x + this.vertices[1].x + this.vertices[2].x) / 3
				const centerY = (this.vertices[0].y + this.vertices[1].y + this.vertices[2].y) / 3
				const toCenterX = ball.x - centerX
				const toCenterY = ball.y - centerY
				const toCenterDist = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY)
				if (toCenterDist > 0) {
					const escapeDir = 1 / toCenterDist
					ball.x = centerX + toCenterX * escapeDir * (toCenterDist + ball.radius * 2)
					ball.y = centerY + toCenterY * escapeDir * (toCenterDist + ball.radius * 2)
					// Add velocity away from center
					ball.vx = toCenterX * escapeDir * 3
					ball.vy = toCenterY * escapeDir * 3
				}
				return 0
			}

			const nx = dx / dist
			const ny = dy / dist

			// Place ball exactly ball.radius distance away from the closest point on edge
			ball.x = closestPoint.x + nx * (ball.radius + 2)
			ball.y = closestPoint.y + ny * (ball.radius + 2)
			
			// Add velocity to push ball away from the triangle to help it escape
			const escapeSpeed = 2
			ball.vx += nx * escapeSpeed
			ball.vy += ny * escapeSpeed
			
			// Don't apply bounce when forcing ball out from inside
			return 0
		}
		
		// Ball is outside but close enough to collide
		if (minDist < ball.radius) {
			if (closestEdge < 0) return 0
			
			const dx = ball.x - closestPoint.x
			const dy = ball.y - closestPoint.y
			const dist = Math.sqrt(dx * dx + dy * dy)
			
			if (dist === 0) return 0
			
			const nx = dx / dist
			const ny = dy / dist

			// Move ball out to proper distance
			const pushDist = ball.radius - minDist + 1
			ball.x += nx * pushDist
			ball.y += ny * pushDist

			const isBouncy = this.edgeBouncy[closestEdge]
			
			// Only apply bounce if ball is moving towards the surface (not away from it)
			const vDotN = ball.vx * nx + ball.vy * ny
			
			if (vDotN < 0) { // Ball is moving towards surface
				if (isBouncy) {
					// Bouncy edge - strong reflection with boost
					ball.vx -= 2 * vDotN * nx * 1.0
					ball.vy -= 2 * vDotN * ny * 1.0

					// Trigger hit animation
					this.hitAnimation = 20
					this.hitEdge = closestEdge

					return this.points
				} else {
					// Static edge - normal reflection like a wall
					ball.vx -= 2 * vDotN * nx * 0.8 // 0.8 = bounce damping like walls
					ball.vy -= 2 * vDotN * ny * 0.8

					// No animation or points for static walls
					return 0
				}
			}
		}

		return 0
	}
}