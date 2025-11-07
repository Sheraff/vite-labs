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
		start(controller, canvas, (dt) => setFps(Math.round(frameCounter(dt / 1000))))

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
	controller: AbortController,
	canvas: HTMLCanvasElement,
	onFrame: (dt: number) => void,
) {
	const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
	if (!adapter) throw new Error('No GPU adapter found')
	if (controller.signal.aborted) return

	const device = await adapter.requestDevice()
	if (!device) throw new Error('No GPU device found')
	if (controller.signal.aborted) return
	controller.signal.addEventListener('abort', () => device.destroy(), { once: true })
	device.lost.then((info) => info.reason !== 'destroyed' && controller.abort())
	if (canvas.width > device.limits.maxTextureDimension2D || canvas.height > device.limits.maxTextureDimension2D)
		throw new Error(`Canvas size exceeds device limits: ${canvas.width}x${canvas.height} > ${device.limits.maxTextureDimension2D}`)

	const ctx = canvas.getContext('webgpu')!
	if (!ctx) throw new Error('No WebGPU context found')
	const format = navigator.gpu.getPreferredCanvasFormat()
	ctx.configure({ device, format, alphaMode: 'opaque' })
	controller.signal.addEventListener('abort', () => ctx.unconfigure(), { once: true })

	const renderModule = device.createShaderModule({ code: shader, label: 'our hardcoded red triangle shaders' })

	const renderPipeline = device.createRenderPipeline({
		label: 'our hardcoded red triangle pipeline',
		layout: 'auto',
		vertex: {
			entryPoint: 'vs',
			module: renderModule,
		},
		fragment: {
			entryPoint: 'fs',
			module: renderModule,
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
		pass.setPipeline(renderPipeline)
		pass.draw(3)
		pass.end()

		const commandBuffer = encoder.finish()
		device.queue.submit([commandBuffer])
	}

	let lastTime = performance.now()
	let rafId = requestAnimationFrame(function frame(time) {
		if (controller.signal.aborted) return
		rafId = requestAnimationFrame(frame)
		const dt = time - lastTime
		lastTime = time
		onFrame(dt)
		render()
	})
	controller.signal.addEventListener('abort', () => cancelAnimationFrame(rafId), { once: true })

	// const width = ctx.canvas.width
	// const height = ctx.canvas.height

	const computeModule = device.createShaderModule({
		label: 'doubling compute module',
		code: compute,
	})

	const computePipeline = device.createComputePipeline({
		label: 'doubling compute pipeline',
		layout: 'auto',
		compute: {
			module: computeModule,
		},
	})

	const input = new Float32Array([1, 3, 5])
	const workBuffer = device.createBuffer({
		label: 'work buffer',
		size: input.byteLength,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
	})
	device.queue.writeBuffer(workBuffer, 0, input)
	controller.signal.addEventListener('abort', () => workBuffer.destroy(), { once: true })

	const resultBuffer = device.createBuffer({
		label: 'result buffer',
		size: input.byteLength,
		usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
	})
	controller.signal.addEventListener('abort', () => resultBuffer.destroy(), { once: true })

	const bindGroup = device.createBindGroup({
		label: 'bindGroup for work buffer',
		layout: computePipeline.getBindGroupLayout(0),
		entries: [
			{ binding: 0, resource: { buffer: workBuffer } },
		],
	})

	exec: {
		const encoder = device.createCommandEncoder({
			label: 'doubling encoder',
		})

		const pass = encoder.beginComputePass({
			label: 'doubling compute pass',
		})
		pass.setPipeline(computePipeline)
		pass.setBindGroup(0, bindGroup)
		pass.dispatchWorkgroups(input.length)
		pass.end()

		encoder.copyBufferToBuffer(workBuffer, 0, resultBuffer, 0, resultBuffer.size)

		const commandBuffer = encoder.finish()
		device.queue.submit([commandBuffer])
	}

	await resultBuffer.mapAsync(GPUMapMode.READ)
	const result = new Float32Array(resultBuffer.getMappedRange())

	console.log('input', input)
	console.log('result', result)

	resultBuffer.unmap()
}