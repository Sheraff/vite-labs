import { useEffect, useRef } from "react"
import { Head } from "#components/Head"
import styles from './styles.module.css'
import type { RouteMeta } from "#router"

const SPIDER_WIDTH = 60
const SPIDER_LEG_LERP_DURATION = 400

export const meta: RouteMeta = {
	title: 'Spider Inverse Kinematics',
	image: './screen.png',
	tags: ['animation', 'procedural']
}

export default function SpiderIK() {
	const form = useRef<HTMLFormElement>(null)
	const canvas = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		if (!canvas.current || !form.current) return
		const ctx = canvas.current.getContext('2d')
		canvas.current.width = window.innerWidth
		canvas.current.height = window.innerHeight
		if (!ctx) throw new Error('No context found')
		const clear = start(ctx, form.current)
		return () => clear()
	}, [])

	return (
		<div className={styles.main}>
			<Head />
			<canvas ref={canvas}></canvas>
			<form ref={form}>
				<fieldset>
					<legend>options</legend>
					<label>
						<input type="checkbox" name="geometry" />
						show geometry
					</label>
					<label>
						<input type="range" name="elevation" min="35" max="120" defaultValue="65" />
						body elevation
					</label>
					<label>
						<input type="range" name="upper" min="40" max="100" defaultValue="65" />
						upper joint
					</label>
					<label>
						<input type="range" name="lower" min="60" max="150" defaultValue="115" />
						lower joint
					</label>
					<label>
						<input type="range" name="ground" min="0" max="4" defaultValue="2" />
						# of feet on the ground
					</label>
					<label>
						<input type="range" name="yOff" min="0" max="30" defaultValue="6" />
						height of feet off the ground
					</label>
				</fieldset>
			</form>
		</div>
	)
}

type Spider = {
	x: number
	y: number
	speed: number
	legs: Leg[]
}

type Leg = {
	x: number,
	y: number,
	direction: 1 | -1,
	lerp: null | {
		start: number,
		from: number,
		to: number,
	}
}

type MousePos = {
	x: number
	y: number
}

type UiFormData = {
	geometry: boolean,
	elevation: number,
	upper: number,
	lower: number,
	ground: number,
	yOff: number,
}

function start(ctx: CanvasRenderingContext2D, form: HTMLFormElement) {
	const formData = getFormData(form)

	const spider: Spider = {
		x: ctx.canvas.width / 2,
		y: ctx.canvas.height - formData.elevation,
		speed: 0,
		legs: [
			{ x: ctx.canvas.width / 2 - 40, y: ctx.canvas.height, direction: -1, lerp: null },
			{ x: ctx.canvas.width / 2 + 40, y: ctx.canvas.height, direction: 1, lerp: null },
			{ x: ctx.canvas.width / 2 - 80, y: ctx.canvas.height, direction: -1, lerp: null },
			{ x: ctx.canvas.width / 2 + 80, y: ctx.canvas.height, direction: 1, lerp: null },
			{ x: ctx.canvas.width / 2 - 120, y: ctx.canvas.height, direction: -1, lerp: null },
			{ x: ctx.canvas.width / 2 + 120, y: ctx.canvas.height, direction: 1, lerp: null },
			{ x: ctx.canvas.width / 2 - 160, y: ctx.canvas.height, direction: -1, lerp: null },
			{ x: ctx.canvas.width / 2 + 160, y: ctx.canvas.height, direction: 1, lerp: null },
		],
	}
	const mousePos: MousePos = {
		x: spider.x,
		y: spider.y,
	}

	const uiClear = ui(form, formData)
	const updateClear = update(ctx, mousePos, spider)
	const drawClear = draw(ctx, mousePos, formData, spider)

	return () => {
		uiClear()
		updateClear()
		drawClear()
	}
}


function ui(form: HTMLFormElement, formData: UiFormData) {
	const onInput = () => {
		Object.assign(formData, getFormData(form))
	}
	form.addEventListener('input', onInput)
	return () => form.removeEventListener('input', onInput)
}

function getFormData(form: HTMLFormElement): UiFormData {
	const elements = form.elements as HTMLFormControlsCollection & {
		geometry: HTMLInputElement,
		elevation: HTMLInputElement,
		upper: HTMLInputElement,
		lower: HTMLInputElement,
		ground: HTMLInputElement,
		yOff: HTMLInputElement,
	}
	return {
		geometry: elements.geometry.checked,
		elevation: Number(elements.elevation.value),
		upper: Number(elements.upper.value),
		lower: Number(elements.lower.value),
		ground: 4 - Number(elements.ground.value),
		yOff: Number(elements.yOff.value),
	}
}

function update(ctx: CanvasRenderingContext2D, mousePos: MousePos, spider: Spider) {
	const onPointerMove = (event: PointerEvent) => {
		mousePos.x = event.clientX
		mousePos.y = event.clientY
	}
	window.addEventListener('pointermove', onPointerMove)
	return () => window.removeEventListener('pointermove', onPointerMove)
}

function draw(ctx: CanvasRenderingContext2D, mousePos: MousePos, formData: UiFormData, spider: Spider) {
	let lastTime = 0
	let rafId = requestAnimationFrame(function loop(time) {
		rafId = requestAnimationFrame(loop)
		const delta = lastTime ? time - lastTime : 0
		lastTime = time
		const speed = (mousePos.x - spider.x) * delta / 1000
		spider.x += speed
		spider.y = ctx.canvas.height - formData.elevation - Math.sin(time / 400) * 3 + Math.sin(spider.x / 30) * 4
		updateSpiderLegs(ctx, mousePos, spider, formData, time, speed)
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
		drawSpider(ctx, spider, formData)
	})
	return () => cancelAnimationFrame(rafId)
}

