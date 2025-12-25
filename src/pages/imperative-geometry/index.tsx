import type { RouteMeta } from "#router"

import { Head } from "#components/Head"
import { useEffect, useRef } from "react"

import styles from "./styles.module.css"

export const meta: RouteMeta = {
	title: "Imperative Geometry",
	tags: ["canvas"],
	image: "./screen.png",
}

const pi = Math.PI

export default function ImperativeGeometryPage() {
	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<div className={styles.content}>
				{/* <Fourteen /> */}
				<Two />
				<Three />
				{/* <Four /> */}
				<Five />
				<Six />
				<Thirteen />
				<Eight />
				<Nine />
				<Ten />
				<Seven />
				<Twelve />
				<Eleven />
			</div>
		</div>
	)
}

// function Fourteen() {
// 	const canvas = useRef<HTMLCanvasElement | null>(null)
// 	useEffect(() => {
// 		const d = new Drawing(canvas.current!)
			
// 		d.arcAt(40, 0, 40, -pi/7, 3*pi/2)
// 			.lineTo(160, 0)

// 		d.moveTo(80, 20).lineTo(180, 20)
// 		d.moveTo(90, 40).lineTo(190, 40)


// 		return d.play()
// 	}, [])
// 	return <canvas ref={canvas} />
// }

/** fifth element tablet */
function Thirteen() {
	const canvas = useRef<HTMLCanvasElement | null>(null)
	useEffect(() => {
		const d = new Drawing(canvas.current!).moveTo(0, 0)

		d.arcAt(40)
		d.moveTo(0, 0)

		d.angularLine(80, -pi / 3)
			.angularMove(18, -pi / 3)
			.angularLine(4, -pi / 3)
			.angularMove(18, -pi / 3)
			.angularLine(80, -pi / 3)
			.angularMove(18, -pi / 3)
			.angularLine(4, -pi / 3)
			.angularMove(18, -pi / 3)
			.angularLine(80, -pi / 3)

		d.arcAt(40)
		d.moveTo(160)

		d.angularLine(80, pi / 3)
			.angularMove(18, pi / 3)
			.angularLine(4, pi / 3)
			.angularMove(18, pi / 3)
			.angularLine(80, pi / 3)
			.angularMove(18, pi / 3)
			.angularLine(4, pi / 3)
			.angularMove(18, pi / 3)
			.angularLine(80, pi / 3)

		d.arcAt(40)
		d.moveTo(320)

		d.angularLine(80, pi)
			.angularMove(18, pi)
			.angularLine(4, pi)
			.angularMove(18, pi)
			.angularLine(80, pi)
			.angularMove(18, pi)
			.angularLine(4, pi)
			.angularMove(18, pi)
			.angularLine(80, pi)

		d.angularLine(70, -pi/6)
			.angularMove(18, -pi/6)
			.angularLine(4, -pi/6)
			.angularMove(18, -pi/6)
			.angularLine(30, -pi/6)
			.arc(10, -pi/6)
			.equilateral(20, -pi/3)
			.angularLine(180, -pi/6)

		d.moveTo(0,0).angularMove(320, -pi/3)

		d.angularLine(70, pi/2)
			.angularMove(18, pi/2)
			.angularLine(4, pi/2)
			.angularMove(18, pi/2)
			.angularLine(30, pi/2)
			.arc(10, pi/2)
			.equilateral(20, pi/3)
			.angularLine(180, pi/2)

		d.moveTo(0,0).angularMove(320, 0)

		d.angularLine(70, 7*pi/6)
		.angularMove(18, 7*pi/6)
			.angularLine(4, 7*pi/6)
			.angularMove(18, 7*pi/6)
			.angularLine(30, 7*pi/6)
			.arc(10, 7*pi/6)
			.equilateral(20, pi)
			.angularLine(180, 7*pi/6)


		return d.play()
	}, [])
	return <canvas ref={canvas} />
}

