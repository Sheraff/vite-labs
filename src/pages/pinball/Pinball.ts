import { CurvedSurface } from "./CurvedSurface"
import { Rail } from "./Rail"
import { SmoothPath } from "./SmoothPath"
import { BezierPath } from "./BezierPath"
import { Bumper, TriangularBumper } from "./Obstacle"
import { Flipper } from "./Flipper"
import type { BoardConfig } from "./types"

export class PinballGame {
	canvas: HTMLCanvasElement
	ctx: CanvasRenderingContext2D
	width: number
	height: number
	ball: {
		x: number
		y: number
		radius: number
		vx: number
		vy: number
		gravity: number
		bounce: number
	}
	flippers: {
		left: Flipper[]
		right: Flipper[]
	}

	obstacles: Array<Bumper | TriangularBumper>
	rails: Array<Rail>
	curves: Array<CurvedSurface>
	smoothPaths: Array<SmoothPath>
	bezierPaths: Array<BezierPath>

	score: number
	lives: number = 3
	launching: boolean = false
	launchPower: number = 0
	maxLaunchPower: number = 30
	launchLaneWidth: number = 40
	gameOver: boolean = false

	// Visual effects
	scorePopups: Array<{ x: number; y: number; score: number; life: number; maxLife: number }> = []
	ballTrail: Array<{ x: number; y: number; life: number }> = []

	cleanup = new Set<() => void>()
	rafId: number | null = null

	constructor({ canvas, config, width, height }: { canvas: HTMLCanvasElement; config?: BoardConfig, width: number; height: number }) {
		this.canvas = canvas
		this.ctx = this.canvas.getContext('2d')!
		this.width = width
		this.height = height

		// Calculate scale to map game coordinates to canvas
		// Canvas is already sized with devicePixelRatio, so we scale to match
		const scaleX = this.canvas.width / this.width
		const scaleY = this.canvas.height / this.height
		this.ctx.scale(scaleX, scaleY)

		this.ball = {
			x: this.width - 20,
			y: this.height - 50,
			radius: 8,
			vx: 0,
			vy: 0,
			gravity: 0.2,
			bounce: 0.7
		}

		// Load from config or use defaults
		if (config) {
			const leftFlippers = config.flippers.filter(f => f.side === 'left')
			const rightFlippers = config.flippers.filter(f => f.side === 'right')

			this.flippers = {
				left: leftFlippers.length > 0
					? leftFlippers.map(f => new Flipper(f.x, f.y, 'left', f.length, f.width))
					: [new Flipper(120, this.height - 80, 'left', 70)],
				right: rightFlippers.length > 0
					? rightFlippers.map(f => new Flipper(f.x, f.y, 'right', f.length, f.width))
					: [new Flipper(280, this.height - 80, 'right', 70)]
			}

			this.obstacles = [
				...config.bumpers.map(b => new Bumper(b.x, b.y, b.radius, b.points)),
				...config.triangularBumpers.map(t => new TriangularBumper(
					t.v1, t.v2, t.v3, t.points,
					t.edge1Bouncy, t.edge2Bouncy, t.edge3Bouncy
				))
			]

			this.rails = [
				...config.rails.map(r => new Rail(r.x1, r.y1, r.x2, r.y2, r.radius)),
				// Always include launch lane wall
				new Rail(this.width - this.launchLaneWidth, this.height, this.width - this.launchLaneWidth, 80, 5)
			]

			this.curves = config.curves.map(c =>
				new CurvedSurface(c.x, c.y, c.radius, c.startAngle, c.endAngle, c.thickness)
			)

			this.smoothPaths = []

			this.bezierPaths = config.bezierPaths?.map(b =>
				new BezierPath(b.points, b.trackWidth)
			) || []
		} else {
			// Default layout
			this.flippers = {
				left: [new Flipper(120, this.height - 80, 'left', 70)],
				right: [new Flipper(280, this.height - 80, 'right', 70)]
			}

			this.obstacles = [
				new Bumper(100, 180, 20, 100),
				new Bumper(300, 180, 20, 100),
				new Bumper(200, 120, 18, 200),
				new Bumper(140, 280, 25, 150),
				new Bumper(260, 280, 25, 150),
				new Bumper(200, 360, 22, 175),
				// Triangular bumpers above flippers
				new TriangularBumper(
					{ x: 90, y: this.height - 150 - 15.6 },
					{ x: 75, y: this.height - 150 + 10.4 },
					{ x: 105, y: this.height - 150 + 10.4 },
					250,
					true, true, true // all edges bouncy
				),
				new TriangularBumper(
					{ x: 310, y: this.height - 150 - 15.6 },
					{ x: 295, y: this.height - 150 + 10.4 },
					{ x: 325, y: this.height - 150 + 10.4 },
					250,
					true, true, true // all edges bouncy
				)
			]

			this.rails = [
				new Rail(50, 150, 150, 200, 12),
				new Rail(250, 200, 350, 150, 12),
				// Launch lane wall
				new Rail(this.width - this.launchLaneWidth, this.height, this.width - this.launchLaneWidth, 80, 5)
			]

			this.curves = [
				new CurvedSurface(200, 100, 60, -Math.PI, 0, 15), // Half circle at top
				new CurvedSurface(100, 420, 40, Math.PI / 4, 3 * Math.PI / 4, 10),
				new CurvedSurface(300, 420, 40, Math.PI / 4, 3 * Math.PI / 4, 10),
				// Top right curve to guide ball from launch lane
				new CurvedSurface(this.width - 40, 40, 40, -Math.PI / 2, 0, 10),
				// Inlane guides - direct ball to flippers
				new CurvedSurface(75, this.height - 140, 40, -Math.PI / 2, Math.PI / 8, 8),
				new CurvedSurface(this.width - this.launchLaneWidth - 75, this.height - 140, 40, Math.PI - Math.PI / 8, Math.PI / 2, 8)
			]

			this.smoothPaths = []

			this.bezierPaths = []
		}

		this.score = 0
		this.setupControls()
		this.gameLoop()
		this.cleanup.add(() => cancelAnimationFrame(this.rafId!))
	}

