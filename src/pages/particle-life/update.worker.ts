/// <reference lib="webworker" />

import { Bins } from "#particle-life/Bins"

export type Incoming =
	| {
		type: "state",
		data: {
			repulse: { range: number; strength: number }
			attract: { range: number; strength: number }
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
let colors: Array<{
	color: string
	attractions: Array<number>
}>

let bins: Bins

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
	bins = new Bins(width, height, 50, total)
	console.log('bins created', bins.count, 'width:', bins.width, 'height:', bins.height)


	let lastTime = 0
	let frameCount = 0
	let dtSum = 0
	const frameMessage = { type: "frame", data: { dt: 0 } } satisfies Outgoing
	requestAnimationFrame(function loop(time) {
		requestAnimationFrame(loop)

		const dt = time - lastTime
		lastTime = time
		if (dt === time) return // first frame
		if (!playing) return

		dtSum += dt
		if (frameCount % 120 === 0) {
			frameMessage.data.dt = dtSum / 120
			postMessage(frameMessage)
			dtSum = 0
		}

		update(dt / 1000, frameCount)
		frameCount++
	})
}

function update(dt: number, frameCount: number) {
	// constants
	const max = repulseRange + attractRange
	const repulse = repulseRange
	const dampen = 0.001

	const maxSq = max * max
	const inv_repulse = 1 / repulse
	const inv_max_minus_repulse = 1 / (max - repulse)
	const repulseStrengthDt = repulseStrength * dt
	const attractStrengthDt = attractStrength * dt

	const halfWidth = width * 0.5
	const halfHeight = height * 0.5

	// rebuild spatial map
	if (frameCount % 10 === 0)
		bins.fill(x, y)

	for (let i = indexStart; i < indexEnd; i++) {
		let px = x[i]
		let py = y[i]
		let pvx = vx[i]
		let pvy = vy[i]
		const pcolor = color[i]
		const colorDef = colors[pcolor]

		bins.queryWrap(px, py, max, (j) => {
			if (i === j) return

			const nx = x[j]
			const ny = y[j]

			// Calculate wrapped distance (shortest path)
			let dx = nx - px
			let dy = ny - py

			// Handle wrapping for x-axis
			if (dx > halfWidth) dx -= width
			else if (dx < -halfWidth) dx += width

			// Handle wrapping for y-axis  
			if (dy > halfHeight) dy -= height
			else if (dy < -halfHeight) dy += height

			const distSq = dx * dx + dy * dy
			if (distSq > maxSq) return
			const dist = Math.sqrt(distSq)

			// if (dist < 4) {
			// 	// Collision (elastic bounce)
			// 	const nvx = vx[j]
			// 	const nvy = vy[j]
			// 	const relVelX = pvx - nvx
			// 	const relVelY = pvy - nvy
			// 	const dot = (relVelX * dx + relVelY * dy) / dist
			// 	if (dot > 0) {
			// 		const impulseX = (dot * dx) / dist
			// 		const impulseY = (dot * dy) / dist
			// 		pvx -= impulseX * 0.5
			// 		pvy -= impulseY * 0.5
			// 	}
			// } else
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
				if (attraction === 0) return
				const power = attraction * Math.abs((dist - repulse) * inv_max_minus_repulse * 2 - 1)
				const mult = power * attractStrengthDt / dist
				pvx += dx * mult
				pvy += dy * mult
			}
		})

		// Dampen velocity
		pvx *= Math.max(1 - dampen * Math.abs(pvx), 0)
		pvy *= Math.max(1 - dampen * Math.abs(pvy), 0)

		vx[i] = pvx
		vy[i] = pvy

		px += pvx * dt
		py += pvy * dt

		// Wrap around edges
		if (px < 0) px += width
		else if (px >= width) px -= width
		if (py < 0) py += height
		else if (py >= height) py -= height

		x[i] = px
		y[i] = py
	}
}