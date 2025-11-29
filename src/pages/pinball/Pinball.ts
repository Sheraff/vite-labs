import { CurvedSurface } from "./CurvedSurface"
import { Rail } from "./Rail"
import { SmoothPath } from "./SmoothPath"
import { Bumper } from "./Obstacle"

type Flipper = {
	x: number
	y: number
	angle: number
	targetAngle: number
}

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
		left: Flipper
		right: Flipper
	}

	obstacles: Array<Bumper>
	rails: Array<Rail>
	curves: Array<CurvedSurface>
	smoothPaths: Array<SmoothPath>

	score: number
	launching: boolean = false
	launchPower: number = 0
	maxLaunchPower: number = 30
	launchLaneWidth: number = 40

	cleanup = new Set<() => void>()
	rafId: number | null = null

	constructor({ canvas }: { canvas: HTMLCanvasElement }) {
		this.canvas = canvas
		this.ctx = this.canvas.getContext('2d')!
		this.width = this.canvas.width
		this.height = this.canvas.height

		this.ball = {
			x: this.width - 20,
			y: this.height - 50,
			radius: 8,
			vx: 0,
			vy: 0,
			gravity: 0.3,
			bounce: 0.8
		}

		this.flippers = {
			left: { x: 100, y: this.height - 50, angle: 0, targetAngle: 0 },
			right: { x: 300, y: this.height - 50, angle: 0, targetAngle: 0 }
		}

		this.obstacles = [
			new Bumper(100, 200, 20, 100),
			new Bumper(300, 200, 20, 100),
			new Bumper(200, 150, 15, 200),
			new Bumper(150, 300, 25, 150),
			new Bumper(250, 300, 25, 150)
		]

		this.rails = [
			new Rail(50, 150, 150, 200, 12),
			new Rail(250, 200, 350, 150, 12),
			// Launch lane wall
			new Rail(this.width - this.launchLaneWidth, this.height, this.width - this.launchLaneWidth, 80, 5)
		]

		this.curves = [
			new CurvedSurface(200, 100, 60, 0, Math.PI, 15), // Half circle at top
			new CurvedSurface(100, 400, 40, Math.PI / 4, 3 * Math.PI / 4, 10),
			new CurvedSurface(300, 400, 40, Math.PI / 4, 3 * Math.PI / 4, 10),
			// Top right curve to guide ball from launch lane
			new CurvedSurface(this.width - 40, 40, 40, 0, Math.PI, 10)
		]

		this.smoothPaths = [
			new SmoothPath([
				{ x: 20, y: 300 },
				{ x: 80, y: 280 },
				{ x: 120, y: 320 },
				{ x: 180, y: 310 }
			], 18)
		]

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
				this.flippers.left.targetAngle = -Math.PI / 4
			}
			if (e.key === 'ArrowRight' || e.key === 'd') {
				this.flippers.right.targetAngle = Math.PI / 4
			}
			if (e.key === ' ') {
				e.preventDefault()
				if (this.ball.x > this.width - this.launchLaneWidth && this.ball.y > this.height - 100) {
					this.launching = true
				}
			}
		}, { signal: controller.signal })

		document.addEventListener('keyup', (e) => {
			if (e.key === 'ArrowLeft' || e.key === 'a') {
				this.flippers.left.targetAngle = 0
			}
			if (e.key === 'ArrowRight' || e.key === 'd') {
				this.flippers.right.targetAngle = 0
			}
			if (e.key === ' ') {
				if (this.launching) {
					this.launching = false
					this.launchBall()
				}
			}
		}, { signal: controller.signal })
		this.cleanup.add(() => controller.abort())
	}

	launchBall() {
		if (this.ball.x > this.width - this.launchLaneWidth && this.ball.y > this.height - 100) {
			this.ball.vy = -this.launchPower
			this.launchPower = 0
		}
	}

	updateBall() {
		// Apply gravity
		this.ball.vy += this.ball.gravity

		// Update position
		this.ball.x += this.ball.vx
		this.ball.y += this.ball.vy

		// Wall collisions
		if (this.ball.x - this.ball.radius <= 0 || this.ball.x + this.ball.radius >= this.width) {
			this.ball.vx *= -this.ball.bounce
			this.ball.x = Math.max(this.ball.radius, Math.min(this.width - this.ball.radius, this.ball.x))
		}

		if (this.ball.y - this.ball.radius <= 0) {
			this.ball.vy *= -this.ball.bounce
			this.ball.y = this.ball.radius
		}

		// Bottom boundary (game over check)
		if (this.ball.y > this.height) {
			this.resetBall()
		}

		// Check obstacle collisions
		this.obstacles.forEach(obstacle => {
			this.score += obstacle.handleBallCollision(this.ball)
		})

		// Check rail collisions
		this.rails.forEach(rail => {
			rail.handleBallCollision(this.ball)
		})

		// Check curved surface collisions
		this.curves.forEach(curve => {
			curve.handleBallCollision(this.ball)
		})

		// Check smooth path collisions (simplified)
		this.smoothPaths.forEach(path => {
			path.pathPoints.forEach(point => {
				const dx = this.ball.x - point.x
				const dy = this.ball.y - point.y
				const distance = Math.sqrt(dx * dx + dy * dy)

				if (distance < this.ball.radius + path.width / 2) {
					// Simple bounce off path
					const angle = Math.atan2(dy, dx)
					this.ball.vx = Math.cos(angle) * 6
					this.ball.vy = Math.sin(angle) * 6
				}
			})
		})

		// Flipper collisions
		this.checkFlipperCollision(this.flippers.left, true)
		this.checkFlipperCollision(this.flippers.right, false)
	}

	checkFlipperCollision(flipper: Flipper, isLeft: boolean) {
		const dx = this.ball.x - flipper.x
		const dy = this.ball.y - flipper.y
		const distance = Math.sqrt(dx * dx + dy * dy)

		if (distance < this.ball.radius + 30) { // 30 is flipper length
			const angle = Math.atan2(dy, dx)
			const force = Math.abs(flipper.angle - flipper.targetAngle) * 20

			this.ball.vx = Math.cos(angle) * (8 + force)
			this.ball.vy = Math.sin(angle) * (8 + force)

			// Move ball away from flipper
			const overlap = this.ball.radius + 30 - distance
			this.ball.x += Math.cos(angle) * overlap
			this.ball.y += Math.sin(angle) * overlap
		}
	}

	updateFlippers() {
		// Smooth flipper animation
		this.flippers.left.angle += (this.flippers.left.targetAngle - this.flippers.left.angle) * 0.3
		this.flippers.right.angle += (this.flippers.right.targetAngle - this.flippers.right.angle) * 0.3
	}

	resetBall() {
		this.ball.x = this.width - 20
		this.ball.y = this.height - 50
		this.ball.vx = 0
		this.ball.vy = 0
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

		// Draw flippers
		this.drawFlipper(this.flippers.left, true)
		this.drawFlipper(this.flippers.right, false)

		// Draw ball
		this.ctx.beginPath()
		this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2)
		this.ctx.fillStyle = '#feca57'
		this.ctx.fill()
		this.ctx.strokeStyle = '#ff9ff3'
		this.ctx.lineWidth = 2
		this.ctx.stroke()

		// Draw score
		this.ctx.fillStyle = '#fff'
		this.ctx.font = '24px Arial'
		this.ctx.fillText(`Score: ${this.score}`, 20, 40)

		// Draw launch power
		if (this.launching || this.launchPower > 0) {
			this.ctx.fillStyle = '#ff4757'
			this.ctx.fillRect(this.width - 30, this.height - 100 - this.launchPower * 3, 20, this.launchPower * 3)
		}
	}

	drawFlipper(flipper: Flipper, isLeft: boolean) {
		this.ctx.save()
		this.ctx.translate(flipper.x, flipper.y)
		this.ctx.rotate(flipper.angle)

		this.ctx.fillStyle = '#48dbfb'
		this.ctx.fillRect(isLeft ? -30 : 0, -5, 30, 10)
		this.ctx.strokeStyle = '#0abde3'
		this.ctx.lineWidth = 2
		this.ctx.strokeRect(isLeft ? -30 : 0, -5, 30, 10)

		this.ctx.restore()
	}

	gameLoop() {
		if (this.launching) {
			this.launchPower = Math.min(this.launchPower + 0.5, this.maxLaunchPower)
		}
		this.updateBall()
		this.updateFlippers()
		this.render()
		this.rafId = requestAnimationFrame(() => this.gameLoop())
	}
}