	destroy() {
		this.cleanup.forEach(fn => fn())
	}

	setupControls() {
		const controller = new AbortController()
		document.addEventListener('keydown', (e) => {
			if (e.key === 'ArrowLeft' || e.key === 'a') {
				this.flippers.left.forEach(f => f.flipUp())
			}
			if (e.key === 'ArrowRight' || e.key === 'd') {
				this.flippers.right.forEach(f => f.flipUp())
			}
			if (e.key === ' ') {
				e.preventDefault()
				if (this.ball.x >= this.width - this.launchLaneWidth && this.ball.y > this.height - 100) {
					this.launching = true
				}
			}
		}, { signal: controller.signal })

		document.addEventListener('keyup', (e) => {
			if (e.key === 'ArrowLeft' || e.key === 'a') {
				this.flippers.left.forEach(f => f.flipDown())
			}
			if (e.key === 'ArrowRight' || e.key === 'd') {
				this.flippers.right.forEach(f => f.flipDown())
			}
			if (e.key === ' ') {
				if (this.launching) {
					this.launching = false
					this.launchBall()
				}
			}
			if (e.key === 'r' && this.gameOver) {
				this.restart()
			}
		}, { signal: controller.signal })

		this.cleanup.add(() => controller.abort())
	}

	launchBall() {
		const inLaunchLane = this.ball.x >= this.width - this.launchLaneWidth
		if (inLaunchLane && this.ball.y > this.height - 150) {
			this.ball.vy = -this.launchPower
			this.ball.vx = 0
			this.launchPower = 0
		}
	}

	updateBall() {
		// Check if ball is on a bezier path - if so, skip normal physics
		let onBezierPath = false
		for (const bezierPath of this.bezierPaths) {
			if (bezierPath.checkBallCollision(this.ball)) {
				bezierPath.handleBallCollision(this.ball)
				onBezierPath = true
				break
			}
		}

		// If on bezier path, skip all other physics and collisions
		if (onBezierPath) {
			// Add trail
			this.ballTrail.push({ x: this.ball.x, y: this.ball.y, life: 10 })
			this.ballTrail = this.ballTrail.filter(t => {
				t.life--
				return t.life > 0
			}).slice(-15)
			return
		}

		// Apply gravity
		this.ball.vy += this.ball.gravity

		// Apply air resistance/damping
		this.ball.vx *= 0.995
		this.ball.vy *= 0.998

		// Sub-step physics to prevent tunneling at high speeds
		const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy)
		const substeps = Math.max(1, Math.ceil(speed / 5)) // More steps for faster balls
		const subVx = this.ball.vx / substeps
		const subVy = this.ball.vy / substeps

		for (let step = 0; step < substeps; step++) {
			// Update position in small increments
			this.ball.x += subVx
			this.ball.y += subVy

			// Check collisions after each substep
			this.checkCollisionsSubstep()
		}

