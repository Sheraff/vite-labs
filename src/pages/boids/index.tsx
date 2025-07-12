import type { RouteMeta } from "~/router"
import styles from './styles.module.css'
import { Head } from "~/components/Head"
import { useEffect, useRef } from "react"

export const meta: RouteMeta = {
	title: 'Boids',
	description: `
		Boids is an artificial life program which simulates the flocking behaviour of birds.
		It is an example of emergent behavior; that is, the complexity of Boids arises from the interaction of individual agents adhering to a set of simple rules.
	`,
	image: './screen.png'
}

/**
 * separation: steer to avoid crowding local flockmates
 * alignment: steer towards the average heading of local flockmates
 * cohesion: steer to move towards the average position (center of mass) of local flockmates
 */

function start(ctx: CanvasRenderingContext2D, form: HTMLFormElement, side: number): () => void {

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

	const boids: Boid[] = Array.from({ length: 2000 }, () => {
		const radians = Math.random() * Math.PI * 2
		const [xSpeedNormal, ySpeedNormal] = angleToVector(radians)
		const speed = (10 + Math.random() * 50) * window.devicePixelRatio
		const x = Math.random() * side
		const y = Math.random() * side
		return {
			x,
			y,
			radians,
			speed,
			xSpeedNormal,
			ySpeedNormal,
		}
	})

	const params = {
		sight: 50, // How far a boid can see
		space: 10, // How close boids can get before they start to separate
		alignment: 1,
		cohesion: 1,
		separation: 3,
		edge_avoidance: 3,
	}

	let lastTime = 0
	let rafId = requestAnimationFrame(function animate(time) {
		rafId = requestAnimationFrame(animate)
		const first = lastTime === 0
		const delta = (time - lastTime) / 1000
		lastTime = time
		if (first) return

		ctx.clearRect(0, 0, side, side)

		const max = Math.max(params.sight, params.space)

		for (const boid of boids) {
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

				for (const other of boids) {
					if (other === boid) continue
					const dx = other.x - boid.x
					if (dx > max || dx < -max) continue
					const dy = other.y - boid.y
					if (dy > max || dy < -max) continue
					const distance = Math.sqrt(dx * dx + dy * dy)
					if (distance > max) continue

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
					const x = xSpeedNormalSum / inSightCount * influence + boid.xSpeedNormal * (1 - influence)
					const y = ySpeedNormalSum / inSightCount * influence + boid.ySpeedNormal * (1 - influence)
					boid.radians = Math.atan2(y, x)
					const [xSpeedNormal, ySpeedNormal] = angleToVector(boid.radians)
					boid.xSpeedNormal = xSpeedNormal
					boid.ySpeedNormal = ySpeedNormal
				}

				// (separation) Steer to avoid crowding local flockmates
				if (separationX !== 0 || separationY !== 0) {
					const separationRadians = Math.atan2(separationY, separationX)
					const [separationXSpeedNormal, separationYSpeedNormal] = angleToVector(separationRadians)
					// Apply separation as a small adjustment to the boid's angle
					boid.xSpeedNormal += separationXSpeedNormal * params.separation * delta
					boid.ySpeedNormal += separationYSpeedNormal * params.separation * delta
					// Normalize the speed vector
					const length = Math.sqrt(boid.xSpeedNormal * boid.xSpeedNormal + boid.ySpeedNormal * boid.ySpeedNormal)
					if (length > 0) {
						boid.xSpeedNormal /= length
						boid.ySpeedNormal /= length
					}
				}

				// (cohesion) Steer to move towards the average position of local flockmates
				if (inSightCount > 0) {
					centerX /= inSightCount
					centerY /= inSightCount
					const dx = centerX - boid.x
					const dy = centerY - boid.y
					const distance = Math.sqrt(dx * dx + dy * dy)
					if (distance > 0) {
						const cohesionRadians = Math.atan2(dy, dx)
						const [cohesionXSpeedNormal, cohesionYSpeedNormal] = angleToVector(cohesionRadians)
						// Apply cohesion as a small adjustment to the boid's angle
						boid.xSpeedNormal += cohesionXSpeedNormal * params.cohesion * delta
						boid.ySpeedNormal += cohesionYSpeedNormal * params.cohesion * delta
						// Normalize the speed vector
						const length = Math.sqrt(boid.xSpeedNormal * boid.xSpeedNormal + boid.ySpeedNormal * boid.ySpeedNormal)
						if (length > 0) {
							boid.xSpeedNormal /= length
							boid.ySpeedNormal /= length
						}
					}
				}
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

			drawTriangle(ctx, boid.x, boid.y, boid.radians)
		}
	})

	const controller = new AbortController()

	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			lastTime = 0
		}
	}, { signal: controller.signal })

	form.addEventListener('input', () => {
		params.sight = getValue<number>(form, 'sight')!
		params.space = getValue<number>(form, 'space')!
		params.alignment = getValue<number>(form, 'alignment')!
		params.cohesion = getValue<number>(form, 'cohesion')!
		params.separation = getValue<number>(form, 'separation')!
		params.edge_avoidance = getValue<number>(form, 'edge_avoidance')!
	}, { signal: controller.signal })

	return () => {
		cancelAnimationFrame(rafId)
		controller.abort()
	}
}

function angleToVector(radians: number): [xSpeedNormal: number, ySpeedNormal: number] {
	return [Math.cos(radians), Math.sin(radians)]
}

function drawTriangle(ctx: CanvasRenderingContext2D, x: number, y: number, radians: number, size = 3 * window.devicePixelRatio) {
	ctx.save()
	ctx.translate(x, y)
	ctx.rotate(radians)
	ctx.beginPath()
	ctx.moveTo(size, 0)
	ctx.lineTo(-size, size / 2)
	ctx.lineTo(-size, -size / 2)
	ctx.closePath()
	ctx.fillStyle = 'white'
	ctx.fill()
	ctx.restore()
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

	useEffect(() => {
		const canvas = ref.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return
		const form = formRef.current
		if (!form) return

		const side = 1400 * window.devicePixelRatio
		canvas.height = side
		canvas.width = side

		return start(ctx, form, side)
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
					<input type="range" id="sight" name="sight" min="10" max="200" defaultValue={50} step="1" />
					<label htmlFor="space">Spacing:</label>
					<input type="range" id="space" name="space" min="1" max="100" defaultValue={10} step="1" />
					<hr />
					<label htmlFor="alignment">Alignment:</label>
					<input type="range" id="alignment" name="alignment" min="0" max="10" defaultValue={1} step="0.1" />
					<label htmlFor="cohesion">Cohesion:</label>
					<input type="range" id="cohesion" name="cohesion" min="0" max="10" defaultValue={1} step="0.1" />
					<label htmlFor="separation">Separation:</label>
					<input type="range" id="separation" name="separation" min="0" max="10" defaultValue={3} step="0.1" />
					<label htmlFor="edge_avoidance">Edge Avoidance:</label>
					<input type="range" id="edge_avoidance" name="edge_avoidance" min="0" max="10" defaultValue={3} step="0.1" />
				</fieldset>
			</form>
		</div>
	)
}
