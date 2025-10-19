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
	tree = new StaticTreeNode(0, 0, width, height, x, y, 8)
	for (let i = 0; i < total; i++) {
		tree.insert(i)
	}


	let lastTime = 0
	let frameCount = 0
	requestAnimationFrame(function loop(time) {
		requestAnimationFrame(loop)

		const dt = time - lastTime
		lastTime = time
		if (dt === time) return // first frame
		postMessage({ type: "frame", data: { dt } } satisfies Outgoing)

		if (!playing) return
		update(dt / 1000, frameCount)
		frameCount++
	})
}

function update(dt: number, frameCount: number) {
	const updateTree = frameCount % 10 === 0

	// constants
	const max = repulseRange + attractRange
	const repulse = repulseRange
	const wallRepulse = wallRepulseRange
	const dampen = 0.94

	for (let i = indexStart; i < indexEnd; i++) {
		let px = x[i]
		let py = y[i]
		let pvx = vx[i]
		let pvy = vy[i]
		const pcolor = color[i]

		const neighbors = tree.query(px, py, max)
		for (const j of neighbors) {
			if (i === j) continue

			const nx = x[j]
			const ny = y[j]
			const ncolor = color[j]

			const dx = nx - px
			const dy = ny - py
			const dist = Math.hypot(dx, dy)

			if (dist > max) continue

			if (dist < repulse) {
				// Repulse
				const power = (repulse - dist) / repulse
				const mult = power * dt * repulseStrength / dist
				pvx -= dx * mult
				pvy -= dy * mult
			} else {
				// Attract
				const colorDef = colors[pcolor]
				try {
					const attraction = colorDef.attractions[ncolor]
					if (attraction === 0) continue
					const power = attraction * Math.abs((dist - repulse) / (max - repulse) * 2 - 1)
					const mult = power * dt * attractStrength / dist
					pvx += dx * mult
					pvy += dy * mult
				} catch (e) {
					console.log('Error in attraction', pcolor, ncolor, colorDef, colors)
					throw e
				}
			}
		}

		// Repulse from walls
		left: {
			const dx = px - wallRepulse
			if (dx > 0) break left
			pvx -= (dx / wallRepulse) * dt * wallRepulseStrength
		}
		right: {
			const dx = (width - px) - wallRepulse
			if (dx > 0) break right
			pvx += (dx / wallRepulse) * dt * wallRepulseStrength
		}
		top: {
			const dy = py - wallRepulse
			if (dy > 0) break top
			pvy -= (dy / wallRepulse) * dt * wallRepulseStrength
		}
		bottom: {
			const dy = (height - py) - wallRepulse
			if (dy > 0) break bottom
			pvy += (dy / wallRepulse) * dt * wallRepulseStrength
		}

		// Dampen velocity
		pvx *= dampen
		pvy *= dampen

		if (Math.abs(pvx) > 100) pvx = 100 * Math.sign(pvx)
		if (Math.abs(pvy) > 100) pvy = 100 * Math.sign(pvy)

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