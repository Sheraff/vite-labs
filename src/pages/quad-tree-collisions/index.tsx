import { useEffect, useRef } from "react"
import styles from './styles.module.css'
import { Head } from "~/components/Head"
import type { RouteMeta } from "~/router"
import { TreeNode } from "./TreeNode"

export const meta: RouteMeta = {
	title: 'Quad Tree Collisions',
	image: './screen.png',
	tags: ['data structures', 'performance']
}

export default function QuadTreeCollisions() {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const formRef = useRef<HTMLFormElement | null>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return
		const form = formRef.current
		if (!form) return

		canvas.width = window.innerWidth * devicePixelRatio
		canvas.height = window.innerHeight * devicePixelRatio

		const mouse = { x: -Infinity, y: -Infinity }
		const onMouseMove = (e: PointerEvent) => {
			const event = e.getPredictedEvents().at(0) || e
			mouse.x = event.clientX * devicePixelRatio
			mouse.y = event.clientY * devicePixelRatio
		}
		window.addEventListener('pointermove', onMouseMove, { passive: true })

		const options = {
			geometry: true
		}
		const onForm = () => {
			options.geometry = 'geometry' in form.elements && form.elements.geometry instanceof HTMLInputElement ? form.elements.geometry.checked : false
		}
		form.addEventListener('input', onForm)
		onForm()

		const clear = start(ctx, mouse, options)
		return () => {
			window.removeEventListener('pointermove', onMouseMove)
			form.removeEventListener('input', onForm)
			clear()
		}
	}, [])

	return (
		<div className={styles.main}>
			<Head />

			<canvas id="canvas" ref={canvasRef} className={styles.canvas}></canvas>

			<form ref={formRef}>
				<fieldset>
					<legend>options</legend>
					<label>
						<input type="checkbox" name="geometry" />
						show geometry
					</label>
				</fieldset>
			</form>
		</div>
	)
}

function start(
	ctx: CanvasRenderingContext2D,
	mouse: { x: number, y: number },
	options: { geometry: boolean }
) {

	const tree = new TreeNode<Ball>(0, 0, ctx.canvas.width, ctx.canvas.height)
	const bounds = { top: 0, right: ctx.canvas.width, bottom: ctx.canvas.height, left: 0 }

	const balls = Array.from({ length: 10000 }, () => new Ball(
		Math.random() * ctx.canvas.width,
		Math.random() * ctx.canvas.height,
		Math.random() * 3 + 1,
		`hsl(${Math.random() * 360}, 100%, 50%)`,
		Math.random() * 70 + 10,
		Math.random() * Math.PI * 2,
		bounds
	))

	const maxRadius = Math.max(...balls.map(ball => ball.radius))

	for (const ball of balls) {
		tree.insert(ball)
	}

	let lastTimestamp = 0
	let run = true

	const onHide = () => {
		lastTimestamp = 0
		run = !document.hidden
	}
	window.addEventListener('visibilitychange', onHide)

	let rafId = requestAnimationFrame(function loop(timestamp) {
		const init = !lastTimestamp
		const dt = (timestamp - lastTimestamp) / 1000
		lastTimestamp = timestamp
		rafId = requestAnimationFrame(loop)
		if (init || !run) {
			return
		}

		for (const ball of balls) {
			ball.move(dt)
			tree.update(ball)
			const collisionCandidates = tree.query(ball.x, ball.y, maxRadius * 2)
			for (const candidate of collisionCandidates) {
				const collided = Ball.bounce(ball, candidate)
				if (collided) {
					tree.update(ball)
					tree.update(candidate)
				}
			}
		}

		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

		if (!options.geometry) {
			for (const ball of balls) {
				drawBall(ctx, ball)
			}
		} else {
			const ballClosestToMouse = balls.reduce((closest, ball) => {
				const dx = ball.x - mouse.x
				const dy = ball.y - mouse.y
				const distance = Math.sqrt(dx * dx + dy * dy)
				if (distance < closest.distance) {
					return { ball, distance }
				}
				return closest
			}, { ball: balls[0], distance: Infinity }).ball

			drawTree(ctx, tree)
			for (const ball of balls) {
				drawBall(ctx, ball, 'white')
			}

			const neighbors = tree.query(ballClosestToMouse.x, ballClosestToMouse.y, maxRadius * 2)
			for (const neighbor of neighbors) {
				drawBall(ctx, neighbor, 'green')
			}
			drawBall(ctx, ballClosestToMouse, 'red')
			ctx.lineWidth = 1
			ctx.strokeStyle = 'red'
			ctx.beginPath()
			ctx.arc(ballClosestToMouse.x, ballClosestToMouse.y, maxRadius * 2, 0, Math.PI * 2)
			ctx.stroke()
		}

	})

	return () => {
		cancelAnimationFrame(rafId)
		window.removeEventListener('visibilitychange', onHide)
	}
}

