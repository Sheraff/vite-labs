import { CurvedSurface } from "./CurvedSurface"
import { Rail } from "./Rail"
import { SmoothPath } from "./SmoothPath"
import { Bumper } from "./Obstacle"
import { Flipper } from "./Flipper"

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

	constructor({ canvas }: { canvas: HTMLCanvasElement }) {
		this.canvas = canvas
		this.ctx = this.canvas.getContext('2d')!
		const scale = window.devicePixelRatio
		this.ctx.scale(scale, scale)
		this.width = 400
		this.height = 600

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
			left: new Flipper(80, this.height - 80, 'left', 80),
			right: new Flipper(320, this.height - 80, 'right', 80)
		}

		this.obstacles = [
			new Bumper(100, 180, 20, 100),
			new Bumper(300, 180, 20, 100),
			new Bumper(200, 120, 18, 200),
			new Bumper(140, 280, 25, 150),
			new Bumper(260, 280, 25, 150),
			new Bumper(200, 360, 22, 175)
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
			// Outlanes protection
			new CurvedSurface(40, this.height - 120, 35, -Math.PI / 2, 0, 8),
			new CurvedSurface(this.width - this.launchLaneWidth - 40, this.height - 120, 35, Math.PI, Math.PI / 2, 8)
		]

		this.smoothPaths = [
			// new SmoothPath([
			// 	{ x: 20, y: 300 },
			// 	{ x: 80, y: 280 },
			// 	{ x: 120, y: 320 },
			// 	{ x: 180, y: 310 }
			// ], 18)
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
				this.flippers.left.flipUp()
			}
			if (e.key === 'ArrowRight' || e.key === 'd') {
				this.flippers.right.flipUp()
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
				this.flippers.left.flipDown()
			}
			if (e.key === 'ArrowRight' || e.key === 'd') {
				this.flippers.right.flipDown()
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

		// Touch controls
		this.canvas.addEventListener('pointerdown', (e) => {
			if (this.gameOver) {
				this.restart()
				return
			}

			const rect = this.canvas.getBoundingClientRect()
			const x = e.clientX - rect.left
			const centerX = rect.width / 2

			if (x < centerX) {
				this.flippers.left.flipUp()
			} else {
				this.flippers.right.flipUp()
			}

			// Check for launch
			if (this.ball.x >= this.width - this.launchLaneWidth && this.ball.y > this.height - 150) {
				this.launching = true
			}
		}, { signal: controller.signal })

		this.canvas.addEventListener('pointerup', (e) => {
			const rect = this.canvas.getBoundingClientRect()
			const x = e.clientX - rect.left
			const centerX = rect.width / 2

			if (x < centerX) {
				this.flippers.left.flipDown()
			} else {
				this.flippers.right.flipDown()
			}

			if (this.launching) {
				this.launching = false
				this.launchBall()
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
		// Apply gravity
		this.ball.vy += this.ball.gravity

		// Apply air resistance/damping
		this.ball.vx *= 0.995
		this.ball.vy *= 0.998

		// Update position
		this.ball.x += this.ball.vx
		this.ball.y += this.ball.vy

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

		// Check obstacle collisions
		this.obstacles.forEach(obstacle => {
			const points = obstacle.handleBallCollision(this.ball)
			if (points > 0) {
				this.score += points
				this.scorePopups.push({
					x: obstacle.x,
					y: obstacle.y,
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

		// Flipper collisions
		this.flippers.left.checkCollision(this.ball)
		this.flippers.right.checkCollision(this.ball)

		// Add trail
		this.ballTrail.push({ x: this.ball.x, y: this.ball.y, life: 10 })
		this.ballTrail = this.ballTrail.filter(t => {
			t.life--
			return t.life > 0
		}).slice(-15) // Keep only last 15 trail points
	}

	updateFlippers() {
		this.flippers.left.update()
		this.flippers.right.update()
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

		// Draw flippers
		this.flippers.left.draw(this.ctx)
		this.flippers.right.draw(this.ctx)

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