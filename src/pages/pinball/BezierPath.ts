type Point = { x: number; y: number }

interface Ball {
	x: number
	y: number
	radius: number
	vx: number
	vy: number
}

interface BallOnPath {
	t: number // Position along curve [0, 1]
	speed: number // Speed along the curve
	forward: boolean // Direction: true = p0 to p3, false = p3 to p0
	hasReversed: boolean // Track if ball has already reversed once
}

export class BezierPath {
	p0: Point
	p1: Point
	p2: Point
	p3: Point
	trackWidth: number
	ballOnPath: BallOnPath | null = null
	
	// Cached length and lookup table for arc-length parameterization
	private length: number
	private arcLengthTable: Array<{ t: number; length: number }> = []
	
	// Entrance detection thresholds
	private readonly entranceRadius: number = 15 // Leeway for entering
	private readonly captureRadius: number = 12 // Distance to actually capture ball
	
	constructor(p0: Point, p1: Point, p2: Point, p3: Point, trackWidth: number) {
		this.p0 = p0
		this.p1 = p1
		this.p2 = p2
		this.p3 = p3
		this.trackWidth = trackWidth
		
		// Pre-compute arc length table
		this.computeArcLengthTable()
		this.length = this.arcLengthTable[this.arcLengthTable.length - 1].length
	}

	// Cubic bezier evaluation
	private bezier(t: number): Point {
		const mt = 1 - t
		const mt2 = mt * mt
		const mt3 = mt2 * mt
		const t2 = t * t
		const t3 = t2 * t
		
		return {
			x: mt3 * this.p0.x + 3 * mt2 * t * this.p1.x + 3 * mt * t2 * this.p2.x + t3 * this.p3.x,
			y: mt3 * this.p0.y + 3 * mt2 * t * this.p1.y + 3 * mt * t2 * this.p2.y + t3 * this.p3.y
		}
	}

	// Derivative of cubic bezier (tangent)
	private bezierDerivative(t: number): Point {
		const mt = 1 - t
		const mt2 = mt * mt
		const t2 = t * t
		
		return {
			x: 3 * mt2 * (this.p1.x - this.p0.x) + 6 * mt * t * (this.p2.x - this.p1.x) + 3 * t2 * (this.p3.x - this.p2.x),
			y: 3 * mt2 * (this.p1.y - this.p0.y) + 6 * mt * t * (this.p2.y - this.p1.y) + 3 * t2 * (this.p3.y - this.p2.y)
		}
	}

	// Compute arc length lookup table
	private computeArcLengthTable() {
		const samples = 100
		this.arcLengthTable = [{ t: 0, length: 0 }]
		
		let totalLength = 0
		let prevPoint = this.bezier(0)
		
		for (let i = 1; i <= samples; i++) {
			const t = i / samples
			const point = this.bezier(t)
			const dx = point.x - prevPoint.x
			const dy = point.y - prevPoint.y
			const segmentLength = Math.sqrt(dx * dx + dy * dy)
			totalLength += segmentLength
			this.arcLengthTable.push({ t, length: totalLength })
			prevPoint = point
		}
	}

	// Convert arc length to parametric t
	private arcLengthToT(arcLength: number): number {
		if (arcLength <= 0) return 0
		if (arcLength >= this.length) return 1
		
		// Binary search in lookup table
		let low = 0
		let high = this.arcLengthTable.length - 1
		
		while (low < high - 1) {
			const mid = Math.floor((low + high) / 2)
			if (this.arcLengthTable[mid].length < arcLength) {
				low = mid
			} else {
				high = mid
			}
		}
		
		// Linear interpolation
		const entry1 = this.arcLengthTable[low]
		const entry2 = this.arcLengthTable[high]
		const segmentLength = entry2.length - entry1.length
		const segmentProgress = (arcLength - entry1.length) / segmentLength
		
		return entry1.t + (entry2.t - entry1.t) * segmentProgress
	}

