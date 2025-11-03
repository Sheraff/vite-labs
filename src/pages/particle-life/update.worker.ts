/// <reference lib="webworker" />

import { StaticTreeNode } from "#particle-life/StaticTreeNode"

export type Incoming =
	| {
		type: "state",
		data: {
			repulse: { range: number; strength: number }
			attract: { range: number; strength: number }
			wallRepulse: { range: number; strength: number }
			colors: Array<{
				color: string
				attractions: Array<number>
			}>
		}
	}
	| {
		type: "buffers",
		data: {
			x: SharedArrayBuffer
			y: SharedArrayBuffer
			vx: SharedArrayBuffer
			vy: SharedArrayBuffer
			color: SharedArrayBuffer
			total: number
			range: [number, number]
			width: number
			height: number
		}
	}
	| {
		type: "pause"
	}
	| {
		type: "resume"
	}

export type Outgoing =
	| { type: "frame", data: { dt: number } }

let x: Float32Array
let y: Float32Array
let vx: Float32Array
let vy: Float32Array
let color: Uint8Array
let total: number
let indexStart: number
let indexEnd: number

let width: number
let height: number
let repulseRange: number
let repulseStrength: number
let attractRange: number
let attractStrength: number
let wallRepulseRange: number
let wallRepulseStrength: number
let colors: Array<{
	color: string
	attractions: Array<number>
}>

let tree: StaticTreeNode

let playing = true

{
	self.onmessage = (e: MessageEvent<Incoming>) => handleMessage(e.data)

	let hasBuffers = false
	let hasState = false
	let hasStarted = false

	function handleMessage(data: Incoming) {
		switch (data.type) {
			case "state":
				hasState = true
				handleState(data.data)
				break
			case "buffers":
				hasBuffers = true
				handleBuffers(data.data)
				break
			case "pause":
				playing = false
				break
			case "resume":
				playing = true
				break
		}

		if (hasBuffers && hasState && !hasStarted) {
			hasStarted = true
			start()
		}
	}

	function handleState(state: Extract<Incoming, { type: "state" }>["data"]) {
		repulseRange = state.repulse.range
		repulseStrength = state.repulse.strength
		attractRange = state.attract.range
		attractStrength = state.attract.strength
		wallRepulseRange = state.wallRepulse.range
		wallRepulseStrength = state.wallRepulse.strength
		colors = state.colors
	}

	function handleBuffers(buffers: Extract<Incoming, { type: "buffers" }>["data"]) {
		x = new Float32Array(buffers.x)
		y = new Float32Array(buffers.y)
		vx = new Float32Array(buffers.vx)
		vy = new Float32Array(buffers.vy)
		color = new Uint8Array(buffers.color)
		total = buffers.total
		indexStart = buffers.range[0]
		indexEnd = buffers.range[1]
		width = buffers.width
		height = buffers.height
	}
}

function start() {
	console.log('starting worker for ', indexStart, 'to', indexEnd, '(', indexEnd - indexStart, 'particles )')
	tree = new StaticTreeNode(0, 0, width, height, x, y, 8)
	for (let i = 0; i < total; i++) {
		tree.insert(i)
	}


	let lastTime = 0
	let frameCount = 0
	const frameMessage = { type: "frame", data: { dt: 0 } } satisfies Outgoing
	requestAnimationFrame(function loop(time) {
		requestAnimationFrame(loop)

		const dt = time - lastTime
		lastTime = time
		if (dt === time) return // first frame
		frameMessage.data.dt = dt
		postMessage(frameMessage)

		if (!playing) return
		update(dt / 1000, frameCount)
		frameCount++
	})
}

function update(dt: number, frameCount: number) {
	const updateTree = frameCount % 15 === 0

	// constants
	const max = repulseRange + attractRange
	const repulse = repulseRange
	const wallRepulse = wallRepulseRange
	const dampen = 0.94

	const maxSq = max * max
	const inv_repulse = 1 / repulse
	const inv_max_minus_repulse = 1 / (max - repulse)
	const repulseStrengthDt = repulseStrength * dt
	const attractStrengthDt = attractStrength * dt
	const wallRepulseStrengthDt = wallRepulseStrength * dt / wallRepulse

	for (let i = indexStart; i < indexEnd; i++) {
		let px = x[i]
		let py = y[i]
		let pvx = vx[i]
		let pvy = vy[i]
		const pcolor = color[i]
		const colorDef = colors[pcolor]

		const neighbors = tree.query(px, py, max)
		for (const j of neighbors) {
			if (i === j) continue

			const nx = x[j]
			const ny = y[j]


			const dx = nx - px
			const dy = ny - py
			const distSq = dx * dx + dy * dy
			if (distSq > maxSq) continue
			const dist = Math.hypot(dx, dy)

			if (dist < repulse) {
				// Repulse
				const power = (repulse - dist) * inv_repulse
				const mult = power * repulseStrengthDt / dist
				pvx -= dx * mult
				pvy -= dy * mult
			} else {
				// Attract
				const ncolor = color[j]
				const attraction = colorDef.attractions[ncolor]
				if (attraction === 0) continue
				const power = attraction * Math.abs((dist - repulse) * inv_max_minus_repulse * 2 - 1)
				const mult = power * attractStrengthDt / dist
				pvx += dx * mult
				pvy += dy * mult
			}
		}

		// Repulse from walls
		const dx_left = px - wallRepulse
		if (dx_left <= 0) pvx -= dx_left * wallRepulseStrengthDt
		const dx_right = (width - px) - wallRepulse
		if (dx_right <= 0) pvx += dx_right * wallRepulseStrengthDt
		const dy_top = py - wallRepulse
		if (dy_top <= 0) pvy -= dy_top * wallRepulseStrengthDt
		const dy_bottom = (height - py) - wallRepulse
		if (dy_bottom <= 0) pvy += dy_bottom * wallRepulseStrengthDt

		// Dampen velocity
		pvx *= dampen
		pvy *= dampen

		if (pvx > 100) pvx = 100
		else if (pvx < -100) pvx = -100
		if (pvy > 100) pvy = 100
		else if (pvy < -100) pvy = -100

		vx[i] = pvx
		vy[i] = pvy

		px += pvx * dt
		py += pvy * dt

		x[i] = px
		y[i] = py
	}

	if (updateTree) {
		for (let i = 0; i < total; i++) {
			tree.update(i)
		}
	}
}