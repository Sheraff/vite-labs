import type { RouteMeta } from "#router"

import { Head } from "#components/Head"
import { makeFrameCounter } from "#components/makeFrameCounter"
import { useEffect, useRef, useState } from "react"

import binShader from "./bin-fill.wgsl?raw"
import drawShader from "./draw.wgsl?raw"
import styles from "./styles.module.css"
import updateShader from "./update.wgsl?raw"

// const particleCount = 200_000
const particleCount = 100_000
// const particleCount = 20_000

export const meta: RouteMeta = {
	title: "Boids GPU",
	tags: ["simulation", "webgpu", "particles"],
	image: "./screen.png",
}

export default function BoidsGPUPage() {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const [supported] = useState(() => Boolean(navigator.gpu))
	const [fps, setFps] = useState(0)

	useEffect(() => {
		if (!supported) return
		const canvas = canvasRef.current!
		const controller = new AbortController()

		canvas.width = window.innerWidth * devicePixelRatio * 2
		canvas.height = window.innerHeight * devicePixelRatio * 2

		const frameCounter = makeFrameCounter(60)
		start({
			controller,
			canvas,
			onFrame: (dt) => setFps(Math.round(frameCounter(dt / 1000))),
			controls: {},
		})

		return () => {
			controller.abort()
		}
	}, [supported])

	const [numberFormat] = useState(() => new Intl.NumberFormat("en-US"))

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
				{!supported && <pre>Your browser does not support WebGPU.</pre>}
				{supported && (
					<>
						<pre>
							{numberFormat.format(particleCount)} boids, {fps} fps
						</pre>
					</>
				)}
			</div>
			<canvas ref={canvasRef} />
		</div>
	)
}

async function start({
	controller,
	canvas,
	onFrame,
	controls,
}: {
	controller: AbortController
	canvas: HTMLCanvasElement
	onFrame: (dt: number) => void
	controls: object
}) {
	const onAbort = (cb: () => void) => {
		if (controller.signal.aborted) return
		controller.signal.addEventListener("abort", cb, { once: true })
	}

	const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" })
	if (!adapter) throw new Error("No GPU adapter found")
	if (controller.signal.aborted) return

	const device = await adapter.requestDevice()
	if (!device) throw new Error("No GPU device found")
	if (controller.signal.aborted) return
	onAbort(() => device.destroy())
	device.lost.then((info) => info.reason !== "destroyed" && controller.abort())
	if (canvas.width > device.limits.maxTextureDimension2D || canvas.height > device.limits.maxTextureDimension2D)
		throw new Error(
			`Canvas size exceeds device limits: ${canvas.width}x${canvas.height} > ${device.limits.maxTextureDimension2D}`,
		)

	const ctx = canvas.getContext("webgpu")!
	if (!ctx) throw new Error("No WebGPU context found")
	const format = navigator.gpu.getPreferredCanvasFormat()
	ctx.configure({ device, format, alphaMode: "opaque" })
	onAbort(() => ctx.unconfigure())

	const width = ctx.canvas.width
	const height = ctx.canvas.height
	const depth = Math.round(Math.min(width, height) / 10) // z-axis range

	console.log('width', width, 'height', height, 'depth', depth)

	// Boids simulation parameters
	const visionRange = 60
	const separationRange = 25
	const separationStrength = 2.0
	const alignmentStrength = 1.0
	const cohesionStrength = 1.0
	const maxSpeed = 200
	const minSpeed = 50

	// Spatial binning setup (2D only - z is checked in update shader)
	const cellSize = visionRange
	const widthDivisions = Math.ceil(width / cellSize)
	const heightDivisions = Math.ceil(height / cellSize)
	const toBinX = widthDivisions / width
	const toBinY = heightDivisions / height
	const binCount = widthDivisions * heightDivisions

	// Boid position buffer (x, y, z) - using vec4 for alignment, w unused
	const boidPositionBuffer = device.createBuffer({
		label: "boid position storage buffer",
		size: particleCount * 4 * Float32Array.BYTES_PER_ELEMENT, // vec4 for alignment
		usage: GPUBufferUsage.STORAGE,
		mappedAtCreation: true,
	})
	{
		const arr = new Float32Array(boidPositionBuffer.getMappedRange())
		for (let i = 0; i < particleCount; i++) {
			arr[i * 4 + 0] = Math.random() * width
			arr[i * 4 + 1] = Math.random() * height
			arr[i * 4 + 2] = Math.random() * depth
			arr[i * 4 + 3] = 0 // unused
		}
		boidPositionBuffer.unmap()
		onAbort(() => boidPositionBuffer.destroy())
	}

	// Boid velocity buffer (vx, vy, vz) - using vec4 for alignment, w = speed
	const boidVelocityBuffer = device.createBuffer({
		label: "boid velocity storage buffer",
		size: particleCount * 4 * Float32Array.BYTES_PER_ELEMENT, // vec4 for alignment
		usage: GPUBufferUsage.STORAGE,
		mappedAtCreation: true,
	})
	{
		const arr = new Float32Array(boidVelocityBuffer.getMappedRange())
		for (let i = 0; i < particleCount; i++) {
			// Random initial direction
			const theta = Math.random() * Math.PI * 2
			const phi = Math.acos(2 * Math.random() - 1)
			const speed = minSpeed + Math.random() * (maxSpeed - minSpeed)
			arr[i * 4 + 0] = Math.sin(phi) * Math.cos(theta) * speed
			arr[i * 4 + 1] = Math.sin(phi) * Math.sin(theta) * speed
			arr[i * 4 + 2] = Math.cos(phi) * speed
			arr[i * 4 + 3] = speed
		}
		boidVelocityBuffer.unmap()
		onAbort(() => boidVelocityBuffer.destroy())
	}

	// Spatial binning buffers
	const binSizeBuffer = device.createBuffer({
		label: "bin size storage buffer",
		size: binCount * Uint32Array.BYTES_PER_ELEMENT,
		usage: GPUBufferUsage.STORAGE,
	})
	onAbort(() => binSizeBuffer.destroy())

	const binOffsetBuffer = device.createBuffer({
		label: "bin offset storage buffer",
		size: binCount * Uint32Array.BYTES_PER_ELEMENT,
		usage: GPUBufferUsage.STORAGE,
	})
	onAbort(() => binOffsetBuffer.destroy())

	const binCursorBuffer = device.createBuffer({
		label: "bin cursor storage buffer",
		size: binCount * Uint32Array.BYTES_PER_ELEMENT,
		usage: GPUBufferUsage.STORAGE,
	})
	onAbort(() => binCursorBuffer.destroy())

	const binContentsBuffer = device.createBuffer({
		label: "bin contents storage buffer",
		size: particleCount * Uint32Array.BYTES_PER_ELEMENT,
		usage: GPUBufferUsage.STORAGE,
	})
	onAbort(() => binContentsBuffer.destroy())

	// Bin config uniform buffer
	const binConfigBuffer = device.createBuffer({
		label: "bin config uniform buffer",
		size: 6 * 4, // 6 values (2D binning)
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		mappedAtCreation: true,
	})
	{
		const buffer = binConfigBuffer.getMappedRange()
		const asFloat32 = new Float32Array(buffer)
		const asUint32 = new Uint32Array(buffer)
		asFloat32[0] = toBinX
		asFloat32[1] = toBinY
		asUint32[2] = widthDivisions
		asUint32[3] = binCount
		asUint32[4] = particleCount
		asUint32[5] = 0 // padding
		binConfigBuffer.unmap()
		onAbort(() => binConfigBuffer.destroy())
	}

	// Bind group layouts for binning
	const binConfigBindGroupLayout = device.createBindGroupLayout({
		label: "bin config bind group layout",
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.COMPUTE,
				buffer: { type: "uniform" },
			},
		],
	})
	const binConfigBindGroup = device.createBindGroup({
		label: "bin config bind group",
		layout: binConfigBindGroupLayout,
		entries: [{ binding: 0, resource: { buffer: binConfigBuffer } }],
	})

	const binBindGroupLayout = device.createBindGroupLayout({
		label: "bin bind group layout",
		entries: [
			{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
			{ binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
			{ binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
			{ binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
		],
	})
	const binBindGroup = device.createBindGroup({
		label: "bin bind group",
		layout: binBindGroupLayout,
		entries: [
			{ binding: 0, resource: { buffer: binSizeBuffer } },
			{ binding: 1, resource: { buffer: binOffsetBuffer } },
			{ binding: 2, resource: { buffer: binCursorBuffer } },
			{ binding: 3, resource: { buffer: binContentsBuffer } },
		],
	})

	const boidPositionBindGroupLayout = device.createBindGroupLayout({
		label: "boid position bind group layout",
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.COMPUTE,
				buffer: { type: "read-only-storage" },
			},
		],
	})
	const boidPositionBindGroup = device.createBindGroup({
		label: "boid position bind group",
		layout: boidPositionBindGroupLayout,
		entries: [{ binding: 0, resource: { buffer: boidPositionBuffer } }],
	})

	const binPipelineLayout = device.createPipelineLayout({
		label: "bin pipeline layout",
		bindGroupLayouts: [binConfigBindGroupLayout, binBindGroupLayout, boidPositionBindGroupLayout],
	})

	const binComputeModule = device.createShaderModule({
		label: "bin compute module",
		code: binShader,
	})

	const binClearPipeline = device.createComputePipeline({
		label: "bin clear compute pipeline",
		layout: binPipelineLayout,
		compute: { module: binComputeModule, entryPoint: "clear" },
	})
	const binSizePipeline = device.createComputePipeline({
		label: "bin size compute pipeline",
		layout: binPipelineLayout,
		compute: { module: binComputeModule, entryPoint: "size" },
	})
	const binPreparePipeline = device.createComputePipeline({
		label: "bin prepare compute pipeline",
		layout: binPipelineLayout,
		compute: { module: binComputeModule, entryPoint: "prepare" },
	})
	const binFillPipeline = device.createComputePipeline({
		label: "bin fill compute pipeline",
		layout: binPipelineLayout,
		compute: { module: binComputeModule, entryPoint: "fill" },
	})

	const binEncoderDescriptor: GPUObjectDescriptorBase = { label: "bin encoder" }
	const binPassDescriptor: GPUComputePassDescriptor = { label: "bin compute pass" }
	function computeBins() {
		const encoder = device.createCommandEncoder(binEncoderDescriptor)
		const pass = encoder.beginComputePass(binPassDescriptor)
		pass.setBindGroup(0, binConfigBindGroup)
		pass.setBindGroup(1, binBindGroup)
		pass.setBindGroup(2, boidPositionBindGroup)

		pass.setPipeline(binClearPipeline)
		pass.dispatchWorkgroups(Math.ceil(binCount / 64))

		pass.setPipeline(binSizePipeline)
		pass.dispatchWorkgroups(Math.ceil(particleCount / 64))

		pass.setPipeline(binPreparePipeline)
		pass.dispatchWorkgroups(Math.ceil(binCount / 64))

		pass.setPipeline(binFillPipeline)
		pass.dispatchWorkgroups(Math.ceil(particleCount / 64))

		pass.end()
		device.queue.submit([encoder.finish()])
	}

	// Update pipeline setup
	const updateTimeBuffer = device.createBuffer({
		label: "update time uniform buffer",
		size: 4,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	})
	onAbort(() => updateTimeBuffer.destroy())

	const updateTimeBindGroupLayout = device.createBindGroupLayout({
		label: "update time bind group layout",
		entries: [
			{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
		],
	})
	const updateTimeBindGroup = device.createBindGroup({
		label: "update time bind group",
		layout: updateTimeBindGroupLayout,
		entries: [{ binding: 0, resource: { buffer: updateTimeBuffer } }],
	})

	const updateBoidsBindGroupLayout = device.createBindGroupLayout({
		label: "update boids bind group layout",
		entries: [
			{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
			{ binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
		],
	})
	const updateBoidsBindGroup = device.createBindGroup({
		label: "update boids bind group",
		layout: updateBoidsBindGroupLayout,
		entries: [
			{ binding: 0, resource: { buffer: boidPositionBuffer } },
			{ binding: 1, resource: { buffer: boidVelocityBuffer } },
		],
	})

	// Update config buffer
	const updateConfigBuffer = device.createBuffer({
		label: "update config uniform buffer",
		size: 16 * 4, // 16 values
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		mappedAtCreation: true,
	})
	{
		const buffer = updateConfigBuffer.getMappedRange()
		const asFloat32 = new Float32Array(buffer)
		const asUint32 = new Uint32Array(buffer)
		asFloat32[0] = width
		asFloat32[1] = height
		asFloat32[2] = depth
		asUint32[3] = particleCount
		// Boids parameters
		asFloat32[4] = visionRange
		asFloat32[5] = separationRange
		asFloat32[6] = separationStrength
		asFloat32[7] = alignmentStrength
		asFloat32[8] = cohesionStrength
		asFloat32[9] = maxSpeed
		asFloat32[10] = minSpeed
		// Binning info (2D only)
		asFloat32[11] = toBinX
		asFloat32[12] = toBinY
		asUint32[13] = widthDivisions
		asUint32[14] = heightDivisions
		asUint32[15] = 0 // padding
		updateConfigBuffer.unmap()
		onAbort(() => updateConfigBuffer.destroy())
	}

	const updateConfigBindGroupLayout = device.createBindGroupLayout({
		label: "update config bind group layout",
		entries: [
			{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
		],
	})
	const updateConfigBindGroup = device.createBindGroup({
		label: "update config bind group",
		layout: updateConfigBindGroupLayout,
		entries: [{ binding: 0, resource: { buffer: updateConfigBuffer } }],
	})

	const updateBinsBindGroupLayout = device.createBindGroupLayout({
		label: "update bins bind group layout",
		entries: [
			{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
			{ binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
			{ binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
		],
	})
	const updateBinsBindGroup = device.createBindGroup({
		label: "update bins bind group",
		layout: updateBinsBindGroupLayout,
		entries: [
			{ binding: 0, resource: { buffer: binSizeBuffer } },
			{ binding: 1, resource: { buffer: binOffsetBuffer } },
			{ binding: 2, resource: { buffer: binContentsBuffer } },
		],
	})

	const updatePipelineLayout = device.createPipelineLayout({
		label: "update pipeline layout",
		bindGroupLayouts: [
			updateTimeBindGroupLayout,
			updateBoidsBindGroupLayout,
			updateConfigBindGroupLayout,
			updateBinsBindGroupLayout,
		],
	})

	const updateComputeModule = device.createShaderModule({
		code: updateShader,
		label: "update shader module",
	})

	const updatePipeline = device.createComputePipeline({
		label: "update compute pipeline",
		layout: updatePipelineLayout,
		compute: { module: updateComputeModule, entryPoint: "update" },
	})

	const updateEncoderDescriptor: GPUObjectDescriptorBase = { label: "update encoder" }
	const updatePassDescriptor: GPUComputePassDescriptor = { label: "update compute pass" }
	function updateBoids(dt: number) {
		device.queue.writeBuffer(updateTimeBuffer, 0, new Float32Array([dt]))
		const encoder = device.createCommandEncoder(updateEncoderDescriptor)
		const pass = encoder.beginComputePass(updatePassDescriptor)
		pass.setPipeline(updatePipeline)
		pass.setBindGroup(0, updateTimeBindGroup)
		pass.setBindGroup(1, updateBoidsBindGroup)
		pass.setBindGroup(2, updateConfigBindGroup)
		pass.setBindGroup(3, updateBinsBindGroup)
		pass.dispatchWorkgroups(Math.ceil(particleCount / 64))
		pass.end()
		device.queue.submit([encoder.finish()])
	}

	// Draw pipeline setup
	const drawModule = device.createShaderModule({ code: drawShader, label: "draw shader module" })

	// Depth texture for z-ordering (closer boids drawn on top)
	const depthTexture = device.createTexture({
		label: "depth texture",
		size: [width, height],
		format: "depth24plus",
		usage: GPUTextureUsage.RENDER_ATTACHMENT,
	})
	onAbort(() => depthTexture.destroy())
	const depthTextureView = depthTexture.createView()

	const drawConfigBuffer = device.createBuffer({
		label: "draw config uniform buffer",
		size: 4 * 4, // width, height, depth, padding
		usage: GPUBufferUsage.UNIFORM,
		mappedAtCreation: true,
	})
	{
		const arr = new Float32Array(drawConfigBuffer.getMappedRange())
		arr[0] = width
		arr[1] = height
		arr[2] = depth
		arr[3] = 0 // padding
		drawConfigBuffer.unmap()
		onAbort(() => drawConfigBuffer.destroy())
	}

	const drawConfigBindGroupLayout = device.createBindGroupLayout({
		label: "draw config bind group layout",
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: { type: "uniform" },
			},
		],
	})
	const drawConfigBindGroup = device.createBindGroup({
		label: "draw config bind group",
		layout: drawConfigBindGroupLayout,
		entries: [{ binding: 0, resource: { buffer: drawConfigBuffer } }],
	})

	const drawBoidsBindGroupLayout = device.createBindGroupLayout({
		label: "draw boids bind group layout",
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: { type: "read-only-storage" },
			},
			{
				binding: 1,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: { type: "read-only-storage" },
			},
		],
	})
	const drawBoidsBindGroup = device.createBindGroup({
		label: "draw boids bind group",
		layout: drawBoidsBindGroupLayout,
		entries: [
			{ binding: 0, resource: { buffer: boidPositionBuffer } },
			{ binding: 1, resource: { buffer: boidVelocityBuffer } },
		],
	})

	const drawPipelineLayout = device.createPipelineLayout({
		label: "draw pipeline layout",
		bindGroupLayouts: [drawConfigBindGroupLayout, drawBoidsBindGroupLayout],
	})

	const drawPipeline = device.createRenderPipeline({
		label: "draw pipeline",
		layout: drawPipelineLayout,
		vertex: {
			module: drawModule,
			entryPoint: "vs",
			buffers: [],
		},
		fragment: {
			module: drawModule,
			entryPoint: "fs",
			targets: [
				{
					format,
					blend: {
						color: {
							srcFactor: "src-alpha",
							dstFactor: "one-minus-src-alpha",
							operation: "add",
						},
						alpha: {
							srcFactor: "one",
							dstFactor: "one-minus-src-alpha",
							operation: "add",
						},
					},
				},
			],
		},
		depthStencil: {
			format: "depth24plus",
			depthWriteEnabled: true,
			depthCompare: "less", // closer (smaller z) wins
		},
	})

	const renderPassDescriptor = {
		label: "draw render pass descriptor",
		colorAttachments: [
			{
				view: null! as GPUTextureView,
				clearValue: [0.02, 0.02, 0.04, 1],
				loadOp: "clear",
				storeOp: "store",
			},
		],
		depthStencilAttachment: {
			view: depthTextureView,
			depthClearValue: 1.0, // far plane
			depthLoadOp: "clear",
			depthStoreOp: "store",
		},
	} satisfies GPURenderPassDescriptor
	const drawEncoderDescriptor: GPUObjectDescriptorBase = { label: "draw encoder" }

	function drawBoids() {
		renderPassDescriptor.colorAttachments[0].view = ctx.getCurrentTexture().createView()
		const encoder = device.createCommandEncoder(drawEncoderDescriptor)
		const pass = encoder.beginRenderPass(renderPassDescriptor)
		pass.setPipeline(drawPipeline)
		pass.setBindGroup(0, drawConfigBindGroup)
		pass.setBindGroup(1, drawBoidsBindGroup)
		pass.draw(3, particleCount) // 3 vertices per triangle (boid shape)
		pass.end()
		device.queue.submit([encoder.finish()])
	}

	// Animation loop
	let frameCount = 0
	let playing = document.visibilityState === "visible"
	let lastTime = performance.now()
	let rafId = requestAnimationFrame(function frame(time) {
		if (controller.signal.aborted) return
		rafId = requestAnimationFrame(frame)
		if (!playing) return
		const dt = time - lastTime
		lastTime = time
		frameCount++
		onFrame(dt)

		// Recompute bins every few frames for performance
		if (frameCount > 2) {
			computeBins()
			frameCount = 0
		}

		const scaledDt = Math.min(dt, 16.6667) // Cap at 60fps equivalent
		updateBoids(scaledDt / 1000)
		drawBoids()
	})
	controller.signal.addEventListener("abort", () => cancelAnimationFrame(rafId), { once: true })

	window.addEventListener(
		"visibilitychange",
		() => {
			if (document.visibilityState === "visible") {
				playing = true
				lastTime = performance.now()
			} else {
				playing = false
			}
		},
		{ signal: controller.signal },
	)

}