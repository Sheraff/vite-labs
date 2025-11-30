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
	points: Point[]
	trackWidth: number
	ballOnPath: BallOnPath | null = null

	// Segments are groups of 4 points forming cubic beziers
	private segments: Array<{ p0: Point; p1: Point; p2: Point; p3: Point }> = []

	// Cached length and lookup table for arc-length parameterization
	private length: number
	private arcLengthTable: Array<{ t: number; length: number; segment: number }> = []

	// Entrance detection thresholds
	private readonly entranceRadius: number = 15 // Leeway for entering
	private readonly captureRadius: number = 12 // Distance to actually capture ball

	constructor(points: Point[], trackWidth: number) {
		// Trim to valid point count: 4, 7, 10, 13, etc. (4 + 3n)
		let validPointCount = 0
		if (points.length >= 4) {
			if (points.length === 4) {
				validPointCount = 4
			} else {
				const extraPoints = points.length - 4
				const completeExtraSegments = Math.floor(extraPoints / 3)
				validPointCount = 4 + (completeExtraSegments * 3)
			}
		}

		// Use only valid points, ignore any extraneous ones
		this.points = validPointCount >= 4 ? points.slice(0, validPointCount) : []
		this.trackWidth = trackWidth

		// Early return if not enough points
		if (this.points.length < 4) {
			this.segments = []
			this.arcLengthTable = []
			this.length = 0
			return
		}

		// Create segments: first segment uses points[0-3], subsequent segments share endpoint
		// e.g., [p0, p1, p2, p3, p4, p5, p6] -> segments: [p0,p1,p2,p3] and [p3,p4,p5,p6]
		for (let i = 0; i < points.length - 3; i += 3) {
			this.segments.push({
				p0: points[i],
				p1: points[i + 1],
				p2: points[i + 2],
				p3: points[i + 3]
			})
		}

		// Pre-compute arc length table
		this.computeArcLengthTable()
		this.length = this.arcLengthTable[this.arcLengthTable.length - 1].length
	}

	// Cubic bezier evaluation for a specific segment
	private bezierSegment(seg: { p0: Point; p1: Point; p2: Point; p3: Point }, t: number): Point {
		const mt = 1 - t
		const mt2 = mt * mt
		const mt3 = mt2 * mt
		const t2 = t * t
		const t3 = t2 * t

		return {
			x: mt3 * seg.p0.x + 3 * mt2 * t * seg.p1.x + 3 * mt * t2 * seg.p2.x + t3 * seg.p3.x,
			y: mt3 * seg.p0.y + 3 * mt2 * t * seg.p1.y + 3 * mt * t2 * seg.p2.y + t3 * seg.p3.y
		}
	}

	// Derivative of cubic bezier (tangent) for a specific segment
	private bezierDerivativeSegment(seg: { p0: Point; p1: Point; p2: Point; p3: Point }, t: number): Point {
		const mt = 1 - t
		const mt2 = mt * mt
		const t2 = t * t

		return {
			x: 3 * mt2 * (seg.p1.x - seg.p0.x) + 6 * mt * t * (seg.p2.x - seg.p1.x) + 3 * t2 * (seg.p3.x - seg.p2.x),
			y: 3 * mt2 * (seg.p1.y - seg.p0.y) + 6 * mt * t * (seg.p2.y - seg.p1.y) + 3 * t2 * (seg.p3.y - seg.p2.y)
		}
	}

	// Get point on entire path using global t [0, 1]
	private bezier(t: number): Point {
		const segmentIndex = Math.min(Math.floor(t * this.segments.length), this.segments.length - 1)
		const segment = this.segments[segmentIndex]
		const localT = t === 1 ? 1 : (t * this.segments.length) % 1
		return this.bezierSegment(segment, localT)
	}

	// Get tangent on entire path using global t [0, 1]
	private bezierDerivative(t: number): Point {
		const segmentIndex = Math.min(Math.floor(t * this.segments.length), this.segments.length - 1)
		const segment = this.segments[segmentIndex]
		const localT = t === 1 ? 1 : (t * this.segments.length) % 1
		return this.bezierDerivativeSegment(segment, localT)
	}

	// Compute arc length lookup table
	private computeArcLengthTable() {
		const samplesPerSegment = 50
		this.arcLengthTable = []

		let totalLength = 0

		// Process each segment
		for (let segIdx = 0; segIdx < this.segments.length; segIdx++) {
			const segment = this.segments[segIdx]
			let prevPoint = this.bezierSegment(segment, 0)

			for (let i = 0; i <= samplesPerSegment; i++) {
				const localT = i / samplesPerSegment
				const globalT = (segIdx + localT) / this.segments.length
				const point = this.bezierSegment(segment, localT)

				if (i > 0) {
					const dx = point.x - prevPoint.x
					const dy = point.y - prevPoint.y
					const segmentLength = Math.sqrt(dx * dx + dy * dy)
					totalLength += segmentLength
				}

				this.arcLengthTable.push({ t: globalT, length: totalLength, segment: segIdx })
				prevPoint = point
			}
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
		const startPoint = this.points[0]
		const endPoint = this.points[this.points.length - 1]

		// Check start point
		const dx0 = ball.x - startPoint.x
		const dy0 = ball.y - startPoint.y
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

		// Check end point
		const dx3 = ball.x - endPoint.x
		const dy3 = ball.y - endPoint.y
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

		// Speed modification based on whether moving toward or away from midpoint
		// Moving toward midpoint = decelerate (going uphill)
		// Moving away from midpoint = accelerate (going downhill)
		const accelerationRate = 0.1

		const movingTowardMid = this.ballOnPath.forward
			? currentArcLength < halfLength  // forward and before mid = toward
			: currentArcLength > halfLength  // backward and after mid = toward

		if (movingTowardMid) {
			// Moving uphill: decelerate
			this.ballOnPath.speed -= accelerationRate

			// Check if ball stopped (only allow one reversal per capture)
			if (this.ballOnPath.speed <= 0 && !this.ballOnPath.hasReversed) {
				this.ballOnPath.speed = Math.abs(this.ballOnPath.speed) + 0.5 // Reverse with small boost
				this.ballOnPath.forward = !this.ballOnPath.forward
				this.ballOnPath.hasReversed = true
			}
		} else {
			// Moving downhill: accelerate
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
			const exitingFromStart = currentArcLength < 0
			const exitT = exitingFromStart ? 0 : 1
			const exitPoint = this.bezier(exitT)
			const tangent = this.bezierDerivative(exitT)
			const tangentLen = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y)

			// Set ball position at exit
			ball.x = exitPoint.x
			ball.y = exitPoint.y

			// Set ball velocity pointing AWAY from the exit point
			// At start (t=0): tangent points forward (into curve), so negate it to point away
			// At end (t=1): tangent points forward (out of curve), so keep it to point away
			const direction = exitingFromStart ? -1 : 1
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
		const samples = 100
		const halfWidth = this.trackWidth / 2

		// Draw both track lines as open paths (not closed loops)
		for (let side = -1; side <= 1; side += 2) {
			const points: Array<{ x: number; y: number }> = []

			// Calculate all offset points
			for (let i = 0; i < samples; i++) {
				const t = i / samples
				const point = this.bezier(t)
				const tangent = this.bezierDerivative(t)
				const tangentLen = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y)

				// Normal vector (perpendicular to tangent)
				const nx = -tangent.y / tangentLen
				const ny = tangent.x / tangentLen

				// Offset point by half track width
				points.push({
					x: point.x + nx * halfWidth * side,
					y: point.y + ny * halfWidth * side
				})
			}

			// Draw as a single open path
			ctx.beginPath()
			ctx.moveTo(points[0].x, points[0].y)
			for (let i = 1; i < points.length; i++) {
				ctx.lineTo(points[i].x, points[i].y)
			}

			ctx.strokeStyle = '#48dbfb'
			ctx.lineWidth = 3
			ctx.lineCap = 'round'
			ctx.lineJoin = 'round'
			ctx.stroke()
		}

		// Draw entrance indicators
		const entranceSize = 6
		const startPoint = this.points[0]
		const endPoint = this.points[this.points.length - 1]

		// Start entrance
		ctx.beginPath()
		ctx.arc(startPoint.x, startPoint.y, entranceSize, 0, Math.PI * 2)
		ctx.fillStyle = '#00d2d3'
		ctx.fill()
		ctx.strokeStyle = '#01a3a4'
		ctx.lineWidth = 2
		ctx.stroke()

		// End entrance
		ctx.beginPath()
		ctx.arc(endPoint.x, endPoint.y, entranceSize, 0, Math.PI * 2)
		ctx.fillStyle = '#00d2d3'
		ctx.fill()
		ctx.strokeStyle = '#01a3a4'
		ctx.lineWidth = 2
		ctx.stroke()

		// Draw control points (faint) for debugging - only in editor mode
		if (debugMode) {
			ctx.globalAlpha = 0.3

			// Draw control lines for each segment
			for (const seg of this.segments) {
				ctx.beginPath()
				ctx.moveTo(seg.p0.x, seg.p0.y)
				ctx.lineTo(seg.p1.x, seg.p1.y)
				ctx.strokeStyle = '#aaa'
				ctx.lineWidth = 1
				ctx.stroke()

				ctx.beginPath()
				ctx.moveTo(seg.p3.x, seg.p3.y)
				ctx.lineTo(seg.p2.x, seg.p2.y)
				ctx.stroke()
			}

			// Draw all control points
			this.points.forEach((p, i) => {
				const isEndpoint = i === 0 || i === this.points.length - 1 || i % 3 === 0
				ctx.beginPath()
				ctx.arc(p.x, p.y, isEndpoint ? 4 : 3, 0, Math.PI * 2)
				ctx.fillStyle = isEndpoint ? '#00d2d3' : '#aaa'
				ctx.fill()
			})

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
