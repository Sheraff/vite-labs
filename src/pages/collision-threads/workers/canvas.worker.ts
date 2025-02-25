import { client, type EntitiesMessage } from "./entities"
import { play as stepPlay, pause as stepPause, start, updateUps } from "./drawLoop"
import type { Incoming as ProcessIncoming } from './process.worker'

/// <reference lib="webworker" />

export type Incoming =
	| { type: 'init'; data: { side: number, main: OffscreenCanvas, ui: OffscreenCanvas } }
	| { type: 'channel', data: { port: MessagePort } }
	| { type: 'toggle', data: { status: boolean } }
	| { type: 'buffers', data: { entities: EntitiesMessage } }
	| { type: 'ups', data: { ups: number } }

let paused = false
let main: OffscreenCanvasRenderingContext2D
let ui: OffscreenCanvasRenderingContext2D
let side: number
{
	let port: MessagePort
	let started = false
	self.onmessage = (e: MessageEvent<Incoming>) => handleMessage(e.data)
	function handleMessage(event: Incoming) {
		if (event.type === 'init') {
			ui = event.data.ui.getContext("2d")!
			main = event.data.main.getContext("2d")!
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

		if (!started && main && ui && side && port) {
			started = true
			start(side, { ui, main })
			listen(port)
		}
	}
}

function listen(port: MessagePort) {
	port.onmessage = (e: MessageEvent<Incoming>) => handleMessage(e.data)
	function handleMessage(event: Incoming) {
		if (event.type === 'buffers') {
			client.hydrate(event.data.entities)
			const received: ProcessIncoming = { type: 'received', data: {} }
			port.postMessage(received)
			play()
		}
		if (event.type === 'ups') {
			updateUps(event.data.ups)
		}
	}
}

function pause() {
	stepPause()
}

function play() {
	stepPlay({ main, ui })
}