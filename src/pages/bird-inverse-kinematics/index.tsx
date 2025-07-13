import { useEffect, useRef } from "react"
import { Head } from "~/components/Head"
import styles from './styles.module.css'
import type { RouteMeta } from "~/router"
import { Vector } from "@bird-inverse-kinematics/Vector"

const UPPER_ARM_LENGTH = 55
const FOREARM_LENGTH = 70
const FOOT_HEIGHT = 6
const BODY_RADIUS = 22
const BEAK_LENGTH = 40
const STEP_DURATION = 400
const WORLD_TIME_SPEED = 1
const BIRD_MAX_SPEED = 12

export const meta: RouteMeta = {
	title: 'Bird Inverse Kinematics',
	image: './screen.png',
	tags: ['animation', 'procedural']
}

export default function () {
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

export type Bird = {
	direction: 1 | -1
	speed: number
	pos: Vector
	feet: [Foot, Foot]
	head: Head
	shoulder: Vector
	neck: Vector
}

type Foot = {
	pos: Vector
	lerp: null | Lerp
}

type Head = {
	pos: Vector
	nape: Vector
	sternum: Vector
	lerp: null | Lerp
}

type Lerp = {
	start: number
	end: number
	from: Vector
	to: Vector
	meta?: any
}

type Markers = Vector[] & {
	speedRatio?: number
}



function start(ctx: CanvasRenderingContext2D, form: HTMLFormElement) {
	const formData = getFormData(form)

	const startX = ctx.canvas.width / 2
	const startY = ctx.canvas.height - (UPPER_ARM_LENGTH + FOREARM_LENGTH) * .8

	const bird: Bird = {
		direction: 1,
		speed: 0,
		pos: new Vector(startX, startY),
		feet: [
			{
				pos: new Vector(startX, ctx.canvas.height - FOOT_HEIGHT),
				lerp: null,
			},
			{
				pos: new Vector(startX + BODY_RADIUS * 2, ctx.canvas.height - FOOT_HEIGHT),
				lerp: null,
			},
		],
		head: {
			pos: new Vector(startX + BODY_RADIUS, startY - (UPPER_ARM_LENGTH + FOREARM_LENGTH) * .75),
			nape: new Vector(-BODY_RADIUS * 2, (UPPER_ARM_LENGTH + FOREARM_LENGTH) * .2),
			sternum: new Vector(-BODY_RADIUS * 2, BODY_RADIUS * 2),
			lerp: null,
		},
		shoulder: new Vector(
			startX - 1 * BODY_RADIUS / 2,
			startY + BODY_RADIUS
		),
		neck: new Vector(
			startX + 1 * BODY_RADIUS * Math.cos(Math.PI / 4),
			startY - BODY_RADIUS * Math.cos(Math.PI / 4),
		),
	}

	const markers: Markers = []
	for (let i = 0; i < ctx.canvas.width; i += ctx.canvas.width / 20) {
		markers.push(new Vector(i, ctx.canvas.height / 2))
	}

	const mousePos = new Vector(bird.pos.x + 1, bird.pos.y)
	const uiClear = ui(form, formData)
	const updateClear = update(ctx, mousePos, bird, markers)
	const drawClear = draw(ctx, mousePos, bird, markers, formData)

	return () => {
		uiClear()
		updateClear()
		drawClear()
	}
}

type FormData = {
	geometry: boolean
}

function getFormData(form: HTMLFormElement): FormData {
	const elements = form.elements as HTMLFormControlsCollection & {
		geometry: HTMLInputElement
	}
	return {
		geometry: elements.geometry.checked,
	}
}

function ui(form: HTMLFormElement, formData: FormData) {
	const onInput = () => {
		Object.assign(formData, getFormData(form))
	}
	form.addEventListener('input', onInput)
	return () => form.removeEventListener('input', onInput)
}


function update(ctx: CanvasRenderingContext2D, mousePos: Vector, bird: Bird, markers: Markers) {
	const onPointerMove = (event: PointerEvent) => {
		mousePos.x = event.clientX
		mousePos.y = event.clientY
	}
	window.addEventListener('pointermove', onPointerMove)
	let lastTime = 0
	let rafId = requestAnimationFrame(function loop(time) {
		rafId = requestAnimationFrame(loop)
		const modifiedTime = time * WORLD_TIME_SPEED
		const delta = lastTime ? modifiedTime - lastTime : 0
		lastTime = modifiedTime
		updateBird(mousePos, bird, delta, modifiedTime, ctx)

		// infinite scroll
		{
			if (
				(bird.pos.x > ctx.canvas.width - 400 && bird.direction === 1)
				|| (bird.pos.x < 400 && bird.direction === -1)
			) {
				const infiniteScrollSpeedMultiplier = bird.direction === 1
					? 200 / (ctx.canvas.width - bird.pos.x)
					: 200 / bird.pos.x
				const offset = bird.speed * infiniteScrollSpeedMultiplier

				// bird
				bird.pos.x -= offset
				bird.feet.forEach(foot => {
					foot.pos.x -= offset
					if (foot.lerp) {
						foot.lerp.from.x -= offset
						foot.lerp.to.x -= offset
						foot.lerp.meta.bodyX -= offset
					}
				})
				bird.head.pos.x -= offset
				if (bird.head.lerp) {
					bird.head.lerp.from.x -= offset
					bird.head.lerp.to.x -= offset
				}
				bird.shoulder.x -= offset
				bird.neck.x -= offset

				// markers
				markers.speedRatio = Math.abs(offset / BIRD_MAX_SPEED)
				markers.forEach(marker => {
					marker.x += ctx.canvas.width - offset
					marker.x %= ctx.canvas.width
				})
			} else {
				markers.speedRatio = 0
			}
		}
	})
	return () => {
		window.removeEventListener('pointermove', onPointerMove)
		cancelAnimationFrame(rafId)
	}
}

function draw(ctx: CanvasRenderingContext2D, mousePos: Vector, bird: Bird, markers: Markers, formData: FormData) {
	let rafId = requestAnimationFrame(function loop() {
		rafId = requestAnimationFrame(loop)
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
		drawBird(ctx, bird, mousePos, formData)
		ctx.fillStyle = `#777${(((markers.speedRatio ?? 0) * 16) | 0).toString(16)}`
		ctx.beginPath()
		markers.forEach((vec) => {
			ctx.moveTo(0, 0)
			arcVec(ctx, vec, 5, 0, Math.PI * 2)
		})
		ctx.fill()
	})
	return () => cancelAnimationFrame(rafId)
}

function updateBird(mousePos: Vector, bird: Bird, dt: number, time: number, ctx: CanvasRenderingContext2D) {
	bird.speed *= .95 ** (dt / 1000 * 60)
	const groundedCount = Number(!bird.feet[0].lerp) + Number(!bird.feet[1].lerp)
	if (groundedCount > 0) {
		const mouseDelta = mousePos.x - bird.pos.x
		if (Math.abs(mouseDelta) > 50) {
			const maxSpeedImpulse = 150 + Math.max(0, Math.abs(bird.speed) - 4) * 50
			const clampedMouseDelta = Math.sign(mouseDelta) * Math.min(maxSpeedImpulse, Math.abs(mouseDelta))
			bird.speed += clampedMouseDelta / 8 * groundedCount ** 1.5 * dt / 1000
		}
	}
	bird.speed = Math.sign(bird.speed) * Math.min(BIRD_MAX_SPEED, Math.abs(bird.speed))
	const direction = Math.sign(bird.speed) as -1 | 1 || 1
	const reverse = bird.direction !== direction
	const isRunning = Math.abs(bird.speed) >= 7

	// Update body
	{
		bird.pos.x += bird.speed
		bird.direction = direction
		bird.pos.y = ctx.canvas.height - (UPPER_ARM_LENGTH + FOREARM_LENGTH) * .8 - Math.sin(time / 500) * 5 + Math.abs(bird.speed) * 3
		bird.shoulder.x = bird.pos.x - bird.direction * BODY_RADIUS / 2
		bird.shoulder.y = bird.pos.y + BODY_RADIUS
	}

	// Update feet
	{
		const furthest = (bird.feet[0].pos.x < bird.feet[1].pos.x) === (bird.direction === 1)
			? 0 : 1
		bird.feet.forEach((foot, i) => {
			const other = bird.feet[i === 0 ? 1 : 0]
			const distanceToShoulder = bird.shoulder.dist(foot.pos)
			if (
				!foot.lerp
				&& (
					distanceToShoulder > .98 * (UPPER_ARM_LENGTH + FOREARM_LENGTH)
					|| (
						!isRunning
						&& i === furthest
						&& !other.lerp
						&& Math.abs(bird.shoulder.x - foot.pos.x) > BODY_RADIUS * 2
					)
					|| (
						isRunning
						&& (
							!other.lerp
							|| time - other.lerp.start > 0.9 * (other.lerp.end - other.lerp.start)
						)
						&& distanceToShoulder > (UPPER_ARM_LENGTH + FOREARM_LENGTH) * Math.min(1, Math.abs(bird.speed) / 7)
					)
				)
			) {
				let end
				if (distanceToShoulder > .95 * (UPPER_ARM_LENGTH + FOREARM_LENGTH)) {
					end = time + STEP_DURATION / Math.max(1, Math.abs(bird.speed) / 3)
					// if(!isRunning)
					// 	end = time + STEP_DURATION / Math.max(1, Math.abs(bird.speed) / 3) // favor running
					// else
					// 	end = time + STEP_DURATION / Math.max(1, Math.abs(bird.speed) / 5) // favor jumping
				} else
					end = time + STEP_DURATION / Math.max(1, Math.abs(bird.speed) / 4)
				foot.lerp = {
					start: time,
					end,
					from: new Vector(foot.pos.x, ctx.canvas.height - FOOT_HEIGHT),
					to: new Vector(
						bird.shoulder.x + bird.direction * BODY_RADIUS * (1 - Math.abs(bird.speed / 5)),
						ctx.canvas.height - FOOT_HEIGHT - 30 + Math.abs(bird.speed),
					),
					meta: {
						bodyX: bird.pos.x,
					}
				}
			}
			if (foot.lerp) {
				const t = (time - foot.lerp.start) / (foot.lerp.end - foot.lerp.start)
				if (t >= 1) {
					foot.pos.x = (bird.pos.x - foot.lerp.meta.bodyX) + foot.lerp.to.x
					foot.pos.y = foot.lerp.from.y
					foot.lerp = null
				} else {
					foot.pos.x = (bird.pos.x - foot.lerp.meta.bodyX) + lerp(foot.lerp.from.x, foot.lerp.to.x, t)
					foot.pos.y = lerp(foot.lerp.from.y, foot.lerp.to.y, t, easeSin)
				}
			}
		})
	}

	// Update head
	{
		if (reverse) {
			bird.head.lerp = null
			bird.head.pos.x = bird.pos.x
		}
		bird.head.pos.y = bird.pos.y - (UPPER_ARM_LENGTH + FOREARM_LENGTH) * .65 + Math.sin(time / 500 - 300) * 7 + Math.abs(bird.speed) * 3

		const neckSpeedCoef = (1 - Math.abs(bird.speed) / 12)
		bird.neck.x = bird.pos.x + bird.direction * BODY_RADIUS * Math.cos(Math.PI / 3 * neckSpeedCoef)
		bird.neck.y = bird.pos.y - BODY_RADIUS * Math.sin(Math.PI / 3 * neckSpeedCoef)

		const headToNeckDistance = (bird.head.pos.x > bird.neck.x) !== (bird.direction === 1)
			? 0
			: Math.max(0, Math.abs(bird.head.pos.x - bird.neck.x) - 40)
		bird.head.sternum.x = BODY_RADIUS * (-2 - headToNeckDistance / 25) - Math.sin(time / 500) * 5
		bird.head.sternum.y = BODY_RADIUS * (2 - headToNeckDistance / 25)
		bird.head.nape.x = BODY_RADIUS * (-3 - headToNeckDistance / 25) - Math.sin(time / 500 - 300) * 7
		bird.head.nape.y = (UPPER_ARM_LENGTH + FOREARM_LENGTH) * .4 - BODY_RADIUS * headToNeckDistance / 15

		const headIsBehind = (bird.head.pos.x - bird.pos.x) * bird.direction < 0
		if (bird.head.lerp) {
			const t = (time - bird.head.lerp.start) / (bird.head.lerp.end - bird.head.lerp.start)
			if (t >= 1 || isRunning) {
				bird.head.lerp = null
			} else {
				bird.head.pos.x = lerp(bird.head.lerp.from.x, bird.head.lerp.to.x, t)
			}
		} else if (!isRunning && headIsBehind) {
			bird.head.lerp = {
				start: time,
				end: time + STEP_DURATION / Math.max(1, Math.abs(bird.speed) / 2),
				from: new Vector(bird.head.pos.x, 0),
				to: new Vector(bird.head.pos.x + bird.direction * BODY_RADIUS * (4 + Math.abs(bird.speed / 10)), 0),
			}
		} else if (isRunning || headIsBehind) {
			bird.head.pos.x += bird.speed + (dt / 1000) * (bird.speed) * Math.abs(bird.head.pos.x - bird.pos.x)
			if (bird.head.pos.dist(bird.pos) > BODY_RADIUS * 5.5) {
				bird.head.pos.x = bird.pos.x + bird.direction * Math.sqrt((BODY_RADIUS * 5.5) ** 2 - (bird.head.pos.y - bird.pos.y) ** 2)
			}
		}
	}
}

function drawBird(ctx: CanvasRenderingContext2D, bird: Bird, mousePos: Vector, formData: FormData) {
	const primary = '#777'
	const secondary = '#111'

	ctx.fillStyle = primary
	ctx.strokeStyle = secondary
	ctx.lineJoin = 'round'

	// legs
	ctx.lineWidth = 4
	bird.feet.forEach(foot => {
		const elbow = inverseKinematicsWithTwoJoints(bird.shoulder, foot.pos, UPPER_ARM_LENGTH, FOREARM_LENGTH, -bird.direction as -1 | 1)
		// arms
		ctx.beginPath()
		moveToVec(ctx, bird.shoulder)
		lineToVec(ctx, elbow)
		lineToVec(ctx, foot.pos)
		ctx.stroke()
		// elbow
		ctx.beginPath()
		arcVec(ctx, elbow, 5, 0, 2 * Math.PI)
		ctx.fill()
		// foot
		ctx.beginPath()
		moveToVec(ctx, foot.pos.add(new Vector(0, -3)))
		lineToVec(ctx, foot.pos.add(new Vector(-8, FOOT_HEIGHT)))
		lineToVec(ctx, foot.pos.add(new Vector(8, FOOT_HEIGHT)))
		ctx.closePath()
		ctx.fill()

		if (formData.geometry) {
			ctx.save()
			ctx.lineWidth = 1
			ctx.strokeStyle = '#f005'
			ctx.beginPath()
			arcVec(ctx, bird.shoulder, UPPER_ARM_LENGTH, 0, 2 * Math.PI)
			ctx.stroke()
			ctx.strokeStyle = '#0f05'
			ctx.beginPath()
			arcVec(ctx, foot.pos, FOREARM_LENGTH, 0, 2 * Math.PI)
			ctx.stroke()
			ctx.restore()
		}
	})

	// neck
	{
		ctx.lineWidth = 5

		const directionVector = new Vector(bird.direction, 1)
		const sternumHandle = bird.neck.sub(bird.head.sternum.entrywise(directionVector))
		const napeHandle = bird.head.pos.add(bird.head.nape.entrywise(directionVector))

		ctx.beginPath()
		moveToVec(ctx, bird.neck)
		bezierCurveToVec(ctx, sternumHandle, napeHandle, bird.head.pos)
		ctx.stroke()

		if (formData.geometry) {
			ctx.save()
			ctx.lineWidth = 1
			ctx.strokeStyle = '#00f5'
			ctx.fillStyle = '#00f5'

			ctx.beginPath()
			arcVec(ctx, bird.neck, 5, 0, Math.PI * 2)
			ctx.moveTo(0, 0)
			arcVec(ctx, sternumHandle, 5, 0, Math.PI * 2)
			ctx.moveTo(0, 0)
			arcVec(ctx, bird.head.pos, 5, 0, Math.PI * 2)
			ctx.moveTo(0, 0)
			arcVec(ctx, napeHandle, 5, 0, Math.PI * 2)
			ctx.fill()

			ctx.beginPath()
			moveToVec(ctx, bird.neck)
			lineToVec(ctx, sternumHandle)
			moveToVec(ctx, bird.head.pos)
			lineToVec(ctx, napeHandle)
			ctx.stroke()

			ctx.restore()
		}
	}

	// head
	{
		const headRadius = BODY_RADIUS / 2
		// face
		ctx.beginPath()
		arcVec(ctx, bird.head.pos, headRadius + 2, 0, 2 * Math.PI)
		ctx.fill()
		// beak
		const angleToMouse = (Math.atan2(mousePos.y - bird.head.pos.y, mousePos.x - bird.head.pos.x) + Math.PI * 2) % (Math.PI * 2)
		const beakAngle = bird.direction === -1
			? Math.max(Math.PI * 3 / 4, Math.min(Math.PI * 5 / 4, angleToMouse))
			: angleToMouse < Math.PI ? Math.min(Math.PI / 4, angleToMouse) : Math.max(Math.PI * 7 / 4, angleToMouse)
		ctx.save()
		translateVec(ctx, bird.head.pos)
		ctx.rotate(beakAngle)
		ctx.beginPath()
		ctx.moveTo(0, 0 - headRadius / 2)
		ctx.lineTo(headRadius + BEAK_LENGTH, 0)
		ctx.lineTo(0, 0 + headRadius / 2)
		ctx.closePath()
		ctx.fill()
		ctx.restore()
		// eye
		const eyeOffset = bird.head.pos.add(new Vector(
			Math.cos(angleToMouse) * headRadius / 2,
			Math.sin(angleToMouse) * headRadius / 2
		))
		ctx.fillStyle = secondary
		ctx.beginPath()
		arcVec(ctx, eyeOffset, headRadius / 3, 0, 2 * Math.PI)
		ctx.fill()
		ctx.fillStyle = primary
	}

	// body
	{
		// torso
		ctx.beginPath()
		arcVec(ctx, bird.pos, BODY_RADIUS + 2, 0, 2 * Math.PI)
		ctx.fill()
		// tail
		ctx.beginPath()
		moveToVec(ctx, bird.pos.add(new Vector(-bird.direction * BODY_RADIUS, 0)))
		lineToVec(ctx, bird.pos.add(new Vector(-bird.direction * BODY_RADIUS * 2, BODY_RADIUS)))
		lineToVec(ctx, bird.pos.add(new Vector(0, BODY_RADIUS)))
		ctx.closePath()
		ctx.fill()

		if (formData.geometry) {
			ctx.save()
			ctx.lineWidth = 1
			ctx.strokeStyle = '#fa05'
			ctx.beginPath()
			moveToVec(ctx, bird.pos)
			lineToVec(ctx, bird.pos.add(new Vector(bird.speed * 10, 0)))
			ctx.stroke()
			ctx.restore()
		}
	}
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

function inverseKinematicsWithTwoJoints(shoulder: Vector, wrist: Vector, upperJointLength: number, lowerJointLength: number, direction: 1 | -1): Vector {
	const d = wrist.dist(shoulder)

	const startToElbowNormal = (d ** 2 - lowerJointLength ** 2 + upperJointLength ** 2) / (2 * d)
	const shoulderAngle = Math.acos(startToElbowNormal / upperJointLength)
	const baseAngle = ((shoulder.x >= wrist.x) === (direction === 1))
		? Math.acos((wrist.y - shoulder.y) / d)
		: -Math.acos((wrist.y - shoulder.y) / d)
	const angle = - baseAngle + shoulderAngle + Math.PI / 2
	const elbowX = shoulder.x - upperJointLength * Math.cos(angle) * direction
	const elbowY = shoulder.y + upperJointLength * Math.sin(angle)
	return new Vector(elbowX, elbowY)
}

function moveToVec(ctx: CanvasRenderingContext2D, vec: Vector) {
	ctx.moveTo(vec.x, vec.y)
}
function lineToVec(ctx: CanvasRenderingContext2D, vec: Vector) {
	ctx.lineTo(vec.x, vec.y)
}
function arcVec(ctx: CanvasRenderingContext2D, vec: Vector, radius: number, startAngle: number, endAngle: number) {
	ctx.arc(vec.x, vec.y, radius, startAngle, endAngle)
}
function translateVec(ctx: CanvasRenderingContext2D, vec: Vector) {
	ctx.translate(vec.x, vec.y)
}
function bezierCurveToVec(ctx: CanvasRenderingContext2D, cp1: Vector, cp2: Vector, end: Vector) {
	ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y)
}