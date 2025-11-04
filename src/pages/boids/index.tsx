import type { RouteMeta } from "#router"
import styles from './styles.module.css'
import { Head } from "#components/Head"
import { useEffect, useRef, useState } from "react"
import { TreeNode } from "#quad-tree-collisions/TreeNode"

export const meta: RouteMeta = {
	title: 'Boids',
	description: `
		Boids is an artificial life program which simulates the flocking behaviour of birds.
		It is an example of emergent behavior; that is, the complexity of Boids arises from the interaction of individual agents adhering to a set of simple rules.
	`,
	image: './screen.png',
	tags: ['simulation', 'animation', 'performance']
}

const COUNT = 10000

/**
 * separation: steer to avoid crowding local flockmates
 * alignment: steer towards the average heading of local flockmates
 * cohesion: steer to move towards the average position (center of mass) of local flockmates
 */

function start(ctx: CanvasRenderingContext2D, form: HTMLFormElement, side: number, onFrame: (delta: number) => void): () => void {
	type Boid = {
		x: number
		y: number
		radians: number
		speed: number
		/** pre-computed */
		xSpeedNormal: number
		/** pre-computed */
		ySpeedNormal: number
	}

	const tree = new TreeNode<Boid>(0, 0, side, side, 5)

	const boids: Boid[] = Array.from({ length: COUNT })

	for (let i = 0; i < COUNT; i++) {
		const radians = Math.random() * Math.PI * 2
		const [xSpeedNormal, ySpeedNormal] = angleToVector(radians)
		const speed = (20 + Math.random() * 40) * window.devicePixelRatio
		const x = Math.random() * side
		const y = Math.random() * side
		const boid: Boid = {
			x,
			y,
			radians,
			speed,
			xSpeedNormal,
			ySpeedNormal,
		}
		boids[i] = (boid)
		tree.insert(boid)
	}

	const params = {
		/** How far a boid can see */
		sight: 20,
		/** How close boids can get before they start to separate */
		space: 10,
		alignment: 2.5,
		cohesion: 1.3,
		separation: 4,
		edge_avoidance: 3,
		draw_tree: false,
		draw_fov: false,
	}

	const drawTriangle = (() => {
		const size = 3 * window.devicePixelRatio
		const triangle = new Path2D()
		triangle.moveTo(size, 0)
		triangle.lineTo(-size, size / 2)
		triangle.lineTo(-size, -size / 2)
		triangle.closePath()
		ctx.fillStyle = 'white'
		return (x: number, y: number, radians: number) => {
			ctx.translate(x, y)
			ctx.rotate(radians)
			ctx.fill(triangle)
			ctx.rotate(-radians)
			ctx.translate(-x, -y)
		}
	})()

	let lastTime = 0
	let frame = 0
	const queryCache = new Set<Boid>()
	let rafId = requestAnimationFrame(function animate(time) {
		rafId = requestAnimationFrame(animate)
		const first = lastTime === 0
		const delta = (time - lastTime) / 1000
		lastTime = time
		if (first) return
		onFrame(delta)
		frame++

		ctx.clearRect(0, 0, side, side)

		const max = Math.max(params.sight, params.space)
		const max_sq = max * max

		for (let i = 0; i < boids.length; i++) {
			const boid = boids[i]

			// Avoid edges (no wrap around)
			const going_up = boid.ySpeedNormal < 0
			const going_left = boid.xSpeedNormal < 0
			const top = boid.y < max && going_up
			const bottom = !top && boid.y > side - max && !going_up
			const left = boid.x < max && going_left
			const right = !left && boid.x > side - max && !going_left
			const free = !top && !bottom && !left && !right
			if (!free) {
				if (top) {
					if (going_left) {
						// steer down and left
						boid.radians -= params.edge_avoidance * delta
					} else {
						// steer down and right
						boid.radians += params.edge_avoidance * delta
					}
				} else if (bottom) {
					if (going_left) {
						// steer up and left
						boid.radians += params.edge_avoidance * delta
					} else {
						// steer up and right
						boid.radians -= params.edge_avoidance * delta
					}
				} else if (left) {
					if (going_up) {
						// steer down and right
						boid.radians += params.edge_avoidance * delta
					} else {
						// steer up and right
						boid.radians -= params.edge_avoidance * delta
					}
				} else if (right) {
					if (going_up) {
						// steer down and left
						boid.radians -= params.edge_avoidance * delta
					} else {
						// steer up and left
						boid.radians += params.edge_avoidance * delta
					}
				}
				const [xSpeedNormal, ySpeedNormal] = angleToVector(boid.radians)
				boid.xSpeedNormal = xSpeedNormal
				boid.ySpeedNormal = ySpeedNormal
			} else {
				let xSpeedNormalSum = 0
				let ySpeedNormalSum = 0
				let inSightCount = 0
				let separationX = 0
				let separationY = 0
				let centerX = 0
				let centerY = 0

				queryCache.clear()
				const neighbors = tree.query(boid.x, boid.y, max, queryCache)

				for (const other of neighbors) {
					if (other === boid) continue
					const dx = other.x - boid.x
					const dy = other.y - boid.y
					const distance_sq = dx * dx + dy * dy
					if (distance_sq > max_sq) continue
					const distance = Math.sqrt(distance_sq)

					if (distance < params.sight) {
						inSightCount++

						xSpeedNormalSum += other.xSpeedNormal
						ySpeedNormalSum += other.ySpeedNormal

						centerX += other.x
						centerY += other.y
					}

					if (distance < params.space) {
						// Too close, steer away
						separationX -= dx
						separationY -= dy
					}
				}

				// (alignment) Neighbor average angle
				if (inSightCount > 0) {
					const influence = params.alignment * delta
					boid.xSpeedNormal = xSpeedNormalSum / inSightCount * influence + boid.xSpeedNormal * (1 - influence)
					boid.ySpeedNormal = ySpeedNormalSum / inSightCount * influence + boid.ySpeedNormal * (1 - influence)
				}

				// (separation) Steer to avoid crowding local flockmates
				if (separationX !== 0 || separationY !== 0) {
					const separationRadians = Math.atan2(separationY, separationX)
					const [separationXSpeedNormal, separationYSpeedNormal] = angleToVector(separationRadians)
					const influence = params.separation * delta
					boid.xSpeedNormal = separationXSpeedNormal * influence + boid.xSpeedNormal * (1 - influence)
					boid.ySpeedNormal = separationYSpeedNormal * influence + boid.ySpeedNormal * (1 - influence)
				}

				// (cohesion) Steer to move towards the average position of local flockmates
				if (inSightCount > 0) {
					centerX /= inSightCount
					centerY /= inSightCount
					const dx = centerX - boid.x
					const dy = centerY - boid.y

					const cohesionRadians = Math.atan2(dy, dx)
					const [cohesionXSpeedNormal, cohesionYSpeedNormal] = angleToVector(cohesionRadians)
					const influence = params.cohesion * delta
					boid.xSpeedNormal = cohesionXSpeedNormal * influence + boid.xSpeedNormal * (1 - influence)
					boid.ySpeedNormal = cohesionYSpeedNormal * influence + boid.ySpeedNormal * (1 - influence)
				}

				boid.radians = Math.atan2(boid.ySpeedNormal, boid.xSpeedNormal)
			}

			// Normalize speed
			const length = Math.hypot(boid.xSpeedNormal, boid.ySpeedNormal)
			if (length !== 1) {
				boid.xSpeedNormal /= length
				boid.ySpeedNormal /= length
			}

			// Update position
			boid.x += boid.xSpeedNormal * boid.speed * delta
			boid.y += boid.ySpeedNormal * boid.speed * delta

			// Out of bounds
			if (boid.x < 0) {
				boid.x = 0
			} else if (boid.x > side) {
				boid.x = side
			}
			if (boid.y < 0) {
				boid.y = 0
			} else if (boid.y > side) {
				boid.y = side
			}

			if (frame % 10 === 0)
				tree.update(boid)

			drawTriangle(boid.x, boid.y, boid.radians)
			if (params.draw_fov) {
				drawCircle(ctx, boid.x, boid.y, params.sight)
			}
		}
		if (params.draw_tree) {
			drawTree(ctx, tree)
		}
	})

	const controller = new AbortController()

	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			lastTime = 0
		}
	}, { signal: controller.signal })

	const onInput = () => {
		params.sight = getValue<number>(form, 'sight')!
		params.space = getValue<number>(form, 'space')!
		params.alignment = getValue<number>(form, 'alignment')!
		params.cohesion = getValue<number>(form, 'cohesion')!
		params.separation = getValue<number>(form, 'separation')!
		params.edge_avoidance = getValue<number>(form, 'edge_avoidance')!
		params.draw_tree = getValue<boolean>(form, 'draw_tree') ?? false
		params.draw_fov = getValue<boolean>(form, 'draw_fov') ?? false
	}
	onInput()
	form.addEventListener('input', onInput, { signal: controller.signal })

	return () => {
		cancelAnimationFrame(rafId)
		controller.abort()
	}
}

