import styles from './styles.module.css'
import { Head } from "#components/Head"
import type { RouteMeta } from "#router"
import { use, useEffect, useRef, useState } from "react"
import { getFormValue } from "#components/getFormValue"
import { makeFrameCounter } from "#components/makeFrameCounter"
import shader from './foo.wgsl?raw'
import compute from './compute.wgsl?raw'

export const meta: RouteMeta = {
	title: 'Particle Life GPU',
	tags: ['simulation', 'webgpu', 'particles', 'wip'],
}

export default function ParticleLifeGPUPage() {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const [supported] = useState(() => Boolean(navigator.gpu))
	const [fps, setFps] = useState(0)

	useEffect(() => {
		if (!supported) return
		const canvas = canvasRef.current!
		const controller = new AbortController()

		canvas.width = window.innerWidth * devicePixelRatio
		canvas.height = window.innerHeight * devicePixelRatio

		const frameCounter = makeFrameCounter(60)
		start(controller.signal, canvas, (dt) => setFps(Math.round(frameCounter(dt / 1000))))

		return () => {
			controller.abort()
		}
	}, [supported])

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
				{supported && <pre>{fps} FPS</pre>}
				{!supported && <pre>Your browser does not support WebGPU.</pre>}
			</div>
			<canvas ref={canvasRef} />
		</div>
	)
}

async function start(
	signal: AbortSignal,
	canvas: HTMLCanvasElement,
	onFrame: (dt: number) => void,
) {
	const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
	if (!adapter) throw new Error('No GPU adapter found')
	if (signal.aborted) return

	const device = await adapter.requestDevice()
	if (!device) throw new Error('No GPU device found')
	if (signal.aborted) return
	signal.addEventListener('abort', () => device.destroy(), { once: true })

	const ctx = canvas.getContext('webgpu')!
	if (!ctx) throw new Error('No WebGPU context found')
	const format = navigator.gpu.getPreferredCanvasFormat()
	ctx.configure({ device, format, alphaMode: 'opaque' })
	signal.addEventListener('abort', () => ctx.unconfigure(), { once: true })

	const module = device.createShaderModule({ code: shader, label: 'our hardcoded red triangle shaders' })

	const pipeline = device.createRenderPipeline({
		label: 'our hardcoded red triangle pipeline',
		layout: 'auto',
		vertex: {
			entryPoint: 'vs',
			module,
		},
		fragment: {
			entryPoint: 'fs',
			module,
			targets: [{ format }],
		},
	})


	const renderPassDescriptor = {
		label: 'our basic canvas renderPass',
		colorAttachments: [
			{
				view: null! as GPUTextureView,
				clearValue: [0.3, 0.3, 0.3, 1],
				loadOp: 'clear',
				storeOp: 'store',
			},
		],
	} satisfies GPURenderPassDescriptor

	function render() {
		// Get the current texture from the canvas context and
		// set it as the texture to render to.
		renderPassDescriptor.colorAttachments[0]!.view =
			ctx.getCurrentTexture().createView()

		const encoder = device.createCommandEncoder({ label: 'our encoder' })
		const pass = encoder.beginRenderPass(renderPassDescriptor)
		pass.setPipeline(pipeline)
		pass.draw(3)
		pass.end()

		const commandBuffer = encoder.finish()
		device.queue.submit([commandBuffer])
	}

	let lastTime = performance.now()
	let rafId = requestAnimationFrame(function frame(time) {
		if (signal.aborted) return
		rafId = requestAnimationFrame(frame)
		const dt = time - lastTime
		lastTime = time
		onFrame(dt)
		render()
	})
	signal.addEventListener('abort', () => cancelAnimationFrame(rafId), { once: true })

	const width = ctx.canvas.width
	const height = ctx.canvas.height
}