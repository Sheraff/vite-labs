/// <reference lib="webworker" />

type PaintSize = {
	height: number
	width: number
}

declare global {
	interface WorkerGlobalScope {
		registerPaint: (name: string, Class: {
			new(): object
		}) => void
	}
}

const self = globalThis as unknown as WorkerGlobalScope

export default self.registerPaint(
	"dotWaves",
	class {
		/*
		   define if alphatransparency is allowed alpha
		   is set to true by default. If set to false, all
		   colors used on the canvas will be fully opaque
		*/
		static get contextOptions() {
			return { alpha: true }
		}

		static get inputProperties() {
			return ["--time", "--color", "--alpha"]
		}

		// static get inputArguments() {
		// 	return ["length>", "<frequency>", "<color>"]
		// }

		radius = 1
		space = 30
		move = 2

		/*
			ctx is the 2D drawing context
			a subset of the HTML Canvas API.
		*/
		paint(context: CanvasRenderingContext2D, geom: PaintSize, props: StylePropertyMapReadOnly) {
			// console.log("painting", context, geom, props, args)

			const time = props.get('--time') as CSSUnitValue
			const t = (time?.value ?? 0) / 100 * 2 * Math.PI

			const color = props.get('--color') as CSSStyleValue
			context.fillStyle = color?.toString() ?? 'currentColor'

			const alpha = props.get('--alpha') as CSSUnitValue
			context.globalAlpha = alpha?.value ?? 1

			// context.translate(-this.space / 2, -this.space / 2)
			const centerX = geom.width / this.space / 2
			const centerY = geom.height / this.space / 2
			const max = Math.sqrt(Math.min(centerY * centerY, centerX * centerX))
			for (let x = -this.move; x < geom.width / this.space + this.move * 2; x += 1) {
				const dx = x - centerX
				const xx = dx * dx
				for (let y = -this.move; y < geom.height / this.space + this.move * 2; y += 1) {
					const dy = y - centerY
					const yy = dy * dy
					const distance = Math.sqrt(xx + yy)
					const dt = Math.abs(dx) + Math.abs(dy)
					const rx = dx / dt
					const ry = dy / dt
					const p = Math.sin(-t + distance / (1 + this.move))
					const wave = p * this.move * (0.2 + 0.8 * distance / max)
					context.beginPath()
					context.arc(
						(x + wave * rx) * this.space,
						(y + wave * ry) * this.space,
						this.radius * (1 + 0.6 * Math.max(0, p)),
						0,
						2 * Math.PI,
					)
					context.fill()
				}
			}

		}

	},
)