class Ball {
	x: number
	y: number
	radius: number
	color: string
	speed: number
	direction: number
	bounds: { top: number, right: number, bottom: number, left: number }

	constructor(
		x: number,
		y: number,
		radius: number,
		color: string,
		speed: number,
		direction: number,
		bounds: { top: number, right: number, bottom: number, left: number }
	) {
		this.x = x

		this.y = y
		this.radius = radius
		this.color = color
		this.speed = speed
		this.direction = direction
		this.bounds = bounds
	}

	move(dt: number) {
		this.x += Math.cos(this.direction) * this.speed * dt
		this.y += Math.sin(this.direction) * this.speed * dt
		if (this.x - this.radius < this.bounds.left) {
			this.x = this.bounds.left + this.radius
			this.direction = Math.PI - this.direction
		}
		if (this.x + this.radius > this.bounds.right) {
			this.x = this.bounds.right - this.radius
			this.direction = Math.PI - this.direction
		}
		if (this.y - this.radius < this.bounds.top) {
			this.y = this.bounds.top + this.radius
			this.direction = -this.direction
		}
		if (this.y + this.radius > this.bounds.bottom) {
			this.y = this.bounds.bottom - this.radius
			this.direction = -this.direction
		}
	}

	static bounce(a: Ball, b: Ball) {
		if (b === a) return false
		const dx = b.x - a.x
		const dy = b.y - a.y
		const distance = Math.sqrt(dx * dx + dy * dy)
		const minDistance = b.radius + a.radius
		if (distance >= minDistance) return false
		const overlap = minDistance - distance
		const angle = Math.atan2(dy, dx)
		const overlapX = Math.cos(angle) * overlap / 2
		const overlapY = Math.sin(angle) * overlap / 2
		a.x -= overlapX
		a.y -= overlapY
		b.x += overlapX
		b.y += overlapY

		// Calculate new velocities
		const normalX = dx / distance
		const normalY = dy / distance

		const relativeVelocityX = Math.cos(b.direction) * b.speed - Math.cos(a.direction) * a.speed
		const relativeVelocityY = Math.sin(b.direction) * b.speed - Math.sin(a.direction) * a.speed

		const velocityAlongNormal = relativeVelocityX * normalX + relativeVelocityY * normalY

		// Only proceed if objects are moving towards each other
		if (velocityAlongNormal <= 0) {
			// Elastic collision response
			const restitution = 1 // Bouncing factor (1 = perfect elastic)
			const j = -(1 + restitution) * velocityAlongNormal

			// Update velocities
			const impulseX = j * normalX
			const impulseY = j * normalY

			a.direction = Math.atan2(
				Math.sin(a.direction) * a.speed - impulseY,
				Math.cos(a.direction) * a.speed - impulseX
			)
			b.direction = Math.atan2(
				Math.sin(b.direction) * b.speed + impulseY,
				Math.cos(b.direction) * b.speed + impulseX
			)
		}
		return true
	}
}


function drawTree(ctx: CanvasRenderingContext2D, tree: TreeNode) {
	if (tree.children) {
		for (const child of tree.children) {
			if (child.isEmpty) continue
			drawTree(ctx, child)
		}
	}
	ctx.strokeStyle = 'white'
	ctx.lineWidth = 1 / tree.depth
	ctx.strokeRect(tree.x, tree.y, tree.width, tree.height)
}

function drawBall(ctx: CanvasRenderingContext2D, ball: Ball, color = ball.color) {
	ctx.fillStyle = color
	ctx.beginPath()
	ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
	ctx.fill()
}