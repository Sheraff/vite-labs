import styles from './styles.module.css'
import { Head } from "#components/Head"
import type { RouteMeta } from "#router"
import { use, useEffect, useRef, useState } from "react"
import { getFormValue } from "#components/getFormValue"
import { makeFrameCounter } from "#components/makeFrameCounter"
import drawShader from './draw.wgsl?raw'
import binShader from './bin-fill.wgsl?raw'
import updateShader from './update.wgsl?raw'

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

	const onAbort = (cb: () => void) => {
		if (controller.signal.aborted) return
		controller.signal.addEventListener('abort', cb, { once: true })
	}

	const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
	if (!adapter) throw new Error('No GPU adapter found')
	if (controller.signal.aborted) return

	const device = await adapter.requestDevice()
	if (!device) throw new Error('No GPU device found')
	if (controller.signal.aborted) return
	onAbort(() => device.destroy())
	device.lost.then((info) => info.reason !== 'destroyed' && controller.abort())
	if (canvas.width > device.limits.maxTextureDimension2D || canvas.height > device.limits.maxTextureDimension2D)
		throw new Error(`Canvas size exceeds device limits: ${canvas.width}x${canvas.height} > ${device.limits.maxTextureDimension2D}`)

	const ctx = canvas.getContext('webgpu')!
	if (!ctx) throw new Error('No WebGPU context found')
	const format = navigator.gpu.getPreferredCanvasFormat()
	ctx.configure({ device, format, alphaMode: 'opaque' })
	onAbort(() => ctx.unconfigure())

	const width = ctx.canvas.width
	const height = ctx.canvas.height

	const repulsionRange = 20
	const attractionRange = 20
	const repulsionStrength = 20
	const attractionStrength = 10

	const cellSize = repulsionRange + attractionRange
	const widthDivisions = Math.ceil(width / cellSize)
	const heightDivisions = Math.ceil(height / cellSize)
	const toBinX = widthDivisions / width
	const toBinY = heightDivisions / height
	const binCount = widthDivisions * heightDivisions
	// const particleCount = 180_000
	const particleCount = 100_000

	const particlePositionBuffer = device.createBuffer({
		label: 'particle position storage buffer',
		size: particleCount * 2 * Float32Array.BYTES_PER_ELEMENT,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		mappedAtCreation: true,
	})
	{
		const staticStorageArray = new Float32Array(particlePositionBuffer.getMappedRange())
		for (let i = 0; i < particleCount; i++) {
			staticStorageArray[i * 2 + 0] = Math.random() * width
			staticStorageArray[i * 2 + 1] = Math.random() * height
		}
		particlePositionBuffer.unmap()
		onAbort(() => particlePositionBuffer.destroy())
	}
	const particleColorBuffer = device.createBuffer({
		label: 'particle color storage buffer',
		size: particleCount * 1 * Uint32Array.BYTES_PER_ELEMENT,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		mappedAtCreation: true,
	})
	{
		const staticStorageArray = new Uint32Array(particleColorBuffer.getMappedRange())
		for (let i = 0; i < particleCount; i++) {
			staticStorageArray[i] = i % 6
		}
		particleColorBuffer.unmap()
		onAbort(() => particleColorBuffer.destroy())
	}
	const particleVelocityBuffer = device.createBuffer({
		label: 'particle velocity storage buffer',
		size: particleCount * 2 * Float32Array.BYTES_PER_ELEMENT,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		mappedAtCreation: true,
	})
	{
		const staticStorageArray = new Float32Array(particleVelocityBuffer.getMappedRange())
		for (let i = 0; i < particleCount; i++) {
			staticStorageArray[i * 2 + 0] = 0
			staticStorageArray[i * 2 + 1] = 0
		}
		particleVelocityBuffer.unmap()
		onAbort(() => particleVelocityBuffer.destroy())
	}
	const particleInteractionsBuffer = device.createBuffer({
		label: 'particle interactions storage buffer',
		size: 6 * 6 * Float32Array.BYTES_PER_ELEMENT,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		mappedAtCreation: true,
	})
	{
		const staticStorageArray = new Float32Array(particleInteractionsBuffer.getMappedRange())
		for (let i = 0; i < 6; i++) {
			for (let j = 0; j < 6; j++) {
				staticStorageArray[i * 6 + j] = Math.random() * 2 - 1
			}
		}
		particleInteractionsBuffer.unmap()
		onAbort(() => particleInteractionsBuffer.destroy())
	}

	const binSizeBuffer = device.createBuffer({
		label: 'bin size storage buffer',
		size: binCount * Uint32Array.BYTES_PER_ELEMENT,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
	})
	onAbort(() => binSizeBuffer.destroy())

	const binOffsetBuffer = device.createBuffer({
		label: 'bin offset storage buffer',
		size: binCount * Uint32Array.BYTES_PER_ELEMENT,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
	})
	onAbort(() => binOffsetBuffer.destroy())

	const binCursorBuffer = device.createBuffer({
		label: 'bin cursor storage buffer',
		size: binCount * Uint32Array.BYTES_PER_ELEMENT,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
	})
	onAbort(() => binCursorBuffer.destroy())

	const binContentsBuffer = device.createBuffer({
		label: 'bin contents storage buffer',
		size: particleCount * Uint32Array.BYTES_PER_ELEMENT,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
	})
	onAbort(() => binContentsBuffer.destroy())

	const binConfigBuffer = device.createBuffer({
		label: 'config uniform buffer',
		size: 5 * 4,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		mappedAtCreation: true,
	})
	{
		const buffer = binConfigBuffer.getMappedRange()
		const asFloat32 = new Float32Array(buffer)
		asFloat32[0] = toBinX
		asFloat32[1] = toBinY
		const asUint32 = new Uint32Array(buffer)
		asUint32[2] = widthDivisions
		asUint32[3] = binCount
		asUint32[4] = particleCount
		binConfigBuffer.unmap()
		onAbort(() => binConfigBuffer.destroy())
	}

	const binConfigBindGroupLayout = device.createBindGroupLayout({
		label: 'config bind group layout',
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
				buffer: { type: 'uniform' },
			},
		],
	})
	const binConfigBindGroup = device.createBindGroup({
		label: 'config bind group',
		layout: binConfigBindGroupLayout,
		entries: [
			{ binding: 0, resource: { buffer: binConfigBuffer } },
		],
	})

	const binBindGroupLayout = device.createBindGroupLayout({
		label: 'bin bind group layout',
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.COMPUTE,
				buffer: { type: 'storage' },
			},
			{
				binding: 1,
				visibility: GPUShaderStage.COMPUTE,
				buffer: { type: 'storage' },
			},
			{
				binding: 2,
				visibility: GPUShaderStage.COMPUTE,
				buffer: { type: 'storage' },
			},
			{
				binding: 3,
				visibility: GPUShaderStage.COMPUTE,
				buffer: { type: 'storage' },
			}
		],
	})
	const binBindGroup = device.createBindGroup({
		label: 'bin bind group',
		layout: binBindGroupLayout,
		entries: [
			{ binding: 0, resource: { buffer: binSizeBuffer } },
			{ binding: 1, resource: { buffer: binOffsetBuffer } },
			{ binding: 2, resource: { buffer: binCursorBuffer } },
			{ binding: 3, resource: { buffer: binContentsBuffer } },
		],
	})

	const particlePositionBindGroupLayout = device.createBindGroupLayout({
		label: 'particle position bind group layout',
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.COMPUTE,
				buffer: { type: 'read-only-storage' },
			},
		],
	})
	const particlePositionBindGroup = device.createBindGroup({
		label: 'particle position bind group',
		layout: particlePositionBindGroupLayout,
		entries: [
			{ binding: 0, resource: { buffer: particlePositionBuffer } },
		],
	})

	const binPipelineLayout = device.createPipelineLayout({
		label: 'bin fill pipeline layout',
		bindGroupLayouts: [
			binConfigBindGroupLayout,
			binBindGroupLayout,
			particlePositionBindGroupLayout,
		],
	})

	const binComputeModule = device.createShaderModule({
		label: 'bin fill compute module',
		code: binShader,
	})

	const binClearPipeline = device.createComputePipeline({
		label: 'bin clear compute pipeline',
		layout: binPipelineLayout,
		compute: {
			module: binComputeModule,
			entryPoint: 'clear',
		},
	})
	const binSizePipeline = device.createComputePipeline({
		label: 'bin size compute pipeline',
		layout: binPipelineLayout,
		compute: {
			module: binComputeModule,
			entryPoint: 'size',
		},
	})
	const binPreparePipeline = device.createComputePipeline({
		label: 'bin prepare compute pipeline',
		layout: binPipelineLayout,
		compute: {
			module: binComputeModule,
			entryPoint: 'prepare',
		},
	})
	const binFillPipeline = device.createComputePipeline({
		label: 'bin fill compute pipeline',
		layout: binPipelineLayout,
		compute: {
			module: binComputeModule,
			entryPoint: 'fill',
		},
	})

	const binEncoderDescriptor: GPUObjectDescriptorBase = { label: 'bin encoder' }
	const binPassDescriptor: GPUComputePassDescriptor = { label: 'bin compute pass' }
	function computeBins() {
		const encoder = device.createCommandEncoder(binEncoderDescriptor)
		const pass = encoder.beginComputePass(binPassDescriptor)
		pass.setPipeline(binClearPipeline)
		pass.setBindGroup(0, binConfigBindGroup)
		pass.setBindGroup(1, binBindGroup)
		pass.setBindGroup(2, particlePositionBindGroup)
		pass.dispatchWorkgroups(Math.ceil(binCount / 256))

		pass.setPipeline(binSizePipeline)
		pass.dispatchWorkgroups(Math.ceil(particleCount / 256))

		pass.setPipeline(binPreparePipeline)
		pass.dispatchWorkgroups(Math.ceil(binCount / 256))

		pass.setPipeline(binFillPipeline)
		pass.dispatchWorkgroups(Math.ceil(particleCount / 256))

		pass.end()

		const commandBuffer = encoder.finish()
		device.queue.submit([commandBuffer])
	}

	const updateTimeBuffer = device.createBuffer({
		label: 'update time uniform buffer',
		size: 4,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	})
	onAbort(() => updateTimeBuffer.destroy())
	const updateTimeBindGroupLayout = device.createBindGroupLayout({
		label: 'update time bind group layout',
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.COMPUTE,
				buffer: { type: 'uniform' },
			},
		],
	})

	const updateTimeBindGroup = device.createBindGroup({
		label: 'update time bind group',
		layout: updateTimeBindGroupLayout,
		entries: [
			{ binding: 0, resource: { buffer: updateTimeBuffer } },
		],
	})

	const updateParticlesBindGroupLayout = device.createBindGroupLayout({
		label: 'update particles bind group layout',
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.COMPUTE,
				buffer: { type: 'storage' },
			},
			{
				binding: 1,
				visibility: GPUShaderStage.COMPUTE,
				buffer: { type: 'storage' },
			},
			{
				binding: 2,
				visibility: GPUShaderStage.COMPUTE,
				buffer: { type: 'read-only-storage' },
			},
		],
	})
	const updateParticlesBindGroup = device.createBindGroup({
		label: 'update particles bind group',
		layout: updateParticlesBindGroupLayout,
		entries: [
			{ binding: 0, resource: { buffer: particlePositionBuffer } },
			{ binding: 1, resource: { buffer: particleVelocityBuffer } },
			{ binding: 2, resource: { buffer: particleColorBuffer } },
		],
	})

	const updateConfigBuffer = device.createBuffer({
		label: 'update config uniform buffer',
		size: 11 * 4,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		mappedAtCreation: true,
	})
	{
		const buffer = updateConfigBuffer.getMappedRange()
		const asFloat32 = new Float32Array(buffer)
		const asUint32 = new Uint32Array(buffer)
		asFloat32[0] = width
		asFloat32[1] = height
		asUint32[2] = particleCount
		// interaction parameters
		asFloat32[3] = repulsionRange
		asFloat32[4] = attractionRange
		asFloat32[5] = repulsionStrength
		asFloat32[6] = attractionStrength
		// binning info
		asFloat32[7] = toBinX
		asFloat32[8] = toBinY
		asUint32[9] = widthDivisions
		asUint32[10] = heightDivisions
		updateConfigBuffer.unmap()
		onAbort(() => updateConfigBuffer.destroy())
	}
	const updateConfigBindGroupLayout = device.createBindGroupLayout({
		label: 'update config bind group layout',
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.COMPUTE,
				buffer: { type: 'uniform' },
			},
			{
				binding: 1,
				visibility: GPUShaderStage.COMPUTE,
				buffer: { type: 'read-only-storage' },
			}
		],
	})
	const updateConfigBindGroup = device.createBindGroup({
		label: 'update config bind group',
		layout: updateConfigBindGroupLayout,
		entries: [
			{ binding: 0, resource: { buffer: updateConfigBuffer } },
			{ binding: 1, resource: { buffer: particleInteractionsBuffer } }
		],
	})


	const updateBinsBindGroupLayout = device.createBindGroupLayout({
		label: 'update bins bind group layout',
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.COMPUTE,
				buffer: { type: 'read-only-storage' },
			},
			{
				binding: 1,
				visibility: GPUShaderStage.COMPUTE,
				buffer: { type: 'read-only-storage' },
			},
			{
				binding: 2,
				visibility: GPUShaderStage.COMPUTE,
				buffer: { type: 'read-only-storage' },
			},
		],
	})

	const updateBinsBindGroup = device.createBindGroup({
		label: 'update bins bind group',
		layout: updateBinsBindGroupLayout,
		entries: [
			{ binding: 0, resource: { buffer: binSizeBuffer } },
			{ binding: 1, resource: { buffer: binOffsetBuffer } },
			{ binding: 2, resource: { buffer: binContentsBuffer } },
		],
	})

	const updatePipelineLayout = device.createPipelineLayout({
		label: 'update pipeline layout',
		bindGroupLayouts: [
			updateTimeBindGroupLayout,
			updateParticlesBindGroupLayout,
			updateConfigBindGroupLayout,
			updateBinsBindGroupLayout,
		],
	})

	const updateComputeModule = device.createShaderModule({ code: updateShader, label: 'update shader module' })

	const updatePipeline = device.createComputePipeline({
		label: 'update compute pipeline',
		layout: updatePipelineLayout,
		compute: {
			module: updateComputeModule,
			entryPoint: 'update',
		},
	})

	const updateEncoderDescriptor: GPUObjectDescriptorBase = { label: 'update encoder' }
	const updatePassDescriptor: GPUComputePassDescriptor = { label: 'update compute pass' }
	function updateParticles(dt: number) {
		const encoder = device.createCommandEncoder(updateEncoderDescriptor)
		const pass = encoder.beginComputePass(updatePassDescriptor)
		pass.setPipeline(updatePipeline)
		device.queue.writeBuffer(updateTimeBuffer, 0, new Float32Array([dt]))

		pass.setBindGroup(0, updateTimeBindGroup)
		pass.setBindGroup(1, updateParticlesBindGroup)
		pass.setBindGroup(2, updateConfigBindGroup)
		pass.setBindGroup(3, updateBinsBindGroup)

		pass.dispatchWorkgroups(Math.ceil(particleCount / 256))

		pass.end()
		const commandBuffer = encoder.finish()
		device.queue.submit([commandBuffer])
	}



	const drawModule = device.createShaderModule({ code: drawShader, label: 'draw shader module' })
	const drawConfigBindGroupLayout = device.createBindGroupLayout({
		label: 'draw config bind group layout',
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: { type: 'uniform' },
			},
		],
	})
	const drawConfigBuffer = device.createBuffer({
		label: 'draw config uniform buffer',
		size: 2 * 4,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		mappedAtCreation: true,
	})
	{
		const buffer = drawConfigBuffer.getMappedRange()
		const asFloat32 = new Float32Array(buffer)
		asFloat32[0] = width
		asFloat32[1] = height
		drawConfigBuffer.unmap()
		onAbort(() => drawConfigBuffer.destroy())
	}
	const drawConfigBindGroup = device.createBindGroup({
		label: 'draw config bind group',
		layout: drawConfigBindGroupLayout,
		entries: [
			{ binding: 0, resource: { buffer: drawConfigBuffer } },
		],
	})
	const drawParticlesBindGroupLayout = device.createBindGroupLayout({
		label: 'draw particles bind group layout',
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: { type: 'read-only-storage' },
			},
			{
				binding: 1,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: { type: 'read-only-storage' },
			},
		],
	})
	const drawParticlesBindGroup = device.createBindGroup({
		label: 'draw particles bind group',
		layout: drawParticlesBindGroupLayout,
		entries: [
			{ binding: 0, resource: { buffer: particlePositionBuffer } },
			{ binding: 1, resource: { buffer: particleColorBuffer } },
		],
	})
	const drawPipelineLayout = device.createPipelineLayout({
		label: 'draw pipeline layout',
		bindGroupLayouts: [
			drawConfigBindGroupLayout,
			drawParticlesBindGroupLayout,
		],
	})
	const drawPipeline = device.createRenderPipeline({
		label: 'draw pipeline',
		layout: drawPipelineLayout,
		vertex: {
			module: drawModule,
			entryPoint: 'vs',
			buffers: [],
		},
		fragment: {
			module: drawModule,
			entryPoint: 'fs',
			targets: [{ format }],
		},
		primitive: {
			topology: 'point-list',
		},
	})
	const renderPassDescriptor = {
		label: 'draw render pass descriptor',
		colorAttachments: [
			{
				view: null! as GPUTextureView,
				clearValue: [0.1, 0.1, 0.1, 1],
				loadOp: 'clear',
				storeOp: 'store',
			},
		],
	} satisfies GPURenderPassDescriptor
	const drawEncoderDescriptor: GPUObjectDescriptorBase = { label: 'draw encoder' }

	function drawParticles() {
		renderPassDescriptor.colorAttachments[0].view = ctx.getCurrentTexture().createView()
		const encoder = device.createCommandEncoder(drawEncoderDescriptor)
		const pass = encoder.beginRenderPass(renderPassDescriptor)
		pass.setPipeline(drawPipeline)
		pass.setBindGroup(0, drawConfigBindGroup)
		pass.setBindGroup(1, drawParticlesBindGroup)
		pass.draw(1, particleCount)
		pass.end()
		const commandBuffer = encoder.finish()
		device.queue.submit([commandBuffer])
	}

	let playing = document.visibilityState === 'visible'
	let lastTime = performance.now()
	let rafId = requestAnimationFrame(function frame(time) {
		if (controller.signal.aborted) return
		rafId = requestAnimationFrame(frame)
		if (!playing) return
		const dt = time - lastTime
		lastTime = time
		onFrame(dt)
		computeBins()
		updateParticles(dt / 1000)
		drawParticles()
	})
	controller.signal.addEventListener('abort', () => cancelAnimationFrame(rafId), { once: true })

	window.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') {
			playing = true
			lastTime = performance.now()
		} else {
			playing = false
		}
	}, { signal: controller.signal })
}