/** iridology bullshit symbols: southwind */
function Twelve() {
	const canvas = useRef<HTMLCanvasElement | null>(null)
	useEffect(() => {
		const d = new Drawing(canvas.current!)
			
		d.arcAt(40, 0, 40, -pi/7, 3*pi/2)
			.lineTo(160, 0)

		d.moveTo(80, 20).lineTo(180, 20)
		d.moveTo(90, 40).lineTo(190, 40)


		return d.play()
	}, [])
	return <canvas ref={canvas} />
}

/** iridology bullshit symbols: bamboo */
function Eleven() {
	const canvas = useRef<HTMLCanvasElement | null>(null)
	useEffect(() => {
		const d = new Drawing(canvas.current!)
			
		d.moveTo(0, 0).lineTo(0, 80)
		d.moveTo(20, -20).lineTo(20, 50).moveTo(20, 60).lineTo(20, 90)
		d.moveTo(40, 0).lineTo(40, 80)

		d.arcAt(40, 20, 80, pi+pi/9, 3*pi/2)
		d.arc(40, pi/2, pi/9)


		return d.play()
	}, [])
	return <canvas ref={canvas} />
}

/** iridology bullshit symbols: dune */
function Ten() {
	const canvas = useRef<HTMLCanvasElement | null>(null)
	useEffect(() => {
		const d = new Drawing(canvas.current!)
			
		d.moveTo(0, 0).lineTo(0, 60)
		d.moveTo(20, 0).lineTo(20, 60)
		d.moveTo(40, 0).lineTo(40, 60)

		d.moveTo(60, 0).lineTo(60, 60).arc(20, 0, pi/2)
		
		
		.lineTo(0, 80)
		.arc(20, -pi/2, -pi)
		.lineTo(-20, 160)
		
		d.moveTo(0, 100).lineTo(0, 160)
		d.moveTo(20, 100).lineTo(20, 160)
		d.moveTo(40, 100).lineTo(40, 160)


		// d.moveTo(10, 20).lineTo(-10, 30)
		// d.moveTo(50, 40).lineTo(30, 50)
		// d.moveTo(50, 45).lineTo(30, 55)

		// d.moveTo(30, 110).lineTo(10, 120)
		// d.moveTo(30, 115).lineTo(10, 125)
		// d.moveTo(30, 120).lineTo(10, 130)


		return d.play()
	}, [])
	return <canvas ref={canvas} />
}

function Nine() {
	const canvas = useRef<HTMLCanvasElement | null>(null)
	useEffect(() => {
		const d = new Drawing(canvas.current!)
			.moveTo(0, 0)

			.arc(100, (-5 * pi) / 8, (-3 * pi) / 8)
			.arc(100, (5 * pi) / 8, (3 * pi) / 8)
			.arcAt(20, 38, 0, pi + pi / 11, -pi / 11)
			.arcAt(20, 115, 0, -pi - pi / 11, pi / 11)
			.arcAt(8, 38, 0, pi + pi / 2.7, -pi / 2.7)
			.moveTo(107, 7)
			.lineTo(115, -5)
			.lineTo(123, 7)

		// d.lineTo(115, 20).lineTo(107, 7)

		// d.moveTo(0, -10).arc(100, -5*pi/8, -3*pi/8)
		// d.moveTo(0, -15).lineTo(76, -15)
		// d.moveTo(0, 10).arcMoveTo(100, -5*pi/8, -3*pi/8).arc(100, 5*pi/8, 3*pi/8)
		// d.moveTo(76, 20).lineTo(153, 20)

		// d.moveTo(76 / 20 * 0, -0).lineTo(76 / 20 * 0, -0 - 10)
		// d.moveTo(76 / 20 * 1, -1.5).lineTo(76 / 20 * 1, -1.5 - 10)
		// d.moveTo(76 / 20 * 2, -3).lineTo(76 / 20 * 2, -3 - 10)
		// d.moveTo(76 / 20 * 3, -4).lineTo(76 / 20 * 3, -4 - 10)
		// d.moveTo(76 / 20 * 4, -5).lineTo(76 / 20 * 4, -5 - 10)
		// d.moveTo(76 / 20 * 5, -6).lineTo(76 / 20 * 5, -6 - 10)
		// d.moveTo(76 / 20 * 6, -6.5).lineTo(76 / 20 * 6, -6.5 - 10)
		// d.moveTo(76 / 20 * 7, -6.75).lineTo(76 / 20 * 7, -6.75 - 10)
		// d.moveTo(76 / 20 * 8, -7).lineTo(76 / 20 * 8, -7 - 10)
		// d.moveTo(76 / 20 * 9, -7.25).lineTo(76 / 20 * 9, -7.25 - 10)
		// d.moveTo(76 / 20 * 10, -7.5).lineTo(76 / 20 * 10, -7.5 - 10)
		// d.moveTo(76 / 20 * 11, -7.25).lineTo(76 / 20 * 11, -7.25 - 10)
		// d.moveTo(76 / 20 * 12, -7).lineTo(76 / 20 * 12, -7 - 10)
		// d.moveTo(76 / 20 * 13, -6.75).lineTo(76 / 20 * 13, -6.75 - 10)
		// d.moveTo(76 / 20 * 14, -6.5).lineTo(76 / 20 * 14, -6.5 - 10)
		// d.moveTo(76 / 20 * 15, -6).lineTo(76 / 20 * 15, -6 - 10)
		// d.moveTo(76 / 20 * 16, -5).lineTo(76 / 20 * 16, -5 - 10)
		// d.moveTo(76 / 20 * 17, -4).lineTo(76 / 20 * 17, -4 - 10)
		// d.moveTo(76 / 20 * 18, -3).lineTo(76 / 20 * 18, -3 - 10)
		// d.moveTo(76 / 20 * 19, -1.5).lineTo(76 / 20 * 19, -1.5 - 10)
		// d.moveTo(76 / 20 * 20, -0).lineTo(76 / 20 * 20, -0 - 10)

		return d.play()
	}, [])
	return <canvas ref={canvas} />
}

