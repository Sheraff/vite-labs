import type { RouteMeta } from "#router"
import styles from './styles.module.css'
import { Head } from "#components/Head"
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react"

export const meta: RouteMeta = {
	title: 'CSS Cursor Tracking',
	image: './screen.png',
	tags: ['perspective', 'css', 'projection']
}

const SIDE = 13

export default function CSSCursorTrackingPage() {
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const el = ref.current
		if (!el) return
		const coords = {
			ne: document.getElementById(styles.northEast)!,
			nw: document.getElementById(styles.northWest)!,
			se: document.getElementById(styles.southEast)!,
			sw: document.getElementById(styles.southWest)!,
		}

		const controller = new AbortController()
		window.addEventListener('mousemove', (event) => {
			const mouse = { left: event.clientX, top: event.clientY }

			const { left: x, top: y } = project(
				coords.nw.getBoundingClientRect(),
				coords.ne.getBoundingClientRect(),
				coords.sw.getBoundingClientRect(),
				coords.se.getBoundingClientRect(),
				mouse
			)

			el.style.setProperty('--mx', Math.min(1, Math.max(-1, x)).toString())
			el.style.setProperty('--my', Math.min(1, Math.max(-1, y)).toString())

		}, { signal: controller.signal })
		return () => controller.abort()
	}, [])


	const formRef = useRef<HTMLFormElement>(null)
	useEffect(() => {
		const form = formRef.current
		if (!form) return
		const el = ref.current
		if (!el) return

		const controller = new AbortController()

		form.addEventListener('input', () => {
			const x = form.elements.namedItem('x') as HTMLInputElement
			const y = form.elements.namedItem('y') as HTMLInputElement
			const z = form.elements.namedItem('z') as HTMLInputElement

			el.style.setProperty('--rx', x.value)
			el.style.setProperty('--ry', y.value)
			el.style.setProperty('--rz', z.value)
		}, { signal: controller.signal })

		return () => controller.abort()
	}, [])


	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>

			<div className={styles.perspective}>
				<div ref={ref} className={styles.grid} style={{ '--side': SIDE } as React.CSSProperties}>
					{Array.from({ length: SIDE }, (_, y) => (
						<div key={y} className={styles.row} style={{ '--y': y / SIDE + 0.5 / SIDE } as React.CSSProperties}>
							{Array.from({ length: SIDE }, (_, x) => (
								<div key={x} className={styles.cell} style={{ '--x': x / SIDE + 0.5 / SIDE } as React.CSSProperties} />
							))}
						</div>
					))}
					<div id={styles.northWest} className={styles.bumper} />
					<div id={styles.northEast} className={styles.bumper} />
					<div id={styles.southWest} className={styles.bumper} />
					<div id={styles.southEast} className={styles.bumper} />
				</div>
			</div>

			{/* <form ref={formRef} className={styles.form}>
				<fieldset>
					<legend>Rotate</legend>
					<label htmlFor="input-x">X</label>
					<input type="range" min={-180} max={180} defaultValue={0} name="x" id="input-x" />
					<label htmlFor="input-y">Y</label>
					<input type="range" min={-180} max={180} defaultValue={0} name="y" id="input-y" />
					<label htmlFor="input-z">Z</label>
					<input type="range" min={-180} max={180} defaultValue={0} name="z" id="input-z" />
				</fieldset>
			</form> */}
		</div>
	)
}



type Point2D = { left: number, top: number }
/**
 * Calculate the relative position within the quadrilateral using bilinear interpolation
 * 
 * @description
 * Converts screen-space `mouse` coordinates to plane-space coordinates.
 * 
 * We know the screen-space coordinates of the four corners of the plane,
 * - north-west (0,0 in plane-space)
 * - north-east (1,0 in plane-space)
 * - south-west (0,1 in plane-space)
 * - south-east (1,1 in plane-space)
 * 
 * Return the coordinates of the mouse in plane-space.
 *
 * The progression along an axis is not linear (because of perspective).
 *
 */
function project(nw: Point2D, ne: Point2D, sw: Point2D, se: Point2D, mouse: Point2D): Point2D {
	// Iteratively solve for (u,v):
	// P(u,v) = mouse
	// P(u,v) = (1-u)(1-v)*nw + u(1-v)*ne + (1-u)v*sw + u*v*se

	let u = 0.5, v = 0.5 // Initial guess

	for (let i = 0; i < 10; i++) { // Newton-Raphson iterations
		// Current interpolated point
		const pLeft = (1 - u) * (1 - v) * nw.left + u * (1 - v) * ne.left + (1 - u) * v * sw.left + u * v * se.left
		const pTop = (1 - u) * (1 - v) * nw.top + u * (1 - v) * ne.top + (1 - u) * v * sw.top + u * v * se.top

		// Error
		const dx = mouse.left - pLeft
		const dy = mouse.top - pTop

		if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) break

		// Partial derivatives
		const dxdu = -(1 - v) * nw.left + (1 - v) * ne.left - v * sw.left + v * se.left
		const dxdv = -(1 - u) * nw.left - u * ne.left + (1 - u) * sw.left + u * se.left
		const dydu = -(1 - v) * nw.top + (1 - v) * ne.top - v * sw.top + v * se.top
		const dydv = -(1 - u) * nw.top - u * ne.top + (1 - u) * sw.top + u * se.top

		// Jacobian determinant
		const det = dxdu * dydv - dxdv * dydu
		if (Math.abs(det) < 1e-10) break

		// Newton-Raphson update
		const du = (dx * dydv - dy * dxdv) / det
		const dv = (dy * dxdu - dx * dydu) / det

		u = u + du
		v = v + dv
	}

	return { left: u, top: v }
}
