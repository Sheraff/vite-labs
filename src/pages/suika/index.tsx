import styles from './styles.module.css'
import { Head } from "#components/Head"
import type { RouteMeta } from "#router"
import { useEffect, useRef, useState } from "react"

export const meta: RouteMeta = {
	title: 'Suika Game',
	image: './screen.png',
	tags: ['game'],
}
export default function SuikaGamePage() {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const [score, setScore] = useState(0)

	useEffect(() => {
		const canvas = canvasRef.current!

		canvas.width = window.innerWidth * devicePixelRatio
		canvas.height = window.innerHeight * devicePixelRatio
		canvas.style.width = `${window.innerWidth}px`
		canvas.style.height = `${window.innerHeight}px`

		const ctx = canvas.getContext('2d')!
		ctx.scale(devicePixelRatio, devicePixelRatio)

		const controller = new AbortController()
		start(controller.signal, ctx, setScore)

		return () => {
			controller.abort()
		}
	}, [])

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
				<output>Score: {score}</output>
			</div>
			<canvas ref={canvasRef} className={styles.canvas} />
		</div>
	)
}

/** 
 * When 2 entities of the same level (index) touch,
 * they fuse in 1 single entity of the next level.
 * 
 * The new entity is created at the position of the touch,
 * with velocity being the average of the 2 original entities.
 * 
 * This earns the player points (score).
 */
const CHAIN = [
	{ r: 10, color: '#ff6b6b', score: 0 },
	{ r: 20, color: '#ff8e53', score: 1 },
	{ r: 30, color: '#ffbe0b', score: 3 },
	{ r: 40, color: '#8ac926', score: 5 },
	{ r: 50, color: '#06ffa5', score: 7 },
	{ r: 60, color: '#118ab2', score: 11 },
	{ r: 70, color: '#7209b7', score: 20 },
	{ r: 80, color: '#d90429', score: 50 },
	{ r: 90, color: '#ef23efff', score: 100 },
	{ r: 100, color: '#ffd60a', score: 200 },
	{ r: 110, color: '#003566', score: 500 },
	{ r: 120, color: '#3f0139', score: 1000 },
]

type Entity = {
	/** index in CHAIN */
	id: number
	r: number
	color: string
	x: number
	y: number
	vx: number
	vy: number
}