function Eight() {
	const canvas = useRef<HTMLCanvasElement | null>(null)
	useEffect(() => {
		const d = new Drawing(canvas.current!).moveTo(0, 0)
		d.lineTo(0, -800)
			.lineTo(-20, -820)
			.lineTo(0, -840)
			.lineTo(-20, -860)
			.lineTo(0, -880)
			.lineTo(-20, -900)
			.lineTo(0, -920)

		d.moveTo(20, -60)
			.lineTo(20, -140)
			.lineTo(60, -200)
			.lineTo(60, -220)
			.equilateral(40, (-2 * pi) / 3)
			.moveTo(40, -270)
			.lineTo(80, -270)

		d.moveTo(-20, -200)
			.lineTo(-20, -280)
			.lineTo(-60, -320)
			.lineTo(-60, -340)
			.arc(20, pi / 2, -pi / 2)
			.arcAt(10, -60, -360)

		d.moveTo(20, -340)
			.lineTo(20, -420)
			.lineTo(60, -460)
			.lineTo(60, -540)
			.arc(5, pi / 2, (5 * pi) / 2)
			.lineTo(40, -520)
			.lineTo(40, -500)
			.arc(5, -pi / 2, (3 * pi) / 2)
			.moveTo(60, -540)
			.lineTo(80, -520)
			.lineTo(80, -500)
			.arc(5, -pi / 2, (3 * pi) / 2)

		d.moveTo(-20, -480)
			.lineTo(-20, -560)
			.lineTo(-60, -600)
			.lineTo(-60, -690)
			.arcAt(60, -60, -590, (-22 * pi) / 32, (-10 * pi) / 32)
			.arcAt(60, -60, -610, (-22 * pi) / 32, (-10 * pi) / 32)
			.arcAt(60, -60, -630, (-22 * pi) / 32, (-10 * pi) / 32)

		d.moveTo(20, -620)
			.lineTo(20, -700)
			.lineTo(60, -740)
			.lineTo(60, -760)
			.moveTo(40, -780)
			.lineTo(60, -760)
			.lineTo(80, -780)
			.moveTo(60, -780)
			.lineTo(80, -800)
			.lineTo(60, -820)
			.lineTo(40, -800)
			.lineTo(60, -780)

		return d.play()
	}, [])
	return <canvas ref={canvas} />
}

