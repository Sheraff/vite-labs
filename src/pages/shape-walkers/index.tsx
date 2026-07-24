import type { RouteMeta } from "#router"

import { Head } from "#components/Head"
import { useEffect, useRef, useState } from "react"

import styles from "./styles.module.css"

export const meta: RouteMeta = {
	title: "Shape Walkers",
	image: "./screen.png",
	tags: ["canvas"],
}
export default function ShapeWalkersPage() {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current!

		const square = Math.min(window.innerWidth, window.innerHeight)

		canvas.width = square * devicePixelRatio
		canvas.height = square * devicePixelRatio
		canvas.style.width = `${square}px`
		canvas.style.height = `${square}px`

		const ctx = canvas.getContext("2d")!
		// ctx.scale(devicePixelRatio, devicePixelRatio)

		const controller = new AbortController()


		start({
			signal: controller.signal,
			ctx,
		})

		return () => {
			controller.abort()
		}
	}, [])

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<canvas ref={canvasRef} className={styles.canvas} />
		</div>
	)
}

const SIDE = 20
const MOVE_DURATION = 250
const MOVE_DELAY = [5, 20]
const CONNECTION_DIST = 2.5
const CONNECTION_WIDTH = 1

const SHAPES = [
	{
		name: 'square',
		count: 12,
		draw(ctx, x, y) {
			const w = ctx.canvas.width / SIDE
			ctx.strokeRect(x, y, w, w)
		},
	},
	{
		name: 'diamond',
		count: 8,
		draw(ctx, x, y) {
			const w = ctx.canvas.width / SIDE
			ctx.beginPath()
			ctx.moveTo(x+w/2, y)
			ctx.lineTo(x+w, y+w/2)
			ctx.lineTo(x+w/2, y+w)
			ctx.lineTo(x, y+w/2)
			ctx.closePath()
			ctx.stroke()
		},
	},
	{
		name: 'circle',
		count: 10,
		draw(ctx, x, y) {
			const w = ctx.canvas.width / SIDE
			ctx.beginPath()
			ctx.arc(x+w/2, y+w/2, w/2, 0, 2*Math.PI)
			ctx.closePath()
			ctx.stroke()
		},
	},
	{
		name: 'dot',
		count: 20,
		draw(ctx, x, y) {
			const w = ctx.canvas.width / SIDE
			ctx.beginPath()
			ctx.arc(x+w/2, y+w/2, w/6, 0, 2*Math.PI)
			ctx.closePath()
			ctx.fill()
		},
	}
] satisfies readonly ShapeProto[]

type ShapeProto = {
	name: string
	count: number
	draw: (ctx: CanvasRenderingContext2D, x: number, y: number) => void
}

function start(opts: {
	signal: AbortSignal,
	ctx: CanvasRenderingContext2D
}) {

	type Shape = {
		proto: ShapeProto,
		pos: [x: number, y: number],
		from: [t: number, cx: number, cy: number],
		to: [t: number, cx: number, cy: number],
		move: boolean
	}
	const shapes: Shape[] = []
	
	const w = opts.ctx.canvas.width
	const h = opts.ctx.canvas.height
	const cw = w / SIDE
	const ch = h / SIDE
	const connectionDistance = Math.max(CONNECTION_DIST, 1) * cw

	for (const proto of SHAPES) {
		const taken = new Set<number>()
		for (let i = 0; i < proto.count; i++) {
			let x, y, j
			do {
				x = Math.floor(Math.random() * SIDE)
				y = Math.floor(Math.random() * SIDE)
				j = x * SIDE + y
			} while (taken.has(j))
			taken.add(j)
			shapes.push({
				proto,
				pos: [x * cw, y * ch],
				from: [0, x, y],
				to: [0, x, y],
				move: false
			})
		}
	}

	let nextMoveT = 0

	let rafId = requestAnimationFrame(function loop(t) {
		rafId = requestAnimationFrame(loop)

		// init move
		if (nextMoveT <= t) {
			nextMoveT = t + Math.random() * (MOVE_DELAY[1] - MOVE_DELAY[0]) + MOVE_DELAY[0]
			let shape
			do {
				shape = shapes[Math.floor(Math.random() * shapes.length)]
			} while (shape.move)
			const end = t + MOVE_DURATION
			shape.move = true
			shape.from = [t, shape.to[1], shape.to[2]]
			do {
				const dir = Math.floor(Math.random() * 4)
				switch (dir) {
					case 0: shape.to = [end, shape.from[1], shape.from[2] - 1]; break
					case 1: shape.to = [end, shape.from[1], shape.from[2] + 1]; break
					case 2: shape.to = [end, shape.from[1] - 1, shape.from[2]]; break
					case 3: shape.to = [end, shape.from[1] + 1, shape.from[2]]; break
				}
			} while (shape.to[1] < 0 || shape.to[1] >= SIDE || shape.to[2] < 0 || shape.to[2] >= SIDE)
		}

		// move
		for (const shape of shapes) {
			if (!shape.move) continue
			let dt = (t - shape.from[0]) / (shape.to[0] - shape.from[0])
			if (dt >= 1) {
				dt = 1
				shape.move = false
			}
			shape.pos[0] = (shape.from[1] + (shape.to[1] - shape.from[1]) * dt) * cw
			shape.pos[1] = (shape.from[2] + (shape.to[2] - shape.from[2]) * dt) * ch
		}
		
		// draw
		opts.ctx.clearRect(0, 0, w, h)
		opts.ctx.strokeStyle = 'white'
		opts.ctx.lineWidth = 2
		opts.ctx.fillStyle = 'white'
		for (const shape of shapes) {
			shape.proto.draw(opts.ctx, shape.pos[0], shape.pos[1])
		}

		// connections
		for (let i = 0; i < shapes.length - 1; i++) {
			const [x1, y1] = shapes[i].pos
			for (let j = i + 1; j < shapes.length; j++) {
				const [x2, y2] = shapes[j].pos
				const d = Math.hypot(x1 - x2, y1 - y2)
				if (d > connectionDistance) continue
				const dt = (d - cw) / (connectionDistance - cw)
				opts.ctx.lineWidth = CONNECTION_WIDTH * (1 - dt)
				opts.ctx.beginPath()
				opts.ctx.moveTo(x1 + cw/2, y1 + ch/2)
				opts.ctx.lineTo(x2 + cw/2, y2 + ch/2)
				opts.ctx.stroke()
			}
		}
	})

	opts.signal.addEventListener('abort', () => {
		cancelAnimationFrame(rafId)
	}, {once: true})
}