		// Flipper collisions (outside substep loop - they have swept collision built in)
		this.flippers.left.forEach(flipper => flipper.checkCollision(this.ball))
		this.flippers.right.forEach(flipper => flipper.checkCollision(this.ball))

		// Clamp maximum velocity as a safety measure
		const maxSpeed = 25
		const finalSpeed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy)
		if (finalSpeed > maxSpeed) {
			const scale = maxSpeed / finalSpeed
			this.ball.vx *= scale
			this.ball.vy *= scale
		}

		// Handle walls and boundaries after sub-stepping

		// Left wall
		if (this.ball.x - this.ball.radius <= 0) {
			this.ball.vx = Math.abs(this.ball.vx) * this.ball.bounce
			this.ball.x = this.ball.radius
		}

		// Right wall - keep ball in bounds
		if (this.ball.x + this.ball.radius >= this.width) {
			this.ball.vx = -Math.abs(this.ball.vx) * this.ball.bounce
			this.ball.x = this.width - this.ball.radius
		}

		// Top wall
		if (this.ball.y - this.ball.radius <= 0) {
			this.ball.vy = Math.abs(this.ball.vy) * this.ball.bounce
			this.ball.y = this.ball.radius
		}

		// Launch lane floor - ball bounces at bottom of launch lane
		const inLaunchLane = this.ball.x >= this.width - this.launchLaneWidth
		if (inLaunchLane && this.ball.y + this.ball.radius >= this.height) {
			this.ball.vy = -Math.abs(this.ball.vy) * this.ball.bounce
			this.ball.y = this.height - this.ball.radius
		}

		// Bottom boundary (drain) - only if not in launch lane
		if (this.ball.y > this.height + 20 && !inLaunchLane) {
			this.lives--
			if (this.lives <= 0) {
				this.gameOver = true
			}
			this.resetBall()
		}



		// Add trail
		this.ballTrail.push({ x: this.ball.x, y: this.ball.y, life: 10 })
		this.ballTrail = this.ballTrail.filter(t => {
			t.life--
			return t.life > 0
		}).slice(-15) // Keep only last 15 trail points
	}

	checkCollisionsSubstep() {
		// Check obstacle collisions
		this.obstacles.forEach(obstacle => {
			const points = obstacle.handleBallCollision(this.ball)
			if (points > 0) {
				this.score += points
				const x = obstacle instanceof Bumper ? obstacle.x : obstacle.centerX
				const y = obstacle instanceof Bumper ? obstacle.y : obstacle.centerY
				this.scorePopups.push({
					x,
					y,
					score: points,
					life: 60,
					maxLife: 60
				})
			}
		})

		// Check rail collisions
		this.rails.forEach(rail => {
			rail.handleBallCollision(this.ball)
		})

		// Check curved surface collisions
		this.curves.forEach(curve => {
			curve.handleBallCollision(this.ball)
		})

		// Check smooth path collisions
		this.smoothPaths.forEach(path => {
			const collision = path.checkBallCollision(this.ball)
			if (collision) {
				path.handleBallCollision(this.ball)
			}
		})
	}

	updateFlippers() {
		this.flippers.left.forEach(flipper => flipper.update())
		this.flippers.right.forEach(flipper => flipper.update())
	}

	resetBall() {
		this.ball.x = this.width - 20
		this.ball.y = this.height - 50
		this.ball.vx = 0
		this.ball.vy = 0
		this.ballTrail = []
	}

	restart() {
		this.score = 0
		this.lives = 3
		this.gameOver = false
		this.scorePopups = []
		this.resetBall()
	}

	render() {
		// Clear canvas
		this.ctx.fillStyle = '#001122'
		this.ctx.fillRect(0, 0, this.width, this.height)

		// Draw obstacles
		this.obstacles.forEach(obstacle => obstacle.draw(this.ctx))
		this.rails.forEach(rail => rail.draw(this.ctx))
		this.curves.forEach(curve => curve.draw(this.ctx))
		this.smoothPaths.forEach(path => path.draw(this.ctx))
		this.bezierPaths.forEach(path => path.draw(this.ctx))

		// Draw flippers
		this.flippers.left.forEach(flipper => flipper.draw(this.ctx))
		this.flippers.right.forEach(flipper => flipper.draw(this.ctx))

		// Draw ball trail
		this.ballTrail.forEach((point, i) => {
			const alpha = (point.life / 10) * 0.3
			const size = this.ball.radius * (point.life / 10) * 0.8
			this.ctx.beginPath()
			this.ctx.arc(point.x, point.y, size, 0, Math.PI * 2)
			this.ctx.fillStyle = `rgba(254, 202, 87, ${alpha})`
			this.ctx.fill()
		})

		// Draw ball
		this.ctx.beginPath()
		this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2)
		const gradient = this.ctx.createRadialGradient(
			this.ball.x - 2, this.ball.y - 2, 1,
			this.ball.x, this.ball.y, this.ball.radius
		)
		gradient.addColorStop(0, '#fff9e6')
		gradient.addColorStop(0.5, '#feca57')
		gradient.addColorStop(1, '#ff9f43')
		this.ctx.fillStyle = gradient
		this.ctx.fill()
		this.ctx.strokeStyle = '#ff9ff3'
		this.ctx.lineWidth = 2
		this.ctx.stroke()

		// Draw score and lives
		this.ctx.fillStyle = '#fff'
		this.ctx.font = 'bold 24px Arial'
		this.ctx.fillText(`Score: ${this.score}`, 20, 40)

		// Draw lives
		for (let i = 0; i < this.lives; i++) {
			this.ctx.beginPath()
			this.ctx.arc(20 + i * 25, 70, 8, 0, Math.PI * 2)
			this.ctx.fillStyle = '#feca57'
			this.ctx.fill()
			this.ctx.strokeStyle = '#ff9ff3'
			this.ctx.lineWidth = 2
			this.ctx.stroke()
		}

		// Draw score popups
		this.scorePopups = this.scorePopups.filter(popup => {
			popup.life--
			if (popup.life <= 0) return false

			const alpha = popup.life / popup.maxLife
			const yOffset = (popup.maxLife - popup.life) * 0.5
			this.ctx.save()
			this.ctx.globalAlpha = alpha
			this.ctx.fillStyle = '#feca57'
			this.ctx.font = 'bold 20px Arial'
			this.ctx.textAlign = 'center'
			this.ctx.fillText(`+${popup.score}`, popup.x, popup.y - yOffset)
			this.ctx.restore()
			return true
		})
		this.ctx.textAlign = 'start'

		// Draw launch lane guide
		this.ctx.strokeStyle = '#555'
		this.ctx.lineWidth = 2
		this.ctx.beginPath()
		this.ctx.moveTo(this.width - this.launchLaneWidth, 80)
		this.ctx.lineTo(this.width - this.launchLaneWidth, this.height)
		this.ctx.stroke()

		// Draw plunger
		const plungerY = this.height - 120
		const plungerOffset = this.launching ? this.launchPower * 2 : 0
		this.ctx.fillStyle = '#e74c3c'
		this.ctx.fillRect(this.width - 30, plungerY + plungerOffset, 20, 80 - plungerOffset)
		this.ctx.strokeStyle = '#c0392b'
		this.ctx.lineWidth = 2
		this.ctx.strokeRect(this.width - 30, plungerY + plungerOffset, 20, 80 - plungerOffset)

		// Draw launch power indicator
		if (this.launching && this.launchPower > 0) {
			this.ctx.fillStyle = 'rgba(255, 71, 87, 0.3)'
			this.ctx.fillRect(this.width - 35, this.height - 150 - this.launchPower * 3, 30, this.launchPower * 3)
			this.ctx.strokeStyle = '#ff4757'
			this.ctx.lineWidth = 2
			this.ctx.strokeRect(this.width - 35, this.height - 150 - this.launchPower * 3, 30, this.launchPower * 3)
		}

		// Draw game over screen
		if (this.gameOver) {
			this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
			this.ctx.fillRect(0, 0, this.width, this.height)

			this.ctx.fillStyle = '#fff'
			this.ctx.font = 'bold 48px Arial'
			this.ctx.textAlign = 'center'
			this.ctx.fillText('GAME OVER', this.width / 2, this.height / 2 - 40)

			this.ctx.font = 'bold 32px Arial'
			this.ctx.fillText(`Final Score: ${this.score}`, this.width / 2, this.height / 2 + 20)

			this.ctx.font = '20px Arial'
			this.ctx.fillStyle = '#feca57'
			this.ctx.fillText('Press R to Restart', this.width / 2, this.height / 2 + 70)
			this.ctx.textAlign = 'start'
		}
	}

	gameLoop() {
		if (!this.gameOver) {
			if (this.launching) {
				this.launchPower = Math.min(this.launchPower + 0.5, this.maxLaunchPower)
			}
			this.updateBall()
			this.updateFlippers()
		}
		this.render()
		this.rafId = requestAnimationFrame(() => this.gameLoop())
	}
}