function Seven() {
	const canvas = useRef<HTMLCanvasElement | null>(null)
	useEffect(() => {
		const d = new Drawing(canvas.current!).moveTo(0, 0)
		// .arcAt(120)
		// .moveTo(0, -100).lineTo(0, 0)
		// .moveTo(0, 100).lineTo(0, 0)

		const from = -pi / 2
		const dist = pi / 2
		const intervals = 6
		for (let i = 0; i < intervals + (dist < 2 * pi ? 1 : 0); i++) {
			d.moveTo(0, -70)
				.arcMoveTo(70, from, from + (dist / intervals) * i)
				.lineTo(0, 0)

			d.moveTo(0, -70).arcMoveTo(70, from, from + (dist / intervals) * i)
			if (i % 2 === 0)
				d.arcAt(3, undefined, undefined, from + (dist / intervals) * i - pi / 2, from + (dist / intervals) * i + pi / 2)
			else d.arcAt(3)

			d.moveTo(0, 70)
				.arcMoveTo(70, -from, -from + (dist / intervals) * i)
				.lineTo(0, 0)

			d.moveTo(0, 70).arcMoveTo(70, -from, -from + (dist / intervals) * i)
			if (i % 2 === 1)
				d.arcAt(
					3,
					undefined,
					undefined,
					-from + (dist / intervals) * i - pi / 2,
					-from + (dist / intervals) * i + pi / 2,
				)
			else d.arcAt(3)
		}

		d
			// .arcAt(20, 50, 50)
			.arcAt(12, 50, 50)
			// .arcAt(5, 50, 50)
			.moveTo(50, 50)
			.lineTo(-50, -50)
			.equilateral(20, pi / 12)

		return d.play()
	}, [])
	return <canvas ref={canvas} />
}

function Two() {
	const canvas = useRef<HTMLCanvasElement | null>(null)
	useEffect(
		() =>
			new Drawing(canvas.current!)
				.moveTo(0, 0)
				.lineTo(0, 450)
				.moveTo(-20, 30)
				.lineTo(0, 0)
				.lineTo(20, 30)
				.moveTo(-20, 420)
				.lineTo(0, 450)
				.lineTo(20, 420)
				.moveTo(-20, 60)
				.lineTo(20, 60)
				.moveTo(-20, 70)
				.lineTo(20, 70)
				.moveTo(0, 90)
				.arc(20, -pi / 2, (3 * pi) / 2)
				.moveTo(-30, 170)
				.equilateral(60)
				.moveTo(0, 147)
				.arc(40, -pi / 2, (3 * pi) / 2)
				.moveTo(0, 240)
				.arc(20, -pi / 2, (3 * pi) / 2)
				.moveTo(-40, 310)
				.arc(80, (-2 * pi) / 3, -pi / 3)
				.moveTo(-40, 330)
				.arc(80, (-2 * pi) / 3, -pi / 3)
				.moveTo(-30, 350)
				.lineTo(30, 380)
				.moveTo(-30, 380)
				.lineTo(30, 350)
				.play(),
		[],
	)
	return <canvas ref={canvas} />
}