function getLegShoulderX(spider: Spider, i: number) {
	const sideIndex = i >> 1
	const shoulderSpacing = SPIDER_WIDTH / (spider.legs.length + 1)
	const x = spider.x + spider.legs[i].direction * (shoulderSpacing / 2 + shoulderSpacing * sideIndex)
	return x
}

function updateSpiderLegs(ctx: CanvasRenderingContext2D, mousePos: MousePos, spider: Spider, formData: UiFormData, time: number, speed: number) {
	const currentDirection = mousePos.x > spider.x ? 1 : -1
	const maxDistance = formData.lower + formData.upper
	const speedWeight = formData.ground === 1 ? 1.9 : 0.675 // magic numbers
	const speedCoefficient = 1 / (1 + Math.abs(speed * speedWeight))
	const lerpDuration = SPIDER_LEG_LERP_DURATION * Math.min(1, speedCoefficient)
	spider.legs.forEach((leg, i) => {
		if (leg.lerp) {
			const delta = time - leg.lerp.start
			const t = delta / lerpDuration
			leg.x = lerp(leg.lerp.from, leg.lerp.to, t)
			leg.y = ctx.canvas.height - lerp(0, formData.yOff, t, easeSin)
			if (t >= 1) {
				leg.lerp = null
				leg.y = ctx.canvas.height
			}
			return
		}

		const direction = leg.direction
		const currentLerpsOnSide = spider.legs.reduce((sum, leg) => {
			if (direction === leg.direction && leg.lerp)
				sum += 1
			return sum
		}, 0)
		if (currentLerpsOnSide >= formData.ground) {
			return
		}

		const shoulderX = getLegShoulderX(spider, i)
		const sameDirection = currentDirection === leg.direction
		const sideIndex = i >> 1

		const distanceToShoulder = Math.hypot(leg.x - shoulderX, leg.y - spider.y)
		if (distanceToShoulder > maxDistance * 0.75 && !sameDirection) {
			const repositionBy = maxDistance * (-0.1 + sideIndex * 0.15)
			leg.lerp = {
				start: time,
				from: leg.x,
				to: shoulderX + leg.direction * repositionBy
			}
			return
		}

		const distanceToVertical = (leg.x - shoulderX) * leg.direction
		if (distanceToVertical < -0.05 && sameDirection) {
			const repositionBy = maxDistance * (0.7 + sideIndex * 0.085)
			leg.lerp = {
				start: time,
				from: leg.x,
				to: shoulderX + leg.direction * repositionBy
			}
			return
		}
	})
}

function drawSpider(ctx: CanvasRenderingContext2D, spider: Spider, formData: UiFormData) {
	ctx.fillStyle = '#000'
	ctx.save()
	ctx.translate(spider.x, spider.y)
	ctx.beginPath()
	ctx.arc(0, 0, SPIDER_WIDTH / 2, 0, Math.PI * 2)
	ctx.fill()
	ctx.restore()
	ctx.lineJoin = 'round'
	spider.legs.forEach((leg, i) => {
		ctx.strokeStyle = '#000'
		ctx.lineWidth = 2
		const shoulderX = getLegShoulderX(spider, i)
		const shoulderY = spider.y
		const legX = leg.x
		const legY = leg.y
		const elbow = inverseKinematicsWithTwoJoints(
			shoulderX,
			shoulderY,
			legX,
			legY,
			formData.upper,
			formData.lower,
			leg.direction
		)
		ctx.beginPath()
		ctx.moveTo(shoulderX, shoulderY)
		ctx.lineTo(elbow[0], elbow[1])
		ctx.lineTo(legX, legY)
		ctx.stroke()

		if (formData.geometry) {
			ctx.lineWidth = 1
			ctx.strokeStyle = leg.direction === 1 ? '#0907' : '#9007'
			ctx.beginPath()
			ctx.arc(shoulderX, shoulderY, formData.upper, 0, Math.PI * 2)
			ctx.stroke()

			ctx.strokeStyle = leg.direction === 1 ? '#0f07' : '#f007'
			ctx.beginPath()
			ctx.arc(legX, legY, formData.lower, 0, Math.PI * 2)
			ctx.stroke()
		}
	})
}

/**
 * @param from
 * @param to
 * @param t [0 - 1]
 * @param easing ([0-1]) -> [0-1]
 */
function lerp(from: number, to: number, t: number, easing: (t: number) => number = a => a) {
	return from + (to - from) * Math.min(1, easing(t))
}

function easeSin(t: number) {
	return Math.sin(t * Math.PI)
}

function inverseKinematicsWithTwoJoints(
	startX: number,
	startY: number,
	endX: number,
	endY: number,
	upperJointLength: number,
	lowerJointLength: number,
	direction: 1 | -1
): [number, number] {
	const d = Math.hypot(endY - startY, endX - startX)

	const startToHalfChord = (d ** 2 - lowerJointLength ** 2 + upperJointLength ** 2) / (2 * d)
	const angleFromStartToElbow = Math.acos(startToHalfChord / upperJointLength)
	const baseAngle = ((startX >= endX) === (direction === 1))
		? Math.acos((endY - startY) / d)
		: -Math.acos((endY - startY) / d)
	const angle = - baseAngle + angleFromStartToElbow + Math.PI / 2
	const elbowX = startX - upperJointLength * Math.cos(angle) * direction
	const elbowY = startY + upperJointLength * Math.sin(angle)
	return [elbowX, elbowY]
}