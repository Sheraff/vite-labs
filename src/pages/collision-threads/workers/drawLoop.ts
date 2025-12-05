import { client } from "./entities"

type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
type Contexts = { ui: Context; main: Context }

let side: number
let processUps: number

export function start(_side: number, _: Contexts) {
	side = _side
	client.init(side)
}

let fpsArray: number[] = []
let rafId: number
export function loop({ main, ui }: Contexts) {
	let lastTime = 0
	let lastMetricsPrint = lastTime
	let drawFps = 0
	const frame = () => {
		rafId = requestAnimationFrame((time) => {
			if (!lastTime) {
				lastTime = time
				return frame()
			}
			// timing
			const dt = (time - lastTime) / 1000
			lastTime = time

			const entities = client.get()

			// draw
			main.clearRect(0, 0, side, side)
			Object.values(entities).forEach((entity) => {
				entity.draw({ main, ui }, dt)
			})

			// metrics
			fpsArray.push(dt)
			if (time - lastMetricsPrint > 100) {
				lastMetricsPrint = time
				drawFps = Math.round(fpsArray.length / fpsArray.reduce((a, b) => a + b))
				if (fpsArray.length > 100) {
					fpsArray = fpsArray.slice(Math.max(0, fpsArray.length - 100))
				}
			}
			main.fillStyle = "white"
			main.font = "25px monospace"
			main.fillText(
				`step: ${processUps}ups - draw: ${drawFps}fps - count: ${entities.balls.getLastBall()}`,
				20,
				side - 20,
			)

			// next
			frame()
		})
	}
	frame()
}

export function updateUps(ups: number) {
	processUps = ups
}

export function pause() {
	cancelAnimationFrame(rafId)
}

export function play(contexts: Contexts) {
	loop(contexts)
}