function angleToVector(radians: number): [xSpeedNormal: number, ySpeedNormal: number] {
	return [Math.cos(radians), Math.sin(radians)]
}

function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
	ctx.beginPath()
	ctx.arc(x, y, radius, 0, Math.PI * 2)
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
	ctx.lineWidth = 1
	ctx.stroke()
}

function getValue<T,>(form: HTMLFormElement, name: string): T | undefined {
	if (!(name in form.elements)) return undefined
	const element = form.elements[name as keyof typeof form.elements]
	if (element instanceof HTMLSelectElement) return element.value as T
	if (element instanceof HTMLInputElement) {
		if (element.type === 'range') {
			return element.valueAsNumber as T
		}
		if (element.type === 'checkbox') {
			return element.checked as T
		}
	}
}

export default function BoidsPage() {
	const ref = useRef<HTMLCanvasElement | null>(null)
	const formRef = useRef<HTMLFormElement | null>(null)
	const [fps, setFps] = useState(0)

	useEffect(() => {
		const canvas = ref.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return
		const form = formRef.current
		if (!form) return

		const side = 1600 * window.devicePixelRatio
		canvas.height = side
		canvas.width = side

		const sightInput = document.getElementById('sight') as HTMLInputElement
		sightInput.setAttribute('min', Number(sightInput.getAttribute('min')) * window.devicePixelRatio + '')
		sightInput.setAttribute('max', Number(sightInput.getAttribute('max')) * window.devicePixelRatio + '')
		sightInput.setAttribute('step', Number(sightInput.getAttribute('step')) * window.devicePixelRatio + '')
		sightInput.value = (Number(sightInput.value) * window.devicePixelRatio) + ''
		const spaceInput = document.getElementById('space') as HTMLInputElement
		spaceInput.setAttribute('min', Number(spaceInput.getAttribute('min')) * window.devicePixelRatio + '')
		spaceInput.setAttribute('max', Number(spaceInput.getAttribute('max')) * window.devicePixelRatio + '')
		spaceInput.setAttribute('step', Number(spaceInput.getAttribute('step')) * window.devicePixelRatio + '')
		spaceInput.value = (Number(spaceInput.value) * window.devicePixelRatio) + ''

		const frameCounter = makeFrameCounter()

		return start(ctx, form, side, (delta) => setFps(Math.round(frameCounter(delta))))
	}, [])

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<canvas width="1000" height="1000" ref={ref}>
				Your browser does not support the HTML5 canvas tag.
			</canvas>
			<form ref={formRef} className={styles.form}>
				<fieldset>
					<legend>Controls</legend>
					<label htmlFor="sight">Sight:</label>
					<input type="range" id="sight" name="sight" min="1" max="100" defaultValue={20} step="1" />
					<label htmlFor="space">Spacing:</label>
					<input type="range" id="space" name="space" min="1" max="100" defaultValue={10} step="1" />
					<hr />
					<label htmlFor="alignment">Alignment:</label>
					<input type="range" id="alignment" name="alignment" min="0" max="10" defaultValue={2.5} step="0.1" />
					<label htmlFor="cohesion">Cohesion:</label>
					<input type="range" id="cohesion" name="cohesion" min="0" max="10" defaultValue={1.3} step="0.1" />
					<label htmlFor="separation">Separation:</label>
					<input type="range" id="separation" name="separation" min="0" max="10" defaultValue={4} step="0.1" />
					<label htmlFor="edge_avoidance">Edge Avoidance:</label>
					<input type="range" id="edge_avoidance" name="edge_avoidance" min="0" max="10" defaultValue={3} step="0.1" />
					<hr />
					<label htmlFor="draw_tree">Draw Tree:
						<input type="checkbox" id="draw_tree" name="draw_tree" defaultChecked={false} />
					</label>
					<label htmlFor="draw_fov">Draw Field of View:
						<input type="checkbox" id="draw_fov" name="draw_fov" defaultChecked={false} />
					</label>
				</fieldset>
			</form>
			<div className={styles.stats}>
				<p>FPS: {fps}</p>
				<p>Boids: {COUNT}</p>
			</div>
		</div>
	)
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

/**
 * A simple frame counter that returns the average FPS over the last `over` frames.
 * @param over - The number of frames to average over.
 */
function makeFrameCounter(over: number = 30) {
	let pointer = 0
	let full = false
	const frames: number[] = Array(over).fill(0)

	/**
	 * @param delta - The time in seconds since the last frame.
	 * @returns The current frames per second (FPS) based on the average of the last `over` frames.
	 */
	return (delta: number): number => {
		frames[pointer] = delta
		pointer = (pointer + 1) % over
		if (pointer === 0) full = true
		const avg = full
			? frames.reduce((a, b) => a + b, 0) / over
			: frames.reduce((a, b, i) => i < pointer ? a + b : a, 0) / pointer
		const fps = 1 / avg
		return fps
	}
}