	// Check if ball is near an entrance
	private checkEntrance(ball: Ball): { enter: boolean; t: number; forward: boolean } | null {
		// Check start point (p0)
		const dx0 = ball.x - this.p0.x
		const dy0 = ball.y - this.p0.y
		const dist0 = Math.sqrt(dx0 * dx0 + dy0 * dy0)
		
		if (dist0 < this.entranceRadius + ball.radius) {
			// Check if ball is moving toward the curve
			const tangent = this.bezierDerivative(0)
			const tangentLen = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y)
			const tangentNorm = { x: tangent.x / tangentLen, y: tangent.y / tangentLen }
			
			// Dot product of ball velocity with curve tangent
			const dot = ball.vx * tangentNorm.x + ball.vy * tangentNorm.y
			
			// Only capture if moving along the curve direction and close enough
			if (dot > 0 && dist0 < this.captureRadius + ball.radius) {
				return { enter: true, t: 0, forward: true }
			}
		}
		
		// Check end point (p3)
		const dx3 = ball.x - this.p3.x
		const dy3 = ball.y - this.p3.y
		const dist3 = Math.sqrt(dx3 * dx3 + dy3 * dy3)
		
		if (dist3 < this.entranceRadius + ball.radius) {
			// Check if ball is moving toward the curve
			const tangent = this.bezierDerivative(1)
			const tangentLen = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y)
			const tangentNorm = { x: -tangent.x / tangentLen, y: -tangent.y / tangentLen }
			
			// Dot product of ball velocity with reverse tangent
			const dot = ball.vx * tangentNorm.x + ball.vy * tangentNorm.y
			
			// Only capture if moving along the curve direction and close enough
			if (dot > 0 && dist3 < this.captureRadius + ball.radius) {
				return { enter: true, t: 1, forward: false }
			}
		}
		
		return null
	}

	checkBallCollision(ball: Ball): boolean {
		// If ball is already on path, keep it there
		if (this.ballOnPath) {
			return true
		}
		
		// Check if ball is entering
		const entrance = this.checkEntrance(ball)
		if (entrance && entrance.enter) {
			// Capture the ball
			const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy)
			this.ballOnPath = {
				t: entrance.t,
				speed: Math.max(speed, 2), // Minimum speed
				forward: entrance.forward,
				hasReversed: false
			}
			return true
		}
		
		return false
	}

	handleBallCollision(ball: Ball) {
		if (!this.ballOnPath) return
		
		const halfLength = this.length / 2
		
		// Convert t to arc length
		let currentArcLength = this.ballOnPath.t * this.length
		
		// Determine distance from midpoint
		const distFromMid = Math.abs(currentArcLength - halfLength)
		
		// Speed modification:
		// - Before midpoint: lose speed (deceleration)
		// - After midpoint: gain speed (acceleration)
		const accelerationRate = 0.2
		
		if (currentArcLength < halfLength) {
			// Before midpoint: decelerate
			this.ballOnPath.speed -= accelerationRate
			
			// Check if ball stopped (only allow one reversal per capture)
			if (this.ballOnPath.speed <= 0 && !this.ballOnPath.hasReversed) {
				this.ballOnPath.speed = Math.abs(this.ballOnPath.speed) + 0.5 // Reverse with small boost
				this.ballOnPath.forward = !this.ballOnPath.forward
				this.ballOnPath.hasReversed = true
			}
		} else {
			// After midpoint: accelerate
			this.ballOnPath.speed += accelerationRate
			this.ballOnPath.speed = Math.min(this.ballOnPath.speed, 12) // Cap speed
		}
		
		// Update position along curve
		if (this.ballOnPath.forward) {
			currentArcLength += this.ballOnPath.speed
		} else {
			currentArcLength -= this.ballOnPath.speed
		}
		
		// Check if ball exited
		if (currentArcLength < 0 || currentArcLength > this.length) {
			// Ball exits the path
			const exitT = currentArcLength < 0 ? 0 : 1
			const exitPoint = this.bezier(exitT)
			const tangent = this.bezierDerivative(exitT)
			const tangentLen = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y)
			
			// Set ball position at exit
			ball.x = exitPoint.x
			ball.y = exitPoint.y
			
			// Set ball velocity along tangent
			const direction = this.ballOnPath.forward ? 1 : -1
			ball.vx = (tangent.x / tangentLen) * this.ballOnPath.speed * direction
			ball.vy = (tangent.y / tangentLen) * this.ballOnPath.speed * direction
			
			// Release ball from path
			this.ballOnPath = null
			return
		}
		
		// Update t from arc length
		this.ballOnPath.t = currentArcLength / this.length
		
		// Update ball position
		const point = this.bezier(this.ballOnPath.t)
		ball.x = point.x
		ball.y = point.y
		
		// Zero out ball velocity while on path (not affected by anything else)
		ball.vx = 0
		ball.vy = 0
	}

	// Draw the bezier path with two parallel lines like train tracks
	draw(ctx: CanvasRenderingContext2D, debugMode: boolean = false) {
		const samples = 50
		const halfWidth = this.trackWidth / 2
		
		// Draw both track lines
		for (let side = -1; side <= 1; side += 2) {
			ctx.beginPath()
			
			for (let i = 0; i <= samples; i++) {
				const t = i / samples
				const point = this.bezier(t)
				const tangent = this.bezierDerivative(t)
				const tangentLen = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y)
				
				// Normal vector (perpendicular to tangent)
				const nx = -tangent.y / tangentLen
				const ny = tangent.x / tangentLen
				
				// Offset point by half track width
				const offsetX = point.x + nx * halfWidth * side
				const offsetY = point.y + ny * halfWidth * side
				
				if (i === 0) {
					ctx.moveTo(offsetX, offsetY)
				} else {
					ctx.lineTo(offsetX, offsetY)
				}
			}
			
			ctx.strokeStyle = '#48dbfb'
			ctx.lineWidth = 3
			ctx.lineCap = 'round'
			ctx.lineJoin = 'round'
			ctx.stroke()
		}
		
		// Draw entrance indicators
		const entranceSize = 6
		
		// Start entrance (p0)
		ctx.beginPath()
		ctx.arc(this.p0.x, this.p0.y, entranceSize, 0, Math.PI * 2)
		ctx.fillStyle = '#00d2d3'
		ctx.fill()
		ctx.strokeStyle = '#01a3a4'
		ctx.lineWidth = 2
		ctx.stroke()
		
		// End entrance (p3)
		ctx.beginPath()
		ctx.arc(this.p3.x, this.p3.y, entranceSize, 0, Math.PI * 2)
		ctx.fillStyle = '#00d2d3'
		ctx.fill()
		ctx.strokeStyle = '#01a3a4'
		ctx.lineWidth = 2
		ctx.stroke()
		
		// Draw control points (faint) for debugging - only in editor mode
		if (debugMode) {
			ctx.globalAlpha = 0.3
			ctx.beginPath()
			ctx.moveTo(this.p0.x, this.p0.y)
			ctx.lineTo(this.p1.x, this.p1.y)
			ctx.strokeStyle = '#aaa'
			ctx.lineWidth = 1
			ctx.stroke()
			
			ctx.beginPath()
			ctx.moveTo(this.p3.x, this.p3.y)
			ctx.lineTo(this.p2.x, this.p2.y)
			ctx.stroke()
			
			ctx.beginPath()
			ctx.arc(this.p1.x, this.p1.y, 3, 0, Math.PI * 2)
			ctx.fillStyle = '#aaa'
			ctx.fill()
			
			ctx.beginPath()
			ctx.arc(this.p2.x, this.p2.y, 3, 0, Math.PI * 2)
			ctx.fill()
			
			ctx.globalAlpha = 1
		}
		
		// Visualize ball on path
		if (this.ballOnPath) {
			const point = this.bezier(this.ballOnPath.t)
			ctx.beginPath()
			ctx.arc(point.x, point.y, 4, 0, Math.PI * 2)
			ctx.fillStyle = '#ff6b6b'
			ctx.fill()
			
			// Draw direction arrow
			const tangent = this.bezierDerivative(this.ballOnPath.t)
			const tangentLen = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y)
			const direction = this.ballOnPath.forward ? 1 : -1
			const arrowLen = 15
			
			ctx.beginPath()
			ctx.moveTo(point.x, point.y)
			ctx.lineTo(
				point.x + (tangent.x / tangentLen) * arrowLen * direction,
				point.y + (tangent.y / tangentLen) * arrowLen * direction
			)
			ctx.strokeStyle = '#ff6b6b'
			ctx.lineWidth = 2
			ctx.stroke()
		}
	}
}
