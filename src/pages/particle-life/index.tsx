import styles from './styles.module.css'
import { Head } from "#components/Head"
import type { RouteMeta } from "#router"
import { useEffect, useRef, useState } from "react"
import { getFormValue } from "#components/getFormValue"
import { TreeNode } from "#quad-tree-collisions/TreeNode"

export const meta: RouteMeta = {
	title: 'Particle Life',
	image: './screen.png',
	tags: ['wip']
}

type ColorDef = {
	count: number
	attractions: number[]
	index: number
	color: string
}

export default function ParticleLifePage() {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const formRef = useRef<HTMLFormElement>(null)

	const [colors, setColors] = useState(4)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext("2d")
		if (!ctx) return
		const form = formRef.current
		if (!form) return

		canvas.width = window.innerWidth * devicePixelRatio
		canvas.height = window.innerHeight * devicePixelRatio

		const controller = new AbortController()

		const state = {
			colors: [] as ColorDef[],
			repulse: {
				range: 10,
				strength: 30,
			},
			attract: {
				range: 40,
				strength: 30,
			},
			wallRepulse: {
				range: 50,
				strength: 90,
			},
		}

		const onInput = () => {
			const colors = Number(getFormValue<string>(form, 'colors'))
			const result = state.colors || []
			for (let i = 0; i < colors; i++) {
				const def = result[i] || { count: 0, attractions: [], index: i, color: COLORS[i % COLORS.length] }
				const count = getFormValue<number>(form, `particles_${i}_count`) || 0
				def.count = count
				for (let j = 0; j < colors; j++) {
					const attraction = getFormValue<number>(form, `attraction_${i}_${j}`) || 0
					def.attractions[j] = attraction
				}
				result[i] = def
			}
			result.length = colors
			state.colors = result

			state.repulse.range = getFormValue<number>(form, 'repulse_range') || 10
			state.repulse.strength = getFormValue<number>(form, 'repulse_strength') || 30
			state.attract.range = getFormValue<number>(form, 'attract_range') || 40
			state.attract.strength = getFormValue<number>(form, 'attract_strength') || 30
			state.wallRepulse.range = getFormValue<number>(form, 'wall_repulse_range') || 50
			state.wallRepulse.strength = getFormValue<number>(form, 'wall_repulse_strength') || 90
		}

		onInput()

		form.addEventListener('input', onInput, { signal: controller.signal })

		let stop = start(ctx, state)

		const restartButton = form.elements.namedItem('restart') as HTMLButtonElement
		restartButton.addEventListener('click', () => {
			stop?.()
			onInput()
			stop = start(ctx, state)
		}, { signal: controller.signal })

		const presetIdentityButton = form.elements.namedItem('preset-identity') as HTMLButtonElement
		presetIdentityButton.addEventListener('click', () => {
			const colors = state.colors.length
			for (let i = 0; i < colors; i++) {
				for (let j = 0; j < colors; j++) {
					const input = form.elements.namedItem(`attraction_${i}_${j}`) as HTMLInputElement
					input.value = i === j ? '1' : '0'
				}
			}
			onInput()
		}, { signal: controller.signal })

		const presetChainButton = form.elements.namedItem('preset-chain') as HTMLButtonElement
		presetChainButton.addEventListener('click', () => {
			const colors = state.colors.length
			for (let i = 0; i < colors; i++) {
				for (let j = 0; j < colors; j++) {
					const input = form.elements.namedItem(`attraction_${i}_${j}`) as HTMLInputElement
					if (j === (i + 1) % colors) {
						input.value = '0.8'
					} else if (i === j) {
						input.value = '0.5'
					} else if ((j + 1) % colors === i) {
						input.value = '-0.8'
					} else {
						input.value = '-0.2'
					}
				}
			}
			onInput()
		}, { signal: controller.signal })

		const presetRandomButton = form.elements.namedItem('preset-random') as HTMLButtonElement
		presetRandomButton.addEventListener('click', () => {
			const colors = state.colors.length
			for (let i = 0; i < colors; i++) {
				for (let j = 0; j < colors; j++) {
					const input = form.elements.namedItem(`attraction_${i}_${j}`) as HTMLInputElement
					const value = (Math.random() * 2 - 1).toFixed(2)
					input.value = value
				}
			}
			onInput()
		}, { signal: controller.signal })

		return () => {
			stop?.()
			controller.abort()
		}
	}, [])

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
				<form className={styles.controls} ref={formRef}>
					<fieldset>
						<legend>Particles</legend>
						<div className={styles.plusMinus}>
							<button type="button" name="minus" onClick={() => setColors(c => Math.max(c - 1, 1))}>-</button>
							<button type="button" name="plus" onClick={() => setColors(c => Math.min(c + 1, COLORS.length))}>+</button>
							<input type="hidden" name="colors" data-type="number" value={colors} ref={(e) => {
								if (!e) return
								e.dispatchEvent(new Event('input', { bubbles: true }))
							}} />
						</div>
						<table>
							<colgroup>
								<col span={1} width="0" />
							</colgroup>
							<tbody>
								{Array.from({ length: colors }).map((_, i) => (
									<tr key={i}>
										<th scope="row">
											<span className={styles.color} style={{ '--color': COLORS[i % COLORS.length] } as React.CSSProperties} />
										</th>
										<td>
											<input type="number" name={`particles_${i}_count`} defaultValue="2000" min="0" max="2000" step="1" />
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</fieldset>
					<fieldset>
						<legend>Attraction</legend>
						<table>
							<colgroup>
								<col span={1} width="0" />
							</colgroup>
							<thead>
								<tr>
									<th></th>
									{Array.from({ length: colors }).map((_, i) => (
										<th key={i}>
											<span className={styles.color} style={{ '--color': COLORS[i % COLORS.length] } as React.CSSProperties} />
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{Array.from({ length: colors }).map((_, i) => (
									<tr key={i}>
										<th scope="row">
											<span className={styles.color} style={{ '--color': COLORS[i % COLORS.length] } as React.CSSProperties} />
										</th>
										{Array.from({ length: colors }).map((_, j) => (
											<td key={j}>
												<input type="number" name={`attraction_${i}_${j}`} defaultValue={i === j ? "1" : "0"} step="0.1" min="-1" max="1" />
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
						<div className={styles.presets}>
							<span>Presets:</span>
							<button type="button" name="preset-identity">Identity</button>
							<button type="button" name="preset-chain">Chain</button>
							<button type="button" name="preset-random">Random</button>
						</div>
					</fieldset>
					<fieldset>
						<legend>Controls</legend>
						<table>
							<thead>
								<tr>
									<th></th>
									<th>Range</th>
									<th>Strength</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<th scope="row">Repulse</th>
									<td>
										<input type="range" name="repulse_range" defaultValue="10" min="0" max="100" step="1" />
									</td>
									<td>
										<input type="range" name="repulse_strength" defaultValue="30" min="0" max="100" step="1" />
									</td>
								</tr>
								<tr>
									<th scope="row">Attract</th>
									<td>
										<input type="range" name="attract_range" defaultValue="40" min="0" max="100" step="1" />
									</td>
									<td>
										<input type="range" name="attract_strength" defaultValue="30" min="0" max="100" step="1" />
									</td>
								</tr>
								<tr>
									<th scope="row">Wall Repulse</th>
									<td>
										<input type="range" name="wall_repulse_range" defaultValue="50" min="0" max="100" step="1" />
									</td>
									<td>
										<input type="range" name="wall_repulse_strength" defaultValue="90" min="0" max="100" step="1" />
									</td>
								</tr>
							</tbody>
						</table>
						<button type="button" name="restart">Restart simulation</button>
					</fieldset>
				</form>
			</div>
			<canvas ref={canvasRef}>
				Your browser does not support the HTML5 canvas tag.
			</canvas>
		</div>
	)
}



type Particle = {
	color: number
	x: number
	y: number
	vx: number
	vy: number
}

type AttractionDef = {
	range: number
	strength: number
}

function start(ctx: CanvasRenderingContext2D, state: {
	colors: ColorDef[]
	repulse: AttractionDef
	attract: AttractionDef
	wallRepulse: AttractionDef
}) {
	console.log('start', state)
	const width = ctx.canvas.width / devicePixelRatio
	const height = ctx.canvas.height / devicePixelRatio

	const particlesByColor = new Array<Particle[]>()
	const tree = new TreeNode<Particle>(0, 0, width, height, 8)

	let lastTime = 0
	let frameCount = 0
	let rafId = requestAnimationFrame(function loop(time) {
		rafId = requestAnimationFrame(loop)
		const dt = (time - lastTime) / 1000
		lastTime = time
		frameCount++
		if (dt > 1) return
		addRemoveParticles()
		update(dt, frameCount)
		draw()
	})


	return () => {
		cancelAnimationFrame(rafId)
	}

	function addRemoveParticles() {
		if (state.colors.length < particlesByColor.length) {
			for (let i = state.colors.length; i < particlesByColor.length; i++) {
				const particles = particlesByColor[i]
				for (const p of particles) {
					tree.remove(p)
				}
			}
			particlesByColor.length = state.colors.length
		}
		for (const color of state.colors) {
			const particles = (particlesByColor[color.index] ||= [])
			if (particles.length === color.count) continue
			if (particles.length > color.count) {
				for (let i = color.count; i < particles.length; i++) {
					tree.remove(particles[i])
				}
				particles.length = color.count
			} else {
				for (let i = particles.length; i < color.count; i++) {
					const p: Particle = {
						color: color.index,
						x: Math.random() * width,
						y: Math.random() * height,
						vx: 0,
						vy: 0,
					}
					particles.push(p)
					tree.insert(p)
				}
			}
		}
	}

	function update(dt: number, frame: number) {
		// constants
		const max = state.repulse.range + state.attract.range
		const repulse = state.repulse.range
		const peak = state.repulse.range + state.attract.range / 2
		const wallRepulse = state.wallRepulse.range
		const dampen = 0.95

		for (const particles of particlesByColor) {
			for (const p of particles) {
				const neighbors = tree.query(p.x, p.y, max)
				for (const n of neighbors) {
					if (n === p) continue

					const colorDef = state.colors[p.color]
					const attraction = colorDef.attractions[n.color]
					if (attraction === 0) continue

					const dx = n.x - p.x
					const dy = n.y - p.y
					const dist = Math.hypot(dx, dy)

					if (dist > max) continue

					if (dist < repulse) {
						// Repulse
						const power = (repulse - dist) / repulse
						const mult = attraction * power * dt * state.repulse.strength / dist
						p.vx -= dx * mult
						p.vy -= dy * mult
					} else {
						// Attract
						const power = Math.abs(dist - peak) / (max - peak)
						const mult = attraction * power * dt * state.attract.strength / dist
						p.vx += dx * mult
						p.vy += dy * mult
					}
				}

				// Repulse from walls
				left: {
					const dx = p.x - wallRepulse
					if (dx > 0) break left
					p.vx -= (dx / wallRepulse) * dt * state.wallRepulse.strength
				}
				right: {
					const dx = (width - p.x) - wallRepulse
					if (dx > 0) break right
					p.vx += (dx / wallRepulse) * dt * state.wallRepulse.strength
				}
				top: {
					const dy = p.y - wallRepulse
					if (dy > 0) break top
					p.vy -= (dy / wallRepulse) * dt * state.wallRepulse.strength
				}
				bottom: {
					const dy = (height - p.y) - wallRepulse
					if (dy > 0) break bottom
					p.vy += (dy / wallRepulse) * dt * state.wallRepulse.strength
				}

				// Dampen velocity
				p.vx *= dampen
				p.vy *= dampen
			}
		}

		const updateTree = frame % 10 === 0
		for (const particles of particlesByColor) {
			for (const p of particles) {
				p.x += p.vx * dt
				p.y += p.vy * dt

				if (updateTree) tree.update(p)
			}
		}
	}

	function draw() {
		ctx.clearRect(0, 0, width, height)
		for (const particles of particlesByColor) {
			for (const p of particles) {
				ctx.fillStyle = state.colors[p.color].color
				ctx.fillRect(p.x, p.y, 2, 2)
				// ctx.beginPath()
				// ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
				// ctx.fill()
			}
		}
	}
}


const COLORS = [
	'red',
	'orange',
	'yellow',
	'green',
	'blue',
	'indigo',
	'violet',
]

// Pythagorean theorem approximation
// https://stackoverflow.com/questions/3506404/fast-hypotenuse-algorithm-for-embedded-processor
// All these assume 0 ≤ a ≤ b.
// h = b + 0.337 * a                 // max error ≈ 5.5 %
// h = max(b, 0.918 * (b + (a>>1)))  // max error ≈ 2.6 %
// h = b + 0.428 * a * a / b         // max error ≈ 1.04 %
function fastHypot(x: number, y: number) {
	if (x > y) {
		return (x + 0.337 * y)
	}
	return (y + 0.337 * x)
}