function Three() {
	const canvas = useRef<HTMLCanvasElement | null>(null)
	useEffect(
		() =>
			new Drawing(canvas.current!)
				// big triangle
				.moveTo(0, 0)
				.equilateral(200)
				// small triangle
				.moveTo(40, -20)
				.equilateral(120)
				// big diamond
				.moveTo(100, -20)
				.lineTo(130, 0)
				.lineTo(100, 53)
				.lineTo(70, 0)
				.lineTo(100, -20)
				// small diamond
				.lineTo(115, 0)
				.lineTo(100, 53)
				.lineTo(85, 0)
				.lineTo(100, -20)
				// bottom triangle
				.moveTo(85, 120)
				.equilateral(30)
				.moveTo(100, 120)
				.lineTo(100, 400)
				.moveTo(85, 180)
				.lineTo(115, 180)
				.moveTo(85, 190)
				.lineTo(115, 190)
				// dashed circle
				.moveTo(100, 230)
				.arc(20, -pi / 2, (3 * pi) / 2)
				.moveTo(100, 210)
				.arc(40, -pi / 2 + (pi / 8) * 0, -pi / 2 + (pi / 8) * 1)
				.arcMoveTo(40, -pi / 2 + (pi / 8) * 1, -pi / 2 + (pi / 8) * 2)
				.arc(40, -pi / 2 + (pi / 8) * 2, -pi / 2 + (pi / 8) * 3)
				.arcMoveTo(40, -pi / 2 + (pi / 8) * 3, -pi / 2 + (pi / 8) * 4)
				.arc(40, -pi / 2 + (pi / 8) * 4, -pi / 2 + (pi / 8) * 5)
				.arcMoveTo(40, -pi / 2 + (pi / 8) * 5, -pi / 2 + (pi / 8) * 6)
				.arc(40, -pi / 2 + (pi / 8) * 6, -pi / 2 + (pi / 8) * 7)
				.arcMoveTo(40, -pi / 2 + (pi / 8) * 7, -pi / 2 + (pi / 8) * 8)
				.arc(40, -pi / 2 + (pi / 8) * 8, -pi / 2 + (pi / 8) * 9)
				.arcMoveTo(40, -pi / 2 + (pi / 8) * 9, -pi / 2 + (pi / 8) * 10)
				.arc(40, -pi / 2 + (pi / 8) * 10, -pi / 2 + (pi / 8) * 11)
				.arcMoveTo(40, -pi / 2 + (pi / 8) * 11, -pi / 2 + (pi / 8) * 12)
				.arc(40, -pi / 2 + (pi / 8) * 12, -pi / 2 + (pi / 8) * 13)
				.arcMoveTo(40, -pi / 2 + (pi / 8) * 13, -pi / 2 + (pi / 8) * 14)
				.arc(40, -pi / 2 + (pi / 8) * 14, -pi / 2 + (pi / 8) * 15)
				.moveTo(115, 400)
				.equilateral(30, (-2 * pi) / 3, true)
				.play(),
		[],
	)
	return <canvas ref={canvas} />
}

function Four() {
	const canvas = useRef<HTMLCanvasElement | null>(null)
	useEffect(() => {
		const d = new Drawing(canvas.current!).moveTo(0, 0)

		const partial = Math.E
		for (let i = 0; i < 193; i++) {
			if (i % 2 === 0) {
				d.arc(200, (i * pi) / partial, ((i + 1) * pi) / partial)
			} else {
				d.arc(200, (i * pi) / partial + pi, ((i + 1) * pi) / partial + pi)
			}
		}

		return d.play(1000)
	}, [])
	return <canvas ref={canvas} />
}

function Five() {
	const canvas = useRef<HTMLCanvasElement | null>(null)
	useEffect(
		() =>
			new Drawing(canvas.current!)
				.moveTo(0, 0)
				.equilateral(300, pi / 3)
				.arc(150, -pi / 2, (3 * pi) / 2)
				.arcAt(20)
				.moveTo(-150, 150)
				.lineTo(-150, 400)
				.arcAt(20)
				.moveTo(150, 150)
				.lineTo(150, 400)
				.arcAt(20)
				.moveTo(-150, 150)
				.lineTo(150, 260)
				.lineTo(-100, 40)
				.arcAt(20)
				.arcAt(200, 0, 150, -pi / 2, 0)
				.arcAt(30, -150, 400, (3 * pi) / 2, 0)
				.arcAt(30, 150, 400, -pi / 2, pi)
				.play(),
		[],
	)
	return <canvas ref={canvas} />
}