function start(signal: AbortSignal, ctx: CanvasRenderingContext2D, setScore: (update: (prev: number) => number) => void) {
	/** All entities currently in the game */
	const entities: Entity[] = []
	/** the maximum level (index) of entity present in the game */
	let max = 0
	let nextId = 0
	/** what will be dropped when the user clicks (index in CHAIN) */
	let handId = 0
	/** preview of the next handId (index in CHAIN), will become handId when the user clicks */

	/** position at which to drop the new entity (handId) on click */
	let mouseX = 0

	window.addEventListener('mousemove', (e) => {
		mouseX = e.clientX
	}, { signal })

	window.addEventListener('click', () => {
		const base = CHAIN[handId]
		const x = Math.max(containerX + base.r, Math.min(containerX + CONTAINER_WIDTH - base.r, mouseX))
		entities.push({
			id: handId,
			r: base.r,
			color: base.color,
			x,
			y: base.r,
			vx: 0,
			vy: 0,
		})
		handId = nextId
		nextId = Math.floor(Math.random() * max)
	}, { signal })

	const WALL_THICKNESS = 10
	const CONTAINER_WIDTH = 700
	const CONTAINER_HEIGHT = 1000
	const containerX = ctx.canvas.width / devicePixelRatio / 2 - CONTAINER_WIDTH / 2
	const containerY = ctx.canvas.height / devicePixelRatio - CONTAINER_HEIGHT

	let lastTime = performance.now()
	let rafId = requestAnimationFrame(function loop(time) {
		rafId = requestAnimationFrame(loop)
		const dt = (time - lastTime) / 16.6667
		lastTime = time
		if (dt > 1) return // skip frame if too much time has passed

		const steps = 20

		for (let step = 0; step < steps; step++) {
			const dti = dt / steps

			// Update entities
			for (const entity of entities) {
				entity.vy += 0.7 * dti // gravity

				// Apply damping to reduce vibration
				const damping = (1 - 0.04 * dti)
				entity.vx *= damping
				entity.vy *= damping

				entity.x += entity.vx * dti
				entity.y += entity.vy * dti

				// floor collision
				if (entity.y + entity.r > window.innerHeight - WALL_THICKNESS) {
					entity.y = window.innerHeight - WALL_THICKNESS - entity.r
					entity.vy *= -0.5
				}

				// wall collisions
				if (entity.x - entity.r < containerX) {
					entity.x = containerX + entity.r
					entity.vx *= -0.5
				}
				if (entity.x + entity.r > containerX + CONTAINER_WIDTH) {
					entity.x = containerX + CONTAINER_WIDTH - entity.r
					entity.vx *= -0.5
				}
				if (entity.y + entity.r > containerY + CONTAINER_HEIGHT) {
					entity.y = containerY + CONTAINER_HEIGHT - entity.r
					entity.vy *= -0.5
				}
			}

			// Check for merges
			for (let i = 0; i < entities.length; i++) {
				for (let j = i + 1; j < entities.length; j++) {
					const a = entities[i]
					if (a.id >= CHAIN.length - 1) continue
					const b = entities[j]
					if (a.id !== b.id) continue
					const dx = a.x - b.x
					const dy = a.y - b.y
					const dist = Math.hypot(dx, dy)
					if (dist > a.r + b.r) continue
					// Merge
					const newId = a.id + 1
					const base = CHAIN[newId]!
					entities.push({
						id: newId,
						r: base.r,
						color: base.color,
						x: (a.x + b.x) / 2,
						y: (a.y + b.y) / 2,
						vx: (a.vx + b.vx) / 2,
						vy: (a.vy + b.vy) / 2 - 7, // slight upward boost on merge
					})
					if (newId < CHAIN.length - 2)
						max = Math.max(max, newId)
					setScore(prev => prev + base.score)
					// Remove merged entities
					entities.splice(j, 1)
					entities.splice(i, 1)
					i--
					break
				}
			}

			// Check for collisions
			for (let i = 0; i < entities.length; i++) {
				for (let j = i + 1; j < entities.length; j++) {
					const a = entities[i]
					const b = entities[j]
					const dx = a.x - b.x
					const dy = a.y - b.y
					const dist = Math.hypot(dx, dy)
					const minDist = a.r + b.r
					if (dist > minDist) continue

					// Collision detected - separate entities
					const overlap = minDist - dist

					// Allow small overlap (slop) to prevent micro-corrections
					const slop = 0.5
					if (overlap < slop) continue

					const correctedOverlap = overlap - slop
					const separationX = (dx / dist) * correctedOverlap * 0.5
					const separationY = (dy / dist) * correctedOverlap * 0.5

					a.x += separationX
					a.y += separationY
					b.x -= separationX
					b.y -= separationY

					// Apply collision response (elastic collision)
					const normalX = dx / dist
					const normalY = dy / dist
					const relativeVelX = a.vx - b.vx
					const relativeVelY = a.vy - b.vy
					const speed = relativeVelX * normalX + relativeVelY * normalY

					if (speed > 0) continue // Objects separating

					const massA = a.r ** 3
					const massB = b.r ** 3
					const impulse = 2 * speed / (massA + massB) * 0.8 // restitution coefficient
					a.vx -= impulse * massB * normalX
					a.vy -= impulse * massB * normalY
					b.vx += impulse * massA * normalX
					b.vy += impulse * massA * normalY
				}
			}
		}

		// Render frame
		ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

		// Draw walls
		ctx.fillStyle = 'white'
		ctx.fillRect(containerX - WALL_THICKNESS, containerY - WALL_THICKNESS, WALL_THICKNESS, CONTAINER_HEIGHT + WALL_THICKNESS * 2) // left
		ctx.fillRect(containerX + CONTAINER_WIDTH, containerY - WALL_THICKNESS, WALL_THICKNESS, CONTAINER_HEIGHT + WALL_THICKNESS * 2) // right
		ctx.fillRect(containerX - WALL_THICKNESS, innerHeight - WALL_THICKNESS, CONTAINER_WIDTH + WALL_THICKNESS * 2, WALL_THICKNESS) // bottom

		// Draw hand
		{
			const base = CHAIN[handId]
			ctx.fillStyle = base.color
			ctx.beginPath()
			const x = Math.max(containerX + base.r, Math.min(containerX + CONTAINER_WIDTH - base.r, mouseX))
			ctx.arc(x, 50, base.r, 0, Math.PI * 2)
			ctx.fill()
		}

		// Draw next hand preview (top right corner)
		{
			const base = CHAIN[nextId]
			ctx.fillStyle = base.color
			ctx.globalAlpha = 0.5
			ctx.beginPath()
			ctx.arc(containerX + CONTAINER_WIDTH + WALL_THICKNESS + 10 + base.r, base.r + 10, base.r, 0, Math.PI * 2)
			ctx.fill()
			ctx.globalAlpha = 1
		}

		// Draw entities
		for (const entity of entities) {
			ctx.fillStyle = entity.color
			ctx.beginPath()
			ctx.arc(entity.x, entity.y, entity.r, 0, Math.PI * 2)
			ctx.fill()
		}
	})

	signal.addEventListener('abort', () => {
		cancelAnimationFrame(rafId)
	}, { signal })
}