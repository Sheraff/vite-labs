import styles from './styles.module.css'
import { useEffect, useRef } from "react"
import { Head } from "~/components/Head"
import type { RouteMeta } from "~/router"

export const meta: RouteMeta = {
	title: 'Lightning',
	image: './screen.png',
	tags: ['animation']
}

export default function Lightning() {
	const canvas = useRef<HTMLCanvasElement>(null)
	useEffect(() => {
		const el = canvas.current
		const ctx = el?.getContext('2d', { alpha: true })
		if (!el || !ctx) return
		el.width = el.scrollWidth * devicePixelRatio
		el.height = el.scrollHeight * devicePixelRatio
		const clear = animate(ctx)
		const observer = new ResizeObserver(() => {
			el.width = el.scrollWidth * devicePixelRatio
			el.height = el.scrollHeight * devicePixelRatio
		})
		observer.observe(el)
		return () => {
			clear()
			observer.disconnect()
		}
	}, [])
	return (
		<div className={styles.main}>
			<Head />
			<canvas ref={canvas} />
		</div>
	)
}

function animate(ctx: CanvasRenderingContext2D) {
	const fade = (delta: number, width: number, height: number) => {
		const fade = 1 - 0.09 * delta / 16.67
		ctx.fillStyle = `rgba(0, 0, 0, ${fade})` // Note that the colour here doesn't matter. Only the alpha matters.
		ctx.globalCompositeOperation = 'destination-in'
		ctx.fillRect(0, 0, width, height)
		ctx.globalCompositeOperation = 'source-over'
	}

	const makeArc = (a: [x: number, y: number], b: [x: number, y: number], options: {
		/** duration in ms between 2 new electrical arcs, actual value will be random in range `[<min>, <max>]` */
		impulseRange?: [min: number, max: number],
		/** distance in px between 2 points, actual value will be random in range `[<min>, <max>]` */
		pointsSpacingRange?: [min: number, max: number],
		/** random normal offset from straight line in px, actual value will be random in range `[-1, 1] * <value>` */
		normalRange?: number
		/** color of the arc */
		color?: string
		width?: number
	} = {}) => {
		const {
			impulseRange = [40, 150],
			pointsSpacingRange = [30, 40],
			normalRange = 20,
			color = 'rgb(255 255 200)',
			width = 1.5
		} = options
		let lastImpulse = 0
		return {
			a: { x: a[0], y: a[1] },
			b: { x: b[0], y: b[1] },
			draw(time: number) {
				if (!lastImpulse) lastImpulse = time

				const impulseDelta = time - lastImpulse

				const progress = (impulseDelta - impulseRange[0]) / (impulseRange[1] - impulseRange[0])
				if (progress <= 0) return

				const impulse = Math.random() < progress
				if (!impulse) return

				lastImpulse = time

				const distance = Math.sqrt((this.b.x - this.a.x) ** 2 + (this.b.y - this.a.y) ** 2)
				const ratioX = (this.b.x - this.a.x) / distance
				const ratioY = (this.b.y - this.a.y) / distance

				let d = 0
				let x = this.a.x
				let y = this.a.y
				const path = new Path2D()
				path.moveTo(this.a.x, this.a.y)
				while (true) {
					const next = d + Math.random() * (pointsSpacingRange[1] - pointsSpacingRange[0]) + pointsSpacingRange[0]
					if (next >= distance - pointsSpacingRange[0]) {
						path.lineTo(this.b.x, this.b.y)
						break
					}

					x = this.a.x + next * ratioX
					y = this.a.y + next * ratioY

					const normal = (Math.random() * 2 - 1) * normalRange
					path.lineTo(x + normal * ratioY, y - normal * ratioX)

					d = next

				}

				ctx.strokeStyle = color
				ctx.lineWidth = width
				ctx.stroke(path)
			}
		}
	}

	const { width, height } = ctx.canvas
	const arc = makeArc(
		[width / 4, height / 2],
		[3 * width / 4, 3 * height / 4],
	)
	const arcBlue = makeArc(
		[width / 4, height / 2],
		[3 * width / 4, 3 * height / 4],
		{ color: 'deepskyblue', impulseRange: [300, 500], normalRange: 15, width: 4 }
	)

	const arc2 = makeArc(
		[200, 400],
		[1000, 400],
		{ color: 'red' }
	)

	const arc3 = makeArc(
		[200, 400],
		[1000, 400],
		{ color: 'limegreen', impulseRange: [200, 400] }
	)
	const arc4 = makeArc(
		[200, 600],
		[1000, 600],
		{ color: 'purple', impulseRange: [20, 50] }
	)

	let last = 0
	let rafId = requestAnimationFrame(function step(time: DOMHighResTimeStamp) {
		rafId = requestAnimationFrame(step)
		const delta = time - last
		last = time
		if (!last) return

		const { width, height } = ctx.canvas

		// fade out previous image
		fade(delta, width, height)

		// draw lightning
		arc.a.x = width / 4
		arc.a.y = height / 2
		arc.b.x = 3 * width / 4
		arc.b.y = 3 * height / 4
		arcBlue.a.x = width / 4
		arcBlue.a.y = height / 2
		arcBlue.b.x = 3 * width / 4
		arcBlue.b.y = 3 * height / 4
		arc.draw(time)
		arcBlue.draw(time)

		arc2.draw(time)

		arc3.draw(time)
		arc4.draw(time)
	})
	return () => cancelAnimationFrame(rafId)
}