function Six() {
	const canvas = useRef<HTMLCanvasElement | null>(null)
	useEffect(() => {
		const d = new Drawing(canvas.current!)
		// .moveTo(-200, 0)
		// .lineTo(200, 0)
		// .moveTo(-10, 0)
		// .lineTo(0, 0)
		// .arcAt(60)

		{
			const trim = pi / 7
			d.arcAt(150, 0, 0, trim - pi, -trim)
		}
		{
			const trim = pi / 3.8
			d.arcAt(200, 0, 82, trim - pi, -trim)
		}
		{
			const trim = pi / 2.75
			d.arcAt(50, 0, -92, (3 * pi) / 2 - trim, trim - pi / 2)
		}
		{
			const trim = pi / 5.7
			d.arcAt(30, 0, -92, (3 * pi) / 2 - trim, trim - pi / 2)
		}

		d.moveTo(20, -170)
			.equilateral(30, -0.8)
			.moveTo(-40, -191)
			.equilateral(30, 0.8)
			.moveTo(80, -150)
			.equilateral(30, -0.45)
			.moveTo(-105, -165)
			.equilateral(30, 0.45)

		d.moveTo(0, -90).equilateral(200, pi / 3)

		const y = -90 + 200 * Math.sin(pi / 3)

		d.arcAt(20, -100, y)
		d.arcAt(20, 100, y)

		d.arcAt(40, 0, y, pi / 2)
			.lineTo(0, 200)
			.arc(20, -pi / 2, -pi / 2 + 2 * pi)
			.moveTo(0, 240)
			.lineTo(0, 390)

		d.moveTo(30, 330).lineTo(-30, 340)
		d.moveTo(30, 350).lineTo(-30, 360)
		d.moveTo(30, 370).lineTo(-30, 380)

		return d.play()
	}, [])
	return <canvas ref={canvas} />
}

class Drawing {
	ctx
	speed = 200 // pixels per second
	padding = 20

	#plan: Array<(() => Generator<undefined, void, number>) | (() => void)> = []
	#history: Array<() => void> = []
	#bounds = { minX: Infinity, minY: Infinity, maxX: 0, maxY: 0 }
	#position = { x: 0, y: 0 }
	#scale = 1
	#offset = { x: 0, y: 0 }

	constructor(canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext("2d")
		if (!ctx) throw new Error("Failed to get 2D context")
		this.ctx = ctx
		ctx.canvas.width = canvas.clientWidth * devicePixelRatio
		ctx.canvas.height = canvas.clientHeight * devicePixelRatio
		ctx.scale(devicePixelRatio, devicePixelRatio)
		ctx.lineWidth = 2
		ctx.strokeStyle = "white"
	}

	#transform(x: number, y: number): { x: number; y: number } {
		return {
			x: (x - this.#bounds.minX) * this.#scale + this.#offset.x,
			y: (y - this.#bounds.minY) * this.#scale + this.#offset.y,
		}
	}

	angularMove(length: number, angle: number): this {
		const x = this.#position.x + length * Math.cos(angle)
		const y = this.#position.y + length * Math.sin(angle)
		return this.moveTo(x, y)
	}
	moveTo(x: number = this.#position.x, y: number = this.#position.y): this {
		this.#position.x = x
		this.#position.y = y
		this.#plan.push(() => this.#moveTo(x, y))
		return this
	}
	#moveTo(x: number, y: number) {
		const transformed = this.#transform(x, y)
		this.#position.x = transformed.x
		this.#position.y = transformed.y
	}

	angularLine(length: number, angle: number): this {
		const x = this.#position.x + length * Math.cos(angle)
		const y = this.#position.y + length * Math.sin(angle)
		return this.lineTo(x, y)
	}
	lineTo(x: number = this.#position.x, y: number = this.#position.y): this {
		this.#bounds.minX = Math.min(this.#bounds.minX, this.#position.x, x)
		this.#bounds.minY = Math.min(this.#bounds.minY, this.#position.y, y)
		this.#bounds.maxX = Math.max(this.#bounds.maxX, this.#position.x, x)
		this.#bounds.maxY = Math.max(this.#bounds.maxY, this.#position.y, y)
		this.#plan.push(() => this.#lineTo(x, y))
		this.#position.x = x
		this.#position.y = y
		return this
	}
	*#lineTo(x: number, y: number): Generator<undefined, void, number> {
		const state = { t: 0 }
		const x1 = this.#position.x
		const y1 = this.#position.y
		const transformed = this.#transform(x, y)
		const dist = Math.hypot(transformed.x - x1, transformed.y - y1)
		const totalTime = dist / this.speed
		while (state.t < totalTime) {
			const dt = yield
			state.t += dt
			const t = Math.min(state.t / totalTime, 1)
			const cx = x1 + (transformed.x - x1) * t
			const cy = y1 + (transformed.y - y1) * t
			this.ctx.beginPath()
			this.ctx.moveTo(x1, y1)
			this.ctx.lineTo(cx, cy)
			this.ctx.stroke()
		}
		this.#position.x = transformed.x
		this.#position.y = transformed.y
		this.#history.push(() => {
			this.ctx.beginPath()
			this.ctx.moveTo(x1, y1)
			this.ctx.lineTo(transformed.x, transformed.y)
			this.ctx.stroke()
		})
	}

	arcAt(
		radius: number,
		centerX: number = this.#position.x,
		centerY: number = this.#position.y,
		startAngle: number = 0,
		endAngle: number = startAngle + 2 * pi,
	): this {
		// start position
		const x = centerX + radius * Math.cos(startAngle)
		const y = centerY + radius * Math.sin(startAngle)
		this.moveTo(x, y)
		this.#arcWithCenter(radius, centerX, centerY, startAngle, endAngle)
		return this
	}

	arc(radius: number, startAngle: number = 0, endAngle: number = startAngle + 2 * pi): this {
		const x = this.#position.x
		const y = this.#position.y

		// Calculate center of the arc
		const cx = x - radius * Math.cos(startAngle)
		const cy = y - radius * Math.sin(startAngle)

		return this.#arcWithCenter(radius, cx, cy, startAngle, endAngle)
	}

	#arcWithCenter(radius: number, cx: number, cy: number, startAngle: number, endAngle: number): this {
		const x = this.#position.x
		const y = this.#position.y

		// Calculate end position
		const endX = cx + radius * Math.cos(endAngle)
		const endY = cy + radius * Math.sin(endAngle)

		// Determine the angular sweep and direction
		const angleDiff = endAngle - startAngle
		const isCounterClockwise = angleDiff < 0
		const absAngleDiff = Math.abs(angleDiff)

		// Check if arc crosses a specific angle
		const crossesAngle = (targetAngle: number) => {
			// Normalize all angles to handle wrapping
			const normalizeAngle = (angle: number) => {
				const normalized = angle % (2 * pi)
				return normalized < 0 ? normalized + 2 * pi : normalized
			}

			const normStart = normalizeAngle(startAngle)
			const normEnd = normalizeAngle(endAngle)
			const normTarget = normalizeAngle(targetAngle)

			// If we're doing a full circle or more, we cross everything
			if (absAngleDiff >= 2 * pi) return true

			if (isCounterClockwise) {
				// Counter-clockwise: going from start backwards to end
				if (normStart < normEnd) {
					// Wraps around 0: e.g., from 5π/4 to π/4 going backwards
					return normTarget >= normEnd && normTarget <= normStart
				} else {
					// Doesn't wrap: e.g., from π/4 to -π/4 (same as 7π/4)
					return normTarget <= normStart && normTarget >= normEnd
				}
			} else {
				// Clockwise: going from start forwards to end
				if (normStart > normEnd) {
					// Wraps around 0: e.g., from 5π/4 to π/4
					return normTarget >= normStart || normTarget <= normEnd
				} else {
					// Doesn't wrap: e.g., from π/4 to 3π/4
					return normTarget >= normStart && normTarget <= normEnd
				}
			}
		}

		// Start with start and end points
		let minX = Math.min(x, endX)
		let maxX = Math.max(x, endX)
		let minY = Math.min(y, endY)
		let maxY = Math.max(y, endY)

		// Check cardinal directions
		if (crossesAngle(0)) maxX = Math.max(maxX, cx + radius) // Right (0)
		if (crossesAngle(pi / 2)) maxY = Math.max(maxY, cy + radius) // Bottom (π/2)
		if (crossesAngle(pi)) minX = Math.min(minX, cx - radius) // Left (π)
		if (crossesAngle((3 * pi) / 2)) minY = Math.min(minY, cy - radius) // Top (3π/2)

		this.#bounds.minX = Math.min(this.#bounds.minX, minX)
		this.#bounds.minY = Math.min(this.#bounds.minY, minY)
		this.#bounds.maxX = Math.max(this.#bounds.maxX, maxX)
		this.#bounds.maxY = Math.max(this.#bounds.maxY, maxY)

		this.#plan.push(() => this.#arc(radius, cx, cy, startAngle, endAngle))
		this.#position.x = endX
		this.#position.y = endY
		return this
	}
	*#arc(
		radius: number,
		cx: number,
		cy: number,
		startAngle: number,
		endAngle: number,
	): Generator<undefined, void, number> {
		const state = { t: 0 }
		const scaledRadius = radius * this.#scale
		const transformedCenter = this.#transform(cx, cy)
		const centerX = transformedCenter.x
		const centerY = transformedCenter.y
		const angleDiff = endAngle - startAngle
		const arcLength = Math.abs(angleDiff) * scaledRadius
		const totalTime = arcLength / this.speed
		const direction = angleDiff < 0
		while (state.t < totalTime) {
			const dt = yield
			state.t += dt
			const t = Math.min(state.t / totalTime, 1)
			const angle = startAngle + angleDiff * t
			this.ctx.beginPath()
			this.ctx.moveTo(this.#position.x, this.#position.y)
			this.ctx.arc(centerX, centerY, scaledRadius, startAngle, angle, direction)
			this.ctx.stroke()
		}
		this.#position.x = centerX + scaledRadius * Math.cos(endAngle)
		this.#position.y = centerY + scaledRadius * Math.sin(endAngle)
		this.#history.push(() => {
			this.ctx.beginPath()
			this.ctx.arc(centerX, centerY, scaledRadius, startAngle, endAngle, direction)
			this.ctx.stroke()
		})
	}

	arcMoveTo(radius: number, startAngle: number = 0, endAngle: number = startAngle + 2 * pi): this {
		const x = this.#position.x
		const y = this.#position.y

		// Calculate center of the arc
		const cx = x - radius * Math.cos(startAngle)
		const cy = y - radius * Math.sin(startAngle)

		// Calculate end position
		const endX = cx + radius * Math.cos(endAngle)
		const endY = cy + radius * Math.sin(endAngle)

		this.#position.x = endX
		this.#position.y = endY
		this.#plan.push(() => this.#moveTo(endX, endY))
		return this
	}

	equilateral(sideLength: number, rotate: number = 0, counterClockwise: boolean = false): this {
		const angleIncrement = ((2 * pi) / 3) * (counterClockwise ? -1 : 1)
		for (let i = 0; i < 3; i++) {
			const angle = rotate + i * angleIncrement
			const x = this.#position.x + sideLength * Math.cos(angle)
			const y = this.#position.y + sideLength * Math.sin(angle)
			this.lineTo(x, y)
		}
		return this
	}

	*#play(): Generator<undefined, void, number> {
		for (const step of this.#plan) {
			const gen = step()
			if (gen) yield* gen
		}
	}
	play(speed = 300): () => void {
		const controller = new AbortController()

		// Calculate scale and offset for object-fit: contain
		const boundsWidth = this.#bounds.maxX - this.#bounds.minX
		const boundsHeight = this.#bounds.maxY - this.#bounds.minY
		const canvasWidth = this.ctx.canvas.width / devicePixelRatio - this.padding * 2
		const canvasHeight = this.ctx.canvas.height / devicePixelRatio - this.padding * 2

		this.#scale = Math.min(canvasWidth / boundsWidth, canvasHeight / boundsHeight)

		const scaledWidth = boundsWidth * this.#scale
		const scaledHeight = boundsHeight * this.#scale
		this.#offset.x = this.padding + (canvasWidth - scaledWidth) / 2
		this.#offset.y = this.padding + (canvasHeight - scaledHeight) / 2

		this.#position.x = 0
		this.#position.y = 0
		const generator = this.#play()

		if (speed > 0 && speed !== Infinity) {
			this.speed = speed
			let lastTime = performance.now()
			const frame = (time: number) => {
				if (controller.signal.aborted) return
				const delta = time - lastTime
				lastTime = time
				if (delta === time) return
				this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)
				for (const redraw of this.#history) redraw()
				const result = generator.next(delta / 1000)
				if (result.done) return
				requestAnimationFrame(frame)
			}
			requestAnimationFrame(frame)
		} else {
			while (!generator.next(Infinity).done) {
				/* empty */
			}
		}
		return () => controller.abort()
	}
}
