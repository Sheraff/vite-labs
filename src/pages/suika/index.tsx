import styles from './styles.module.css'
import { Head } from "#components/Head"
import type { RouteMeta } from "#router"
import { useEffect, useRef, useState } from "react"

export const meta: RouteMeta = {
	title: 'Suika Game',
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
	{ r: 10, color: 'red', score: 0 },
	{ r: 20, color: 'orange', score: 1 },
	{ r: 30, color: 'yellow', score: 3 },
	{ r: 40, color: 'green', score: 5 },
	{ r: 50, color: 'blue', score: 7 },
	{ r: 60, color: 'indigo', score: 11 },
	{ r: 70, color: 'violet', score: 20 },
	{ r: 80, color: 'black', score: 50 },
	{ r: 90, color: 'white', score: 100 },
	{ r: 100, color: 'gold', score: 200 },
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
		nextId = Math.floor(Math.random() * max + 1)
	}, { signal })

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

		const steps = Math.floor(dt / 0.1)

		for (let step = 0; step < steps; step++) {
			const dti = dt / steps

			// Update entities
			for (const entity of entities) {
				entity.vy += 0.4 * dti // gravity
				entity.x += entity.vx * dti
				entity.y += entity.vy * dti

				// floor collision
				if (entity.y + entity.r > window.innerHeight) {
					entity.y = window.innerHeight - entity.r
					entity.vy *= -0.3
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
						vy: (a.vy + b.vy) / 2,
					})
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
					const separationX = (dx / dist) * overlap * 0.5
					const separationY = (dy / dist) * overlap * 0.5

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
		ctx.fillStyle = 'black'
		ctx.fillRect(containerX - 10, containerY - 10, 10, CONTAINER_HEIGHT + 20) // left
		ctx.fillRect(containerX + CONTAINER_WIDTH, containerY - 10, 10, CONTAINER_HEIGHT + 20) // right
		ctx.fillRect(containerX - 10, containerY + CONTAINER_HEIGHT, CONTAINER_WIDTH + 20, 10) // bottom

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
			ctx.arc(window.innerWidth - 50, 50, base.r, 0, Math.PI * 2)
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