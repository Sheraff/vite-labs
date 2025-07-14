import { getUps, play as stepPlay, pause as stepPause, start } from "./stepLoop"
import type { Incoming as CanvasIncoming } from './canvas.worker'
import { server } from "./entities"

/// <reference lib="webworker" />

export type Incoming =
	| { type: 'init'; data: { side: number } }
	| { type: 'channel', data: { port: MessagePort } }
	| { type: 'toggle', data: { status: boolean } }
	| { type: 'mouse', data: { mouse: { x: number, y: number } | null } }
	| { type: 'received', data: object }

let paused = false
let port: MessagePort
{
	self.onmessage = (e: MessageEvent<Incoming>) => handleMessage(e.data)
	let side: number
	let started = false
	function handleMessage(event: Incoming) {
		if (event.type === 'init') {
			side = event.data.side
		} else if (event.type === 'channel') {
			port = event.data.port
		} else if (event.type === 'toggle') {
			paused = !event.data.status
			if (started) {
				if (paused) {
					pause()
				} else {
					play()
				}
			}
		}

		if (!started && side && port) {
			started = true
			start(side)
			dispatch(port)
			play()

		}
	}
}


function dispatch(port: MessagePort) {
	const interval = setInterval(() => {
		const buffers: CanvasIncoming = {
			type: 'buffers',
			data: { entities: server.serialize() }
		}
		port.postMessage(buffers)
	}, 50)
	port.onmessage = (e: MessageEvent<Incoming>) => handleMessage(e.data)
	function handleMessage(event: Incoming) {
		if (event.type === 'received') {
			clearInterval(interval)
		}
	}
}

let metricsTimeoutId: ReturnType<typeof setTimeout>
function metrics() {
	metricsTimeoutId = setTimeout(() => {
		const ups: CanvasIncoming = {
			type: 'ups',
			data: { ups: getUps() },
		}
		port.postMessage(ups)
		metrics()
	}, 1000)
}

function pause() {
	paused = true
	stepPause()
	clearTimeout(metricsTimeoutId)
}

function play() {
	paused = false
	stepPlay()
	metrics()
}