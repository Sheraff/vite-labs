import styles from './styles.module.css'
import { useEffect, useRef } from "react"
import { QuadTree } from "./QuadTree"
import { Head } from "#components/Head"
import type { RouteMeta } from "#router"

export const meta: RouteMeta = {
	title: 'Quad Tree',
	image: './screen.png',
	tags: ['data structures', '101']
}

const CURSOR_RADIUS = 300

export default function QuadTreePage() {
	const canvas = useRef<HTMLCanvasElement | null>(null)
	const form = useRef<HTMLFormElement | null>(null)

	useEffect(() => {
		if (!canvas.current || !form.current) return
		canvas.current.width = window.innerWidth * devicePixelRatio
		canvas.current.height = window.innerHeight * devicePixelRatio
		const ctx = canvas.current.getContext('2d')
		if (!ctx) throw new Error('No context found')

		const numberOfPoints = 2 * Math.round(Math.sqrt(window.innerWidth * window.innerHeight))
		const clear = start(ctx, numberOfPoints, form.current)
		return () => clear()
	}, [canvas, form])

	return (
		<div className={styles.main}>
			<Head />
			<canvas width="1000" height="1000" ref={canvas}>
				Your browser does not support the HTML5 canvas tag.
			</canvas>
			<form ref={form}>
				<fieldset>
					<legend>options</legend>
					<label>
						<input type="checkbox" name="geometry" />
						show geometry
					</label>
				</fieldset>
			</form>
		</div>
	)
}

type Point = {
	id: number,
	x: number,
	y: number,
	xSpeed: number,
	ySpeed: number,
	r: number,
}

type MousePos = {
	x: number,
	y: number,
	r: number,
}

type World = {
	points: Point[],
	tree: QuadTree<Point>,
	mousePos: MousePos,
	formData: ReturnType<typeof ui>[0],
}

function start(ctx: CanvasRenderingContext2D, count: number, form: HTMLFormElement) {
	const [formData, clearForm] = ui(form)
	const points: Point[] = Array(count).fill(0).map((_, id) => ({
		id,
		x: Math.random() * ctx.canvas.width,
		y: Math.random() * ctx.canvas.height,
		xSpeed: Math.random() * 2 - 1,
		ySpeed: Math.random() * 2 - 1,
		r: Math.random() * 2 + 1
	}))

	const tree = new QuadTree<Point>(0, 0, ctx.canvas.width, ctx.canvas.height)
	points.forEach(point => tree.insert(point))
	const mousePos: MousePos = {
		x: 200,
		y: 200,
		r: CURSOR_RADIUS,
	}
	const world: World = {
		points,
		tree,
		mousePos,
		formData,
	}
	const clearMouse = trackMousePos(ctx, world.mousePos)

	let rafId = requestAnimationFrame(function loop() {
		rafId = requestAnimationFrame(loop)
		const data = update(ctx, world)
		draw(ctx, world, data)
	})

	return () => {
		clearForm()
		clearMouse()
		cancelAnimationFrame(rafId)
	}
}

function ui(form: HTMLFormElement) {
	function getFormData() {
		return {
			geometry: 'geometry' in form.elements && form.elements.geometry instanceof HTMLInputElement ? form.elements.geometry.checked : false,
		}
	}
	const formData = getFormData()
	const onInput = () => {
		Object.assign(formData, getFormData())
	}
	form.addEventListener('input', onInput)
	return [formData, () => form.removeEventListener('input', onInput)] as const
}

function trackMousePos(ctx: CanvasRenderingContext2D, mousePos: MousePos) {
	const onMouseMove = (event: MouseEvent) => {
		mousePos.x = event.offsetX * devicePixelRatio
		mousePos.y = event.offsetY * devicePixelRatio
	}
	ctx.canvas.addEventListener('mousemove', onMouseMove)
	return () => ctx.canvas.removeEventListener('mousemove', onMouseMove)
}

function update(ctx: CanvasRenderingContext2D, world: World) {
	world.points.forEach(point => {
		point.x += point.xSpeed
		point.y += point.ySpeed
		world.tree.displace(point)
		if (point.x < 0 || point.x > ctx.canvas.width) {
			point.xSpeed *= -1
		}
		if (point.y < 0 || point.y > ctx.canvas.height) {
			point.ySpeed *= -1
		}
	})
	const candidates = world.tree.filter(
		(quadrant) => rectCircleOverlap(quadrant, world.mousePos)
	)
	const points = candidates
		.filter(
			point => Math.hypot(point.x - world.mousePos.x, point.y - world.mousePos.y) < world.mousePos.r
		)
	return { points, candidates }
}

function draw(ctx: CanvasRenderingContext2D, world: World, data: ReturnType<typeof update>) {
	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
	if (world.formData.geometry) {
		drawTree(ctx, world.tree)
		drawPoints(ctx, world.points)
	}
	drawPoints(ctx, data.candidates, '#808')
	drawPoints(ctx, data.points, '#0f0')
	if (world.formData.geometry) {
		drawMouse(ctx, world.mousePos)
	}
	drawConnections(ctx, data.points, world.tree)
}

function drawConnections(ctx: CanvasRenderingContext2D, points: Point[], tree: QuadTree) {
	const distance = 60
	ctx.save()
	points.forEach(point => {
		tree
			.filter(
				(quadrant) => rectCircleOverlap(quadrant, { ...point, r: distance })
			)
			.filter(
				neighbor => Math.hypot(neighbor.x - point.x, neighbor.y - point.y) < distance
			)
			.forEach(neighbor => {
				ctx.strokeStyle = `rgba(80,0,80,${Math.hypot(neighbor.x - point.x, neighbor.y - point.y) / distance / 2})`
				ctx.beginPath()
				ctx.moveTo(point.x, point.y)
				ctx.lineTo(neighbor.x, neighbor.y)
				ctx.stroke()
			})
	})
	ctx.restore()
}

function rectCircleOverlap(rect: QuadTree, circle: { x: number, y: number, r: number }) {
	// Find the nearest point on the rectangle to the center of the circle
	const x = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width))
	const y = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height))

	const dx = x - circle.x
	const dy = y - circle.y
	const r = circle.r

	return dx ** 2 + dy ** 2 <= r ** 2
}

function drawMouse(ctx: CanvasRenderingContext2D, mousePos: MousePos) {
	ctx.save()
	ctx.strokeStyle = '#0f0'
	ctx.beginPath()
	ctx.arc(mousePos.x, mousePos.y, mousePos.r, 0, Math.PI * 2)
	ctx.stroke()
	ctx.restore()
}

function drawPoints(ctx: CanvasRenderingContext2D, points: Point[], color = '#f00') {
	ctx.save()
	ctx.fillStyle = color
	points.forEach(point => {
		ctx.beginPath()
		ctx.arc(point.x, point.y, point.r, 0, Math.PI * 2)
		ctx.fill()
	})
	ctx.restore()
}

function drawTree(ctx: CanvasRenderingContext2D, tree: QuadTree) {
	ctx.save()
	ctx.strokeStyle = '#fff3'
	ctx.beginPath()
	ctx.rect(tree.x, tree.y, tree.width, tree.height)
	ctx.stroke()
	if (tree.nodes) {
		tree.nodes.forEach(node => {
			drawTree(ctx, node)
		})
	}
	ctx.restore()
}

// function drawBranch(ctx: CanvasRenderingContext2D, quadrant: QuadTree) {
// 	drawQuadrant(ctx, quadrant)
// 	if (quadrant.parent) {
// 		drawBranch(ctx, quadrant.parent)
// 	}
// }

// function drawQuadrant(ctx: CanvasRenderingContext2D, quadrant: QuadTree) {
// 	ctx.save()
// 	ctx.fillStyle = '#8085'
// 	// ctx.lineWidth = QuadTree.MAX_DEPTH - quadrant.depth
// 	ctx.beginPath()
// 	ctx.rect(quadrant.x, quadrant.y, quadrant.width, quadrant.height)
// 	ctx.fill()
// 	ctx.restore()
// }