import { CurvedSurface } from "./CurvedSurface"
import { Rail } from "./Rail"
import { SmoothPath } from "./SmoothPath"

type Flipper = {
	x: number
	y: number
	angle: number
	targetAngle: number
}

type Obstacle = {
	x: number
	y: number
	radius: number
	points: number
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

	obstacles: Array<Obstacle>
	rails: Array<Rail>
	curves: Array<CurvedSurface>
	smoothPaths: Array<SmoothPath>

	score: number

	cleanup = new Set<() => void>()
	rafId: number | null = null

	constructor({ canvas }: { canvas: HTMLCanvasElement }) {
		this.canvas = canvas
		this.ctx = this.canvas.getContext('2d')!
		this.width = this.canvas.width
		this.height = this.canvas.height

		this.ball = {
			x: this.width / 2,
			y: this.height - 100,
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
			{ x: 100, y: 200, radius: 20, points: 100 },
			{ x: 300, y: 200, radius: 20, points: 100 },
			{ x: 200, y: 150, radius: 15, points: 200 },
			{ x: 150, y: 300, radius: 25, points: 150 },
			{ x: 250, y: 300, radius: 25, points: 150 }
		]

		this.rails = [
			new Rail(50, 150, 150, 200, 12),
			new Rail(250, 200, 350, 150, 12)
		]

		this.curves = [
			new CurvedSurface(200, 100, 60, 0, Math.PI, 15), // Half circle at top
			new CurvedSurface(100, 400, 40, Math.PI / 4, 3 * Math.PI / 4, 10),
			new CurvedSurface(300, 400, 40, Math.PI / 4, 3 * Math.PI / 4, 10)
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
				this.launchBall()
			}
		}, { signal: controller.signal })

		document.addEventListener('keyup', (e) => {
			if (e.key === 'ArrowLeft' || e.key === 'a') {
				this.flippers.left.targetAngle = 0
			}
			if (e.key === 'ArrowRight' || e.key === 'd') {
				this.flippers.right.targetAngle = 0
			}
		}, { signal: controller.signal })
		this.cleanup.add(() => controller.abort())
	}

	launchBall() {
		if (this.ball.y > this.height - 120) {
			this.ball.vx = (Math.random() - 0.5) * 4
			this.ball.vy = -15
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
			const dx = this.ball.x - obstacle.x
			const dy = this.ball.y - obstacle.y
			const distance = Math.sqrt(dx * dx + dy * dy)

			if (distance < this.ball.radius + obstacle.radius) {
				// Collision response
				const angle = Math.atan2(dy, dx)
				this.ball.vx = Math.cos(angle) * 8
				this.ball.vy = Math.sin(angle) * 8

				// Move ball out of obstacle
				const overlap = this.ball.radius + obstacle.radius - distance
				this.ball.x += Math.cos(angle) * overlap
				this.ball.y += Math.sin(angle) * overlap

				// Add score
				this.score += obstacle.points
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
		this.ball.x = this.width / 2
		this.ball.y = this.height - 100
		this.ball.vx = 0
		this.ball.vy = 0
	}

	render() {
		// Clear canvas
		this.ctx.fillStyle = '#001122'
		this.ctx.fillRect(0, 0, this.width, this.height)

		// Draw obstacles
		this.obstacles.forEach(obstacle => {
			this.ctx.beginPath()
			this.ctx.arc(obstacle.x, obstacle.y, obstacle.radius, 0, Math.PI * 2)
			this.ctx.fillStyle = '#ff6b6b'
			this.ctx.fill()
			this.ctx.strokeStyle = '#ff4757'
			this.ctx.lineWidth = 2
			this.ctx.stroke()
		})
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
		this.updateBall()
		this.updateFlippers()
		this.render()
		this.rafId = requestAnimationFrame(() => this.gameLoop())
	}
}