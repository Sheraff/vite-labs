import { useEffect, useRef, useState } from 'react'
import styles from './styles.module.css'
import type { BoardConfig } from './types'

type Tool = 'bumper' | 'triangular' | 'rail' | 'curve' | 'flipper' | 'bezier' | 'select' | 'delete'

interface Props {
	width: number
	height: number
	onSave: (config: BoardConfig) => void
	initialConfig?: BoardConfig
}

export function LevelEditor({ width, height, onSave, initialConfig }: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const [tool, setTool] = useState<Tool>('select')
	const [config, setConfig] = useState<BoardConfig>(initialConfig || {
		bumpers: [],
		triangularBumpers: [],
		rails: [],
		curves: [],
		flippers: [],
		bezierPaths: []
	})
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [railStart, setRailStart] = useState<{ x: number; y: number } | null>(null)
	const [triangleVertices, setTriangleVertices] = useState<Array<{ x: number; y: number }>>([])
	const [bezierPoints, setBezierPoints] = useState<Array<{ x: number; y: number }>>([])
	const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
	const [isAltPressed, setIsAltPressed] = useState(false)
	const [isDragging, setIsDragging] = useState(false)
	const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
	const [dragVertex, setDragVertex] = useState<{ type: 'triangle' | 'rail' | 'bezier', vertex: number } | null>(null)
	const [canvasDimensions, setCanvasDimensions] = useState({ width: 800, height: 1200 })
	const toolbarRef = useRef<HTMLDivElement>(null)
	const instructionsRef = useRef<HTMLDivElement>(null)

	// Calculate canvas dimensions based on available space
	useEffect(() => {
		const calculateDimensions = () => {
			const gameAspectRatio = width / height

			// Account for padding (2em = ~32px), toolbar, instructions, and gaps
			const toolbarHeight = toolbarRef.current?.offsetHeight || 0
			const instructionsHeight = instructionsRef.current?.offsetHeight || 0
			const padding = 32 // 1em padding from .main
			const gaps = 32 // gaps between elements

			const availableWidth = window.innerWidth - padding * 2
			const availableHeight = window.innerHeight - padding * 2 - toolbarHeight - instructionsHeight - gaps
			const availableAspectRatio = availableWidth / availableHeight

			let canvasWidth: number
			let canvasHeight: number

			if (availableAspectRatio > gameAspectRatio) {
				// Available space is wider than game ratio - constrain by height
				canvasHeight = availableHeight
				canvasWidth = canvasHeight * gameAspectRatio
			} else {
				// Available space is taller than game ratio - constrain by width
				canvasWidth = availableWidth
				canvasHeight = canvasWidth / gameAspectRatio
			}

			setCanvasDimensions({ width: canvasWidth, height: canvasHeight })
		}

		calculateDimensions()
		window.addEventListener('resize', calculateDimensions)
		return () => window.removeEventListener('resize', calculateDimensions)
	}, [width, height])

	// Draw the editor view
	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		const ctx = canvas.getContext('2d')!
		ctx.save()
		ctx.setTransform(1, 0, 0, 1, 0, 0) // Reset transform

		// Calculate scale to map game coordinates to canvas display coordinates
		const scaleX = canvasDimensions.width / width * window.devicePixelRatio
		const scaleY = canvasDimensions.height / height * window.devicePixelRatio
		ctx.scale(scaleX, scaleY)

		// Clear canvas
		ctx.fillStyle = '#001122'
		ctx.fillRect(0, 0, width, height)		// Draw grid
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
		ctx.lineWidth = 1
		const gridSize = 20
		for (let x = 0; x < width; x += gridSize) {
			ctx.beginPath()
			ctx.moveTo(x, 0)
			ctx.lineTo(x, height)
			ctx.stroke()
		}
		for (let y = 0; y < height; y += gridSize) {
			ctx.beginPath()
			ctx.moveTo(0, y)
			ctx.lineTo(width, y)
			ctx.stroke()
		}

		// Draw all objects
		config.bumpers.forEach((b) => {
			ctx.beginPath()
			ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2)
			ctx.fillStyle = selectedId === b.id ? '#ff9ff3' : '#ff6b6b'
			ctx.fill()
			ctx.strokeStyle = '#ff4757'
			ctx.lineWidth = 2
			ctx.stroke()

			// Draw points text
			ctx.fillStyle = '#fff'
			ctx.font = '12px Arial'
			ctx.textAlign = 'center'
			ctx.fillText(`${b.points}`, b.x, b.y + 4)
		})

		config.triangularBumpers.forEach((t) => {
			// Draw fill
			ctx.beginPath()
			ctx.moveTo(t.v1.x, t.v1.y)
			ctx.lineTo(t.v2.x, t.v2.y)
			ctx.lineTo(t.v3.x, t.v3.y)
			ctx.closePath()
			ctx.fillStyle = selectedId === t.id ? '#ffd93d' : '#f6b93b'
			ctx.fill()

			// Draw edges with different styles based on type
			const edges = [
				{ v1: t.v1, v2: t.v2, bouncy: t.edge1Bouncy },
				{ v1: t.v2, v2: t.v3, bouncy: t.edge2Bouncy },
				{ v1: t.v3, v2: t.v1, bouncy: t.edge3Bouncy }
			]

			edges.forEach(edge => {
				ctx.beginPath()
				ctx.moveTo(edge.v1.x, edge.v1.y)
				ctx.lineTo(edge.v2.x, edge.v2.y)
				if (edge.bouncy) {
					ctx.strokeStyle = '#e55039' // orange for bouncy
				} else {
					ctx.strokeStyle = '#ddd' // gray for static
				}
				ctx.lineWidth = 3
				ctx.stroke()
			})

			// Draw vertices as handles
			if (selectedId === t.id) {
				[t.v1, t.v2, t.v3].forEach(v => {
					ctx.beginPath()
					ctx.arc(v.x, v.y, 4, 0, Math.PI * 2)
					ctx.fillStyle = '#fff'
					ctx.fill()
					ctx.strokeStyle = '#e55039'
					ctx.lineWidth = 2
					ctx.stroke()
				})
			}

			const centerX = (t.v1.x + t.v2.x + t.v3.x) / 3
			const centerY = (t.v1.y + t.v2.y + t.v3.y) / 3
			ctx.fillStyle = '#fff'
			ctx.font = '12px Arial'
			ctx.textAlign = 'center'
			ctx.fillText(`${t.points}`, centerX, centerY + 4)
		})

		config.rails.forEach((r) => {
			ctx.beginPath()
			ctx.moveTo(r.x1, r.y1)
			ctx.lineTo(r.x2, r.y2)
			ctx.strokeStyle = selectedId === r.id ? '#fff' : '#ddd'
			ctx.lineWidth = r.radius * 2
			ctx.lineCap = 'round'
			ctx.stroke()

			// Draw endpoint handles when selected
			if (selectedId === r.id) {
				[{ x: r.x1, y: r.y1 }, { x: r.x2, y: r.y2 }].forEach(v => {
					ctx.beginPath()
					ctx.arc(v.x, v.y, 4, 0, Math.PI * 2)
					ctx.fillStyle = '#fff'
					ctx.fill()
					ctx.strokeStyle = '#48dbfb'
					ctx.lineWidth = 2
					ctx.stroke()
				})
			}
		})

		config.curves.forEach((c) => {
			ctx.beginPath()
			ctx.arc(c.x, c.y, c.radius, c.startAngle, c.endAngle)
			ctx.strokeStyle = selectedId === c.id ? '#fff' : '#48dbfb'
			ctx.lineWidth = c.thickness
			ctx.lineCap = 'round'
			ctx.stroke()

			// Draw center point
			ctx.beginPath()
			ctx.arc(c.x, c.y, 3, 0, Math.PI * 2)
			ctx.fillStyle = '#ff4757'
			ctx.fill()
		})

		config.flippers.forEach((f) => {
			ctx.save()
			ctx.translate(f.x, f.y)
			const angle = f.side === 'left' ? Math.PI / 6 : -Math.PI / 6
			ctx.rotate(angle)

			ctx.fillStyle = selectedId === f.id ? '#fff' : '#48dbfb'
			ctx.strokeStyle = '#0abde3'
			ctx.lineWidth = 2

			if (f.side === 'left') {
				ctx.fillRect(0, -f.width / 2, f.length, f.width)
				ctx.strokeRect(0, -f.width / 2, f.length, f.width)
			} else {
				ctx.fillRect(-f.length, -f.width / 2, f.length, f.width)
				ctx.strokeRect(-f.length, -f.width / 2, f.length, f.width)
			}

			ctx.restore()
		})

		// Draw bezier paths
		config.bezierPaths?.forEach((b) => {
			const drawBezierSegment = (p0: any, p1: any, p2: any, p3: any, halfWidth: number, side: number, isFirst: boolean) => {
				const samples = 50

				for (let i = 0; i <= samples; i++) {
					const t = i / samples
					const mt = 1 - t
					const mt2 = mt * mt
					const mt3 = mt2 * mt
					const t2 = t * t
					const t3 = t2 * t

					// Bezier point
					const px = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x
					const py = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y

					// Bezier derivative (tangent)
					const tx = 3 * mt2 * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t2 * (p3.x - p2.x)
					const ty = 3 * mt2 * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t2 * (p3.y - p2.y)
					const tlen = Math.sqrt(tx * tx + ty * ty)

					// Normal vector
					const nx = -ty / tlen
					const ny = tx / tlen

					// Offset point
					const offsetX = px + nx * halfWidth * side
					const offsetY = py + ny * halfWidth * side

					if (i === 0 && isFirst) {
						ctx.moveTo(offsetX, offsetY)
					} else {
						ctx.lineTo(offsetX, offsetY)
					}
				}
			}

			const halfWidth = b.trackWidth / 2

			// Draw segments for each side
			for (let side = -1; side <= 1; side += 2) {
				ctx.beginPath()

				// Draw all segments
				for (let i = 0; i < b.points.length - 3; i += 3) {
					drawBezierSegment(
						b.points[i],
						b.points[i + 1],
						b.points[i + 2],
						b.points[i + 3],
						halfWidth,
						side,
						i === 0
					)
				}

				ctx.strokeStyle = selectedId === b.id ? '#fff' : '#48dbfb'
				ctx.lineWidth = 3
				ctx.lineCap = 'round'
				ctx.lineJoin = 'round'
				ctx.stroke()
			}

			// Draw entrance indicators
			ctx.beginPath()
			ctx.arc(b.points[0].x, b.points[0].y, 5, 0, Math.PI * 2)
			ctx.fillStyle = '#00d2d3'
			ctx.fill()

			ctx.beginPath()
			ctx.arc(b.points[b.points.length - 1].x, b.points[b.points.length - 1].y, 5, 0, Math.PI * 2)
			ctx.fillStyle = '#00d2d3'
			ctx.fill()

			// Draw control points when selected
			if (selectedId === b.id) {
				// Control lines for each segment
				ctx.globalAlpha = 0.5
				for (let i = 0; i < b.points.length - 3; i += 3) {
					ctx.beginPath()
					ctx.moveTo(b.points[i].x, b.points[i].y)
					ctx.lineTo(b.points[i + 1].x, b.points[i + 1].y)
					ctx.strokeStyle = '#aaa'
					ctx.lineWidth = 1
					ctx.stroke()

					ctx.beginPath()
					ctx.moveTo(b.points[i + 3].x, b.points[i + 3].y)
					ctx.lineTo(b.points[i + 2].x, b.points[i + 2].y)
					ctx.stroke()
				}
				ctx.globalAlpha = 1

				// Control point handles
				b.points.forEach((p, i) => {
					const isEndpoint = i === 0 || i === b.points.length - 1 || i % 3 === 0
					ctx.beginPath()
					ctx.arc(p.x, p.y, isEndpoint ? 5 : 4, 0, Math.PI * 2)
					ctx.fillStyle = isEndpoint ? '#00d2d3' : '#fff'
					ctx.fill()
					ctx.strokeStyle = '#48dbfb'
					ctx.lineWidth = 2
					ctx.stroke()
				})
			}
		})

		// Draw launch lane (always visible)
		const launchLaneWidth = 40
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
		ctx.lineWidth = 2
		ctx.setLineDash([5, 5])
		ctx.beginPath()
		ctx.moveTo(width - launchLaneWidth, 80)
		ctx.lineTo(width - launchLaneWidth, height)
		ctx.stroke()
		ctx.setLineDash([])

		// Draw plunger area
		ctx.fillStyle = 'rgba(231, 76, 60, 0.1)'
		ctx.fillRect(width - launchLaneWidth, height - 150, launchLaneWidth, 150)
		ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
		ctx.font = '10px Arial'
		ctx.textAlign = 'center'
		ctx.fillText('LAUNCH', width - launchLaneWidth / 2, height - 130)
		ctx.fillText('LANE', width - launchLaneWidth / 2, height - 118)

		// Draw in-progress triangle vertices
		if (tool === 'triangular' && triangleVertices.length > 0) {
			ctx.globalAlpha = 1
			triangleVertices.forEach((v, i) => {
				ctx.beginPath()
				ctx.arc(v.x, v.y, 5, 0, Math.PI * 2)
				ctx.fillStyle = '#fff'
				ctx.fill()
				ctx.strokeStyle = '#f6b93b'
				ctx.lineWidth = 2
				ctx.stroke()
				// Draw number
				ctx.fillStyle = '#001122'
				ctx.font = 'bold 10px Arial'
				ctx.textAlign = 'center'
				ctx.fillText(`${i + 1}`, v.x, v.y + 3)
			})
			// Draw lines between vertices
			if (triangleVertices.length >= 2) {
				ctx.beginPath()
				ctx.moveTo(triangleVertices[0].x, triangleVertices[0].y)
				for (let i = 1; i < triangleVertices.length; i++) {
					ctx.lineTo(triangleVertices[i].x, triangleVertices[i].y)
				}
				ctx.strokeStyle = 'rgba(246, 185, 59, 0.5)'
				ctx.lineWidth = 2
				ctx.stroke()
			}
		}

		// Draw in-progress bezier points
		if (tool === 'bezier' && bezierPoints.length > 0) {
			// Draw bezier points being created
			ctx.globalAlpha = 1
			bezierPoints.forEach((v, i) => {
				const isEndpoint = i === 0 || i === bezierPoints.length - 1 || (i >= 3 && (i - 3) % 3 === 0)
				ctx.beginPath()
				ctx.arc(v.x, v.y, isEndpoint ? 6 : 4, 0, Math.PI * 2)
				ctx.fillStyle = isEndpoint ? '#00d2d3' : '#fff'
				ctx.fill()
				ctx.strokeStyle = '#48dbfb'
				ctx.lineWidth = 2
				ctx.stroke()
				// Draw number
				ctx.fillStyle = '#001122'
				ctx.font = 'bold 10px Arial'
				ctx.textAlign = 'center'
				ctx.fillText(`${i + 1}`, v.x, v.y + 3)
			})

			// Draw control lines for all segments
			ctx.globalAlpha = 0.5
			if (bezierPoints.length >= 4) {
				for (let i = 0; i < bezierPoints.length - 3; i += 3) {
					ctx.beginPath()
					ctx.moveTo(bezierPoints[i].x, bezierPoints[i].y)
					ctx.lineTo(bezierPoints[i + 1].x, bezierPoints[i + 1].y)
					ctx.strokeStyle = '#aaa'
					ctx.lineWidth = 1
					ctx.stroke()

					ctx.beginPath()
					ctx.moveTo(bezierPoints[i + 3].x, bezierPoints[i + 3].y)
					ctx.lineTo(bezierPoints[i + 2].x, bezierPoints[i + 2].y)
					ctx.stroke()
				}
			}
			ctx.globalAlpha = 1

			// Draw all complete bezier curve segments
			if (bezierPoints.length >= 4) {
				ctx.globalAlpha = 0.6
				const samples = 30

				// Draw each complete segment
				for (let segIdx = 0; segIdx < Math.floor((bezierPoints.length - 1) / 3); segIdx++) {
					const baseIdx = segIdx * 3
					if (baseIdx + 3 >= bezierPoints.length) break

					const p0 = bezierPoints[baseIdx]
					const p1 = bezierPoints[baseIdx + 1]
					const p2 = bezierPoints[baseIdx + 2]
					const p3 = bezierPoints[baseIdx + 3]

					ctx.beginPath()
					for (let i = 0; i <= samples; i++) {
						const t = i / samples
						const mt = 1 - t
						const mt2 = mt * mt
						const mt3 = mt2 * mt
						const t2 = t * t
						const t3 = t2 * t

						const x = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x
						const y = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y

						if (i === 0) {
							ctx.moveTo(x, y)
						} else {
							ctx.lineTo(x, y)
						}
					}
					ctx.strokeStyle = '#48dbfb'
					ctx.lineWidth = 3
					ctx.stroke()
				}
				ctx.globalAlpha = 1
			}
		}

		// Draw preview of tool
		if (hoverPos && tool !== 'select' && tool !== 'delete') {
			ctx.globalAlpha = 0.5
			if (tool === 'bumper') {
				ctx.beginPath()
				ctx.arc(hoverPos.x, hoverPos.y, 20, 0, Math.PI * 2)
				ctx.fillStyle = '#ff6b6b'
				ctx.fill()
			} else if (tool === 'triangular') {
				if (triangleVertices.length === 0) {
					// Show preview of first vertex
					ctx.beginPath()
					ctx.arc(hoverPos.x, hoverPos.y, 4, 0, Math.PI * 2)
					ctx.fillStyle = '#f6b93b'
					ctx.fill()
				} else if (triangleVertices.length === 1) {
					// Show line from first vertex to cursor
					ctx.beginPath()
					ctx.moveTo(triangleVertices[0].x, triangleVertices[0].y)
					ctx.lineTo(hoverPos.x, hoverPos.y)
					ctx.strokeStyle = '#f6b93b'
					ctx.lineWidth = 3
					ctx.stroke()
					// Show vertices
					ctx.beginPath()
					ctx.arc(triangleVertices[0].x, triangleVertices[0].y, 4, 0, Math.PI * 2)
					ctx.fillStyle = '#f6b93b'
					ctx.fill()
					ctx.beginPath()
					ctx.arc(hoverPos.x, hoverPos.y, 4, 0, Math.PI * 2)
					ctx.fill()
				} else if (triangleVertices.length === 2) {
					// Show incomplete triangle
					ctx.beginPath()
					ctx.moveTo(triangleVertices[0].x, triangleVertices[0].y)
					ctx.lineTo(triangleVertices[1].x, triangleVertices[1].y)
					ctx.lineTo(hoverPos.x, hoverPos.y)
					ctx.closePath()
					ctx.fillStyle = '#f6b93b'
					ctx.fill()
						// Show vertices
						;[triangleVertices[0], triangleVertices[1], hoverPos].forEach(v => {
							ctx.beginPath()
							ctx.arc(v.x, v.y, 4, 0, Math.PI * 2)
							ctx.fillStyle = '#fff'
							ctx.fill()
						})
				}
			} else if (tool === 'rail' && railStart) {
				ctx.beginPath()
				ctx.moveTo(railStart.x, railStart.y)
				ctx.lineTo(hoverPos.x, hoverPos.y)
				ctx.strokeStyle = '#ddd'
				ctx.lineWidth = 24
				ctx.lineCap = 'round'
				ctx.stroke()
			} else if (tool === 'curve') {
				ctx.beginPath()
				ctx.arc(hoverPos.x, hoverPos.y, 40, -Math.PI, 0)
				ctx.strokeStyle = '#48dbfb'
				ctx.lineWidth = 10
				ctx.stroke()
			} else if (tool === 'flipper') {
				ctx.save()
				ctx.translate(hoverPos.x, hoverPos.y)
				const angle = isAltPressed ? -Math.PI / 6 : Math.PI / 6
				ctx.rotate(angle)
				ctx.fillStyle = '#48dbfb'
				if (isAltPressed) {
					ctx.fillRect(-70, -7.5, 70, 15)
				} else {
					ctx.fillRect(0, -7.5, 70, 15)
				}
				ctx.restore()
			} else if (tool === 'bezier') {
				if (bezierPoints.length === 0) {
					// Show preview of first point
					ctx.beginPath()
					ctx.arc(hoverPos.x, hoverPos.y, 5, 0, Math.PI * 2)
					ctx.fillStyle = '#00d2d3'
					ctx.fill()
				}
			}
			ctx.globalAlpha = 1
		}

		ctx.restore()
	}, [config, selectedId, tool, hoverPos, railStart, triangleVertices, bezierPoints, width, height, isAltPressed, canvasDimensions])

	const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
		const canvas = canvasRef.current!
		const rect = canvas.getBoundingClientRect()
		const x = ((e.clientX - rect.left) / canvasDimensions.width) * width
		const y = ((e.clientY - rect.top) / canvasDimensions.height) * height
		return { x, y }
	}

	const snapToGrid = (x: number, y: number, gridSize = 20) => {
		return {
			x: Math.round(x / gridSize) * gridSize,
			y: Math.round(y / gridSize) * gridSize
		}
	}

	const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
		const pos = getCanvasCoords(e)

		if (tool === 'select' && selectedId) {
			// First check if clicking on a vertex handle
			const triangular = config.triangularBumpers.find(t => t.id === selectedId)
			if (triangular) {
				const vertices = [triangular.v1, triangular.v2, triangular.v3]
				for (let i = 0; i < vertices.length; i++) {
					const v = vertices[i]
					const dist = Math.sqrt((v.x - pos.x) ** 2 + (v.y - pos.y) ** 2)
					if (dist < 8) { // Click threshold
						setDragVertex({ type: 'triangle', vertex: i })
						setIsDragging(true)
						return
					}
				}
			}

			const rail = config.rails.find(r => r.id === selectedId)
			if (rail) {
				const endpoints = [{ x: rail.x1, y: rail.y1 }, { x: rail.x2, y: rail.y2 }]
				for (let i = 0; i < endpoints.length; i++) {
					const v = endpoints[i]
					const dist = Math.sqrt((v.x - pos.x) ** 2 + (v.y - pos.y) ** 2)
					if (dist < 8) { // Click threshold
						setDragVertex({ type: 'rail', vertex: i })
						setIsDragging(true)
						return
					}
				}
			}

			const bezier = config.bezierPaths?.find(b => b.id === selectedId)
			if (bezier) {
				for (let i = 0; i < bezier.points.length; i++) {
					const v = bezier.points[i]
					const dist = Math.sqrt((v.x - pos.x) ** 2 + (v.y - pos.y) ** 2)
					if (dist < 8) { // Click threshold
						setDragVertex({ type: 'bezier', vertex: i })
						setIsDragging(true)
						return
					}
				}
			}

			// Check if clicking on the selected object to start dragging
			const selected =
				config.bumpers.find(b => b.id === selectedId) ||
				config.triangularBumpers.find(t => t.id === selectedId) ||
				config.rails.find(r => r.id === selectedId) ||
				config.curves.find(c => c.id === selectedId) ||
				config.flippers.find(f => f.id === selectedId) ||
				config.bezierPaths?.find(b => b.id === selectedId)

			if (selected) {
				let isOnObject = false
				let offsetX = 0
				let offsetY = 0

				if ('radius' in selected && 'x' in selected && !('v1' in selected)) {
					// Bumper
					const dist = Math.sqrt((selected.x - pos.x) ** 2 + (selected.y - pos.y) ** 2)
					if (dist < selected.radius) {
						isOnObject = true
						offsetX = selected.x - pos.x
						offsetY = selected.y - pos.y
					}
				} else if ('v1' in selected) {
					// Triangular bumper
					const t = selected as any
					const sign = (p1: { x: number, y: number }, p2: { x: number, y: number }, p3: { x: number, y: number }) =>
						(p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y)
					const d1 = sign(pos, t.v1, t.v2)
					const d2 = sign(pos, t.v2, t.v3)
					const d3 = sign(pos, t.v3, t.v1)
					const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0)
					const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0)
					if (!(hasNeg && hasPos)) {
						isOnObject = true
						const centerX = (t.v1.x + t.v2.x + t.v3.x) / 3
						const centerY = (t.v1.y + t.v2.y + t.v3.y) / 3
						offsetX = centerX - pos.x
						offsetY = centerY - pos.y
					}
				} else if ('x1' in selected) {
					// Rail
					const dist = distanceToSegment(pos, { x: selected.x1, y: selected.y1 }, { x: selected.x2, y: selected.y2 })
					if (dist < (selected as any).radius) {
						isOnObject = true
						const centerX = (selected.x1 + (selected as any).x2) / 2
						const centerY = (selected.y1 + (selected as any).y2) / 2
						offsetX = centerX - pos.x
						offsetY = centerY - pos.y
					}
				} else if ('startAngle' in selected) {
					// Curve
					const c = selected as any
					const dist = Math.sqrt((c.x - pos.x) ** 2 + (c.y - pos.y) ** 2)
					if (Math.abs(dist - c.radius) < c.thickness) {
						isOnObject = true
						offsetX = c.x - pos.x
						offsetY = c.y - pos.y
					}
				} else if ('side' in selected) {
					// Flipper
					const f = selected as any
					const dist = Math.sqrt((f.x - pos.x) ** 2 + (f.y - pos.y) ** 2)
					if (dist < f.length) {
						isOnObject = true
						offsetX = f.x - pos.x
						offsetY = f.y - pos.y
					}
				} else if ('points' in selected && Array.isArray((selected as any).points)) {
					// Bezier path
					const b = selected as any
					// Check if click is on any segment of the bezier curve
					const samples = 30

					for (let segIdx = 0; segIdx < b.points.length - 3; segIdx += 3) {
						const p0 = b.points[segIdx]
						const p1 = b.points[segIdx + 1]
						const p2 = b.points[segIdx + 2]
						const p3 = b.points[segIdx + 3]

						for (let i = 0; i <= samples; i++) {
							const t = i / samples
							const mt = 1 - t
							const mt2 = mt * mt
							const mt3 = mt2 * mt
							const t2 = t * t
							const t3 = t2 * t

							const x = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x
							const y = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y

							const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2)
							if (dist < b.trackWidth) {
								isOnObject = true
								// Calculate center of all points
								const centerX = b.points.reduce((sum: number, p: any) => sum + p.x, 0) / b.points.length
								const centerY = b.points.reduce((sum: number, p: any) => sum + p.y, 0) / b.points.length
								offsetX = centerX - pos.x
								offsetY = centerY - pos.y
								break
							}
						}
						if (isOnObject) break
					}
				}

				if (isOnObject) {
					setIsDragging(true)
					setDragOffset({ x: offsetX, y: offsetY })
					return
				}
			}
		}
	}

	const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
		if (isDragging) return // Don't process clicks while dragging

		const pos = getCanvasCoords(e)
		const snapped = e.shiftKey ? pos : snapToGrid(pos.x, pos.y)

		if (tool === 'select') {
			// Find clicked object
			let found = false

			// Check bumpers
			for (const b of config.bumpers) {
				const dist = Math.sqrt((b.x - pos.x) ** 2 + (b.y - pos.y) ** 2)
				if (dist < b.radius) {
					setSelectedId(b.id)
					found = true
					break
				}
			}

			if (!found) {
				// Check triangular bumpers
				for (const t of config.triangularBumpers) {
					// Point in triangle test
					const sign = (p1: { x: number, y: number }, p2: { x: number, y: number }, p3: { x: number, y: number }) =>
						(p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y)
					const d1 = sign(pos, t.v1, t.v2)
					const d2 = sign(pos, t.v2, t.v3)
					const d3 = sign(pos, t.v3, t.v1)
					const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0)
					const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0)
					if (!(hasNeg && hasPos)) {
						setSelectedId(t.id)
						found = true
						break
					}
				}
			}

			if (!found) {
				// Check rails
				for (const r of config.rails) {
					const dist = distanceToSegment(pos, { x: r.x1, y: r.y1 }, { x: r.x2, y: r.y2 })
					if (dist < r.radius) {
						setSelectedId(r.id)
						found = true
						break
					}
				}
			}

			if (!found) {
				// Check curves
				for (const c of config.curves) {
					const dist = Math.sqrt((c.x - pos.x) ** 2 + (c.y - pos.y) ** 2)
					if (Math.abs(dist - c.radius) < c.thickness) {
						const angle = Math.atan2(pos.y - c.y, pos.x - c.x)
						let normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle
						let startAngle = c.startAngle < 0 ? c.startAngle + 2 * Math.PI : c.startAngle
						let endAngle = c.endAngle < 0 ? c.endAngle + 2 * Math.PI : c.endAngle

						const withinAngle = (startAngle <= endAngle) ?
							(normalizedAngle >= startAngle && normalizedAngle <= endAngle) :
							(normalizedAngle >= startAngle || normalizedAngle <= endAngle)

						if (withinAngle) {
							setSelectedId(c.id)
							found = true
							break
						}
					}
				}
			}

			if (!found) {
				// Check flippers
				for (const f of config.flippers) {
					const dist = Math.sqrt((f.x - pos.x) ** 2 + (f.y - pos.y) ** 2)
					if (dist < f.length) {
						setSelectedId(f.id)
						found = true
						break
					}
				}
			}

			if (!found) {
				// Check bezier paths
				for (const b of config.bezierPaths || []) {
					// Check distance to all segments
					const samples = 30

					for (let segIdx = 0; segIdx < b.points.length - 3; segIdx += 3) {
						const p0 = b.points[segIdx]
						const p1 = b.points[segIdx + 1]
						const p2 = b.points[segIdx + 2]
						const p3 = b.points[segIdx + 3]

						for (let i = 0; i <= samples; i++) {
							const t = i / samples
							const mt = 1 - t
							const mt2 = mt * mt
							const mt3 = mt2 * mt
							const t2 = t * t
							const t3 = t2 * t

							const x = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x
							const y = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y

							const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2)
							if (dist < b.trackWidth) {
								setSelectedId(b.id)
								found = true
								break
							}
						}
						if (found) break
					}
					if (found) break
				}
			}

			if (!found) {
				setSelectedId(null)
			}
		} else if (tool === 'delete') {
			// Delete clicked object
			setConfig({
				bumpers: config.bumpers.filter(b => {
					const dist = Math.sqrt((b.x - pos.x) ** 2 + (b.y - pos.y) ** 2)
					return dist >= b.radius
				}),
				triangularBumpers: config.triangularBumpers.filter(t => {
					const sign = (p1: { x: number, y: number }, p2: { x: number, y: number }, p3: { x: number, y: number }) =>
						(p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y)
					const d1 = sign(pos, t.v1, t.v2)
					const d2 = sign(pos, t.v2, t.v3)
					const d3 = sign(pos, t.v3, t.v1)
					const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0)
					const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0)
					return hasNeg && hasPos
				}),
				rails: config.rails.filter(r => {
					const dist = distanceToSegment(pos, { x: r.x1, y: r.y1 }, { x: r.x2, y: r.y2 })
					return dist >= r.radius
				}),
				curves: config.curves.filter(c => {
					const dist = Math.sqrt((c.x - pos.x) ** 2 + (c.y - pos.y) ** 2)
					if (Math.abs(dist - c.radius) >= c.thickness) return true
					const angle = Math.atan2(pos.y - c.y, pos.x - c.x)
					let normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle
					let startAngle = c.startAngle < 0 ? c.startAngle + 2 * Math.PI : c.startAngle
					let endAngle = c.endAngle < 0 ? c.endAngle + 2 * Math.PI : c.endAngle

					const withinAngle = (startAngle <= endAngle) ?
						(normalizedAngle >= startAngle && normalizedAngle <= endAngle) :
						(normalizedAngle >= startAngle || normalizedAngle <= endAngle)

					return !withinAngle
				}),
				flippers: config.flippers.filter(f => {
					const dist = Math.sqrt((f.x - pos.x) ** 2 + (f.y - pos.y) ** 2)
					return dist >= f.length
				}),
				bezierPaths: (config.bezierPaths || []).filter(b => {
					// Check distance to all segments of the bezier curve
					const samples = 30

					for (let segIdx = 0; segIdx < b.points.length - 3; segIdx += 3) {
						const p0 = b.points[segIdx]
						const p1 = b.points[segIdx + 1]
						const p2 = b.points[segIdx + 2]
						const p3 = b.points[segIdx + 3]

						for (let i = 0; i <= samples; i++) {
							const t = i / samples
							const mt = 1 - t
							const mt2 = mt * mt
							const mt3 = mt2 * mt
							const t2 = t * t
							const t3 = t2 * t

							const x = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x
							const y = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y

							const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2)
							if (dist < b.trackWidth) {
								return false // Delete this one
							}
						}
					}
					return true // Keep this one
				})
			})
		} else if (tool === 'bumper') {
			setConfig({
				...config,
				bumpers: [...config.bumpers, {
					id: `bumper-${Date.now()}`,
					x: snapped.x,
					y: snapped.y,
					radius: 20,
					points: 100
				}]
			})
		} else if (tool === 'triangular') {
			if (triangleVertices.length < 2) {
				// Add vertex
				setTriangleVertices([...triangleVertices, snapped])
			} else {
				// Third click - complete the triangle
				setConfig({
					...config,
					triangularBumpers: [...config.triangularBumpers, {
						id: `triangular-${Date.now()}`,
						v1: triangleVertices[0],
						v2: triangleVertices[1],
						v3: snapped,
						points: 250,
						edge1Bouncy: true,
						edge2Bouncy: true,
						edge3Bouncy: true
					}]
				})
				setTriangleVertices([])
			}
		} else if (tool === 'rail') {
			if (!railStart) {
				setRailStart(snapped)
			} else {
				setConfig({
					...config,
					rails: [...config.rails, {
						id: `rail-${Date.now()}`,
						x1: railStart.x,
						y1: railStart.y,
						x2: snapped.x,
						y2: snapped.y,
						radius: 12
					}]
				})
				setRailStart(null)
			}
		} else if (tool === 'curve') {
			setConfig({
				...config,
				curves: [...config.curves, {
					id: `curve-${Date.now()}`,
					x: snapped.x,
					y: snapped.y,
					radius: 40,
					startAngle: -Math.PI,
					endAngle: 0,
					thickness: 10
				}]
			})
		} else if (tool === 'flipper') {
			setConfig({
				...config,
				flippers: [...config.flippers, {
					id: `flipper-${Date.now()}`,
					x: snapped.x,
					y: snapped.y,
					side: e.altKey ? 'right' : 'left',
					length: 70,
					width: 15
				}]
			})
		} else if (tool === 'bezier') {
			// Keep adding points - user will click "Done" button to finish
			// For the first 4 points, add normally
			// After that, for each new segment, automatically add the first control point
			// symmetrically from the last control point
			if (bezierPoints.length === 0 || bezierPoints.length === 1 || bezierPoints.length === 2 || bezierPoints.length === 3) {
				// First segment: add points normally
				setBezierPoints([...bezierPoints, snapped])
			} else {
				// Starting a new segment
				const pointsAfterFirst = bezierPoints.length - 4
				const isStartingNewSegment = pointsAfterFirst % 3 === 0

				if (isStartingNewSegment) {
					// This click is for the new endpoint (p3 of new segment)
					// We need to auto-generate the first control point of this new segment
					// which should be symmetric to the last control point of the previous segment
					const lastEndpoint = bezierPoints[bezierPoints.length - 1]
					const lastControlPoint = bezierPoints[bezierPoints.length - 2]

					// Calculate symmetric control point
					const symmetricControl = {
						x: lastEndpoint.x + (lastEndpoint.x - lastControlPoint.x),
						y: lastEndpoint.y + (lastEndpoint.y - lastControlPoint.y)
					}

					// Add the symmetric control point, then this endpoint
					setBezierPoints([...bezierPoints, symmetricControl, snapped])
				} else {
					// This is a control point within the current segment
					setBezierPoints([...bezierPoints, snapped])
				}
			}
		}
	}

	const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
		const pos = getCanvasCoords(e)
		const snapped = e.shiftKey ? pos : snapToGrid(pos.x, pos.y)
		setHoverPos(snapped)
		setIsAltPressed(e.altKey)

		// Handle vertex dragging
		if (isDragging && dragVertex && selectedId) {
			setConfig(prevConfig => {
				if (dragVertex.type === 'triangle') {
					return {
						...prevConfig,
						triangularBumpers: prevConfig.triangularBumpers.map(t => {
							if (t.id !== selectedId) return t
							const vertices = [t.v1, t.v2, t.v3]
							vertices[dragVertex.vertex] = { x: snapped.x, y: snapped.y }
							return {
								...t,
								v1: vertices[0],
								v2: vertices[1],
								v3: vertices[2]
							}
						})
					}
				} else if (dragVertex.type === 'rail') {
					return {
						...prevConfig,
						rails: prevConfig.rails.map(r => {
							if (r.id !== selectedId) return r
							if (dragVertex.vertex === 0) {
								return { ...r, x1: snapped.x, y1: snapped.y }
							} else {
								return { ...r, x2: snapped.x, y2: snapped.y }
							}
						})
					}
				} else if (dragVertex.type === 'bezier') {
					return {
						...prevConfig,
						bezierPaths: (prevConfig.bezierPaths || []).map(b => {
							if (b.id !== selectedId) return b
							const newPoints = [...b.points]
							const movedIndex = dragVertex.vertex
							newPoints[movedIndex] = { x: snapped.x, y: snapped.y }

							// Check if this is a control point (not an endpoint)
							const isEndpoint = movedIndex === 0 || movedIndex === b.points.length - 1 || movedIndex % 3 === 0

							if (!isEndpoint) {
								// This is a control point - find its associated endpoint and opposite control point
								let endpointIndex: number
								let oppositeControlIndex: number

								// Determine which endpoint this control point belongs to
								const segmentStart = Math.floor(movedIndex / 3) * 3

								if (movedIndex === segmentStart + 1) {
									// This is the first control point of a segment (after p0)
									endpointIndex = segmentStart
									// Opposite control is the last control of the previous segment
									oppositeControlIndex = segmentStart - 1
								} else if (movedIndex === segmentStart + 2) {
									// This is the second control point of a segment (before p3)
									endpointIndex = segmentStart + 3
									// Opposite control is the first control of the next segment
									oppositeControlIndex = segmentStart + 4
								} else {
									// Shouldn't reach here
									return { ...b, points: newPoints }
								}

								// Check if opposite control point exists
								if (oppositeControlIndex >= 0 && oppositeControlIndex < b.points.length) {
									const endpoint = newPoints[endpointIndex]
									const movedControl = newPoints[movedIndex]
									const oppositeControl = newPoints[oppositeControlIndex]

									// Calculate the angle from endpoint to moved control
									const newAngle = Math.atan2(movedControl.y - endpoint.y, movedControl.x - endpoint.x)

									// Calculate the current distance of opposite control from endpoint
									const oppDx = oppositeControl.x - endpoint.x
									const oppDy = oppositeControl.y - endpoint.y
									const oppDist = Math.sqrt(oppDx * oppDx + oppDy * oppDy)

									// Set opposite control at the same angle (180 degrees opposite) with its original distance
									const oppositeAngle = newAngle + Math.PI
									newPoints[oppositeControlIndex] = {
										x: endpoint.x + Math.cos(oppositeAngle) * oppDist,
										y: endpoint.y + Math.sin(oppositeAngle) * oppDist
									}
								}
							}

							return {
								...b,
								points: newPoints
							}
						})
					}
				}
				return prevConfig
			})
			return
		}

		// Handle dragging
		if (isDragging && dragOffset && selectedId) {
			const newPos = {
				x: snapped.x + dragOffset.x,
				y: snapped.y + dragOffset.y
			}

			setConfig(prevConfig => {
				// Update bumper position
				const bumper = prevConfig.bumpers.find(b => b.id === selectedId)
				if (bumper) {
					return {
						...prevConfig,
						bumpers: prevConfig.bumpers.map(b =>
							b.id === selectedId ? { ...b, x: newPos.x, y: newPos.y } : b
						)
					}
				}

				// Update triangular bumper position
				const triangular = prevConfig.triangularBumpers.find(t => t.id === selectedId)
				if (triangular) {
					const oldCenterX = (triangular.v1.x + triangular.v2.x + triangular.v3.x) / 3
					const oldCenterY = (triangular.v1.y + triangular.v2.y + triangular.v3.y) / 3
					const dx = newPos.x - oldCenterX
					const dy = newPos.y - oldCenterY
					return {
						...prevConfig,
						triangularBumpers: prevConfig.triangularBumpers.map(t =>
							t.id === selectedId ? {
								...t,
								v1: { x: t.v1.x + dx, y: t.v1.y + dy },
								v2: { x: t.v2.x + dx, y: t.v2.y + dy },
								v3: { x: t.v3.x + dx, y: t.v3.y + dy }
							} : t
						)
					}
				}

				// Update rail position
				const rail = prevConfig.rails.find(r => r.id === selectedId)
				if (rail) {
					const oldCenterX = (rail.x1 + rail.x2) / 2
					const oldCenterY = (rail.y1 + rail.y2) / 2
					const dx = newPos.x - oldCenterX
					const dy = newPos.y - oldCenterY
					return {
						...prevConfig,
						rails: prevConfig.rails.map(r =>
							r.id === selectedId ? {
								...r,
								x1: r.x1 + dx,
								y1: r.y1 + dy,
								x2: r.x2 + dx,
								y2: r.y2 + dy
							} : r
						)
					}
				}

				// Update curve position
				const curve = prevConfig.curves.find(c => c.id === selectedId)
				if (curve) {
					return {
						...prevConfig,
						curves: prevConfig.curves.map(c =>
							c.id === selectedId ? { ...c, x: newPos.x, y: newPos.y } : c
						)
					}
				}

				// Update flipper position
				const flipper = prevConfig.flippers.find(f => f.id === selectedId)
				if (flipper) {
					return {
						...prevConfig,
						flippers: prevConfig.flippers.map(f =>
							f.id === selectedId ? { ...f, x: newPos.x, y: newPos.y } : f
						)
					}
				}

				// Update bezier path position
				const bezier = (prevConfig.bezierPaths || []).find(b => b.id === selectedId)
				if (bezier) {
					const oldCenterX = bezier.points.reduce((sum, p) => sum + p.x, 0) / bezier.points.length
					const oldCenterY = bezier.points.reduce((sum, p) => sum + p.y, 0) / bezier.points.length
					const dx = newPos.x - oldCenterX
					const dy = newPos.y - oldCenterY
					return {
						...prevConfig,
						bezierPaths: (prevConfig.bezierPaths || []).map(b =>
							b.id === selectedId ? {
								...b,
								points: b.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
							} : b
						)
					}
				}

				return prevConfig
			})
		}
	}

	const handleMouseUp = () => {
		setIsDragging(false)
		setDragOffset(null)
		setDragVertex(null)
	}

	// Helper to save incomplete bezier path when switching tools
	const saveIncompleteBezier = () => {
		if (tool === 'bezier' && bezierPoints.length > 0) {
			// Calculate valid point count: must be 4, 7, 10, 13, etc. (4 + 3n)
			// If we have 5 points, trim to 4. If we have 8 points, trim to 7, etc.
			let validPointCount = 0
			if (bezierPoints.length >= 4) {
				if (bezierPoints.length === 4) {
					validPointCount = 4
				} else {
					// For multi-segment: 4 + 3n where n = number of additional segments
					const extraPoints = bezierPoints.length - 4
					const completeExtraSegments = Math.floor(extraPoints / 3)
					validPointCount = 4 + (completeExtraSegments * 3)
				}
			}

			// Only save if we have at least 4 valid points
			if (validPointCount >= 4) {
				const trimmedPoints = bezierPoints.slice(0, validPointCount)
				const defaultTrackWidth = 14
				setConfig({
					...config,
					bezierPaths: [...(config.bezierPaths || []), {
						id: `bezier-${Date.now()}`,
						points: trimmedPoints,
						trackWidth: defaultTrackWidth
					}]
				})
			}
			// If validPointCount < 4, we just discard the incomplete path
			setBezierPoints([])
		}
	}

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === 'Delete' && selectedId) {
			setConfig({
				bumpers: config.bumpers.filter(b => b.id !== selectedId),
				triangularBumpers: config.triangularBumpers.filter(t => t.id !== selectedId),
				rails: config.rails.filter(r => r.id !== selectedId),
				curves: config.curves.filter(c => c.id !== selectedId),
				flippers: config.flippers.filter(f => f.id !== selectedId),
				bezierPaths: (config.bezierPaths || []).filter(b => b.id !== selectedId)
			})
			setSelectedId(null)
		} else if (e.key === 'Escape') {
			saveIncompleteBezier()
			setRailStart(null)
			setTriangleVertices([])
			setSelectedId(null)
			setTool('select')
		} else if (e.key === 'v' || e.key === 'V') {
			saveIncompleteBezier()
			setTool('select')
		} else if (e.key === 'b' || e.key === 'B') {
			saveIncompleteBezier()
			setTool('bumper')
		} else if (e.key === 't' || e.key === 'T') {
			saveIncompleteBezier()
			setTool('triangular')
		} else if (e.key === 'r' || e.key === 'R') {
			saveIncompleteBezier()
			setTool('rail')
		} else if (e.key === 'c' || e.key === 'C') {
			saveIncompleteBezier()
			setTool('curve')
		} else if (e.key === 'f' || e.key === 'F') {
			saveIncompleteBezier()
			setTool('flipper')
		} else if (e.key === 'z' || e.key === 'Z') {
			saveIncompleteBezier()
			setTool('bezier')
		} else if (e.key === 'd' || e.key === 'D') {
			saveIncompleteBezier()
			setTool('delete')
		} else if (e.key === 'Enter' && tool === 'bezier' && bezierPoints.length >= 4) {
			// Complete bezier path with Enter key
			const defaultTrackWidth = 14
			setConfig({
				...config,
				bezierPaths: [...(config.bezierPaths || []), {
					id: `bezier-${Date.now()}`,
					points: bezierPoints,
					trackWidth: defaultTrackWidth
				}]
			})
			setBezierPoints([])
			setTool('select')
		}
	}

	useEffect(() => {
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [selectedId, config, tool, bezierPoints])

	return (
		<div className={styles.editor}>
			<div ref={toolbarRef} className={styles.toolbar}>
				{tool === 'bezier' && bezierPoints.length >= 4 && (
					<button
						className={styles.doneButton}
						onClick={() => {
							const defaultTrackWidth = 14 // Slightly less than ball diameter (16)
							setConfig({
								...config,
								bezierPaths: [...(config.bezierPaths || []), {
									id: `bezier-${Date.now()}`,
									points: bezierPoints,
									trackWidth: defaultTrackWidth
								}]
							})
							setBezierPoints([])
							setTool('select')
						}}
						title="Complete bezier path"
					>
						✓ Done ({bezierPoints.length} points, {Math.floor((bezierPoints.length - 1) / 3)} segment{Math.floor((bezierPoints.length - 1) / 3) !== 1 ? 's' : ''})
					</button>
				)}
				<button
					className={tool === 'select' ? styles.active : ''}
					onClick={() => { saveIncompleteBezier(); setTool('select') }}
					title="Select (V)"
				>
					Select
				</button>
				<button
					className={tool === 'bumper' ? styles.active : ''}
					onClick={() => { saveIncompleteBezier(); setTool('bumper') }}
					title="Bumper (B)"
				>
					Bumper
				</button>
				<button
					className={tool === 'triangular' ? styles.active : ''}
					onClick={() => { saveIncompleteBezier(); setTool('triangular') }}
					title="Triangle (T)"
				>
					Triangle
				</button>
				<button
					className={tool === 'rail' ? styles.active : ''}
					onClick={() => { saveIncompleteBezier(); setTool('rail') }}
					title="Rail (R)"
				>
					Rail
				</button>
				<button
					className={tool === 'curve' ? styles.active : ''}
					onClick={() => { saveIncompleteBezier(); setTool('curve') }}
					title="Curve (C)"
				>
					Curve
				</button>
				<button
					className={tool === 'flipper' ? styles.active : ''}
					onClick={() => { saveIncompleteBezier(); setTool('flipper') }}
					title="Flipper (F) | Alt+Click for right"
				>
					Flipper
				</button>
				<button
					className={tool === 'bezier' ? styles.active : ''}
					onClick={() => { saveIncompleteBezier(); setTool('bezier') }}
					title="Bezier Path (Z) | Click to add points (4 minimum), then click Done"
				>
					Bezier {bezierPoints.length > 0 && `(${bezierPoints.length})`}
				</button>
				<button
					className={tool === 'delete' ? styles.active : ''}
					onClick={() => { saveIncompleteBezier(); setTool('delete') }}
					title="Delete (D)"
				>
					Delete
				</button>
				<div className={styles.spacer} />
				<button onClick={() => onSave(config)}>
					💾 Save & Play
				</button>
				<button onClick={() => {
					const json = JSON.stringify(config, null, 2)
					navigator.clipboard.writeText(json)
					alert('Board config copied to clipboard!')
				}}>
					📋 Export
				</button>
				<button onClick={() => {
					const json = prompt('Paste board config JSON:')
					if (json) {
						try {
							const parsed = JSON.parse(json)
							setConfig(parsed)
						} catch (e) {
							alert('Invalid JSON')
						}
					}
				}}>
					📥 Import
				</button>
				<button onClick={() => {
					if (confirm('Clear all objects?')) {
						setConfig({
							bumpers: [],
							triangularBumpers: [],
							rails: [],
							curves: [],
							flippers: [],
							bezierPaths: []
						})
						setSelectedId(null)
					}
				}}>
					🗑️ Clear
				</button>
				<button onClick={() => {
					const defaultBoard: BoardConfig = {
						bumpers: [
							{ id: 'b1', x: 100, y: 180, radius: 20, points: 100 },
							{ id: 'b2', x: 300, y: 180, radius: 20, points: 100 },
							{ id: 'b3', x: 200, y: 120, radius: 18, points: 200 },
							{ id: 'b4', x: 140, y: 280, radius: 25, points: 150 },
							{ id: 'b5', x: 260, y: 280, radius: 25, points: 150 },
							{ id: 'b6', x: 200, y: 360, radius: 22, points: 175 }
						],
						triangularBumpers: [
							{
								id: 't1',
								v1: { x: 90, y: height - 150 - 15.6 },
								v2: { x: 75, y: height - 150 + 10.4 },
								v3: { x: 105, y: height - 150 + 10.4 },
								points: 250,
								edge1Bouncy: true,
								edge2Bouncy: true,
								edge3Bouncy: true
							},
							{
								id: 't2',
								v1: { x: 310, y: height - 150 - 15.6 },
								v2: { x: 295, y: height - 150 + 10.4 },
								v3: { x: 325, y: height - 150 + 10.4 },
								points: 250,
								edge1Bouncy: true,
								edge2Bouncy: true,
								edge3Bouncy: true
							}
						],
						rails: [
							{ id: 'r1', x1: 50, y1: 150, x2: 150, y2: 200, radius: 12 },
							{ id: 'r2', x1: 250, y1: 200, x2: 350, y2: 150, radius: 12 }
						],
						curves: [
							{ id: 'c1', x: 200, y: 100, radius: 60, startAngle: -Math.PI, endAngle: 0, thickness: 15 },
							{ id: 'c2', x: 100, y: 420, radius: 40, startAngle: Math.PI / 4, endAngle: 3 * Math.PI / 4, thickness: 10 },
							{ id: 'c3', x: 300, y: 420, radius: 40, startAngle: Math.PI / 4, endAngle: 3 * Math.PI / 4, thickness: 10 },
							{ id: 'c4', x: width - 40, y: 40, radius: 40, startAngle: -Math.PI / 2, endAngle: 0, thickness: 10 },
							{ id: 'c5', x: 75, y: height - 140, radius: 40, startAngle: -Math.PI / 2, endAngle: Math.PI / 8, thickness: 8 },
							{ id: 'c6', x: 325, y: height - 140, radius: 40, startAngle: Math.PI - Math.PI / 8, endAngle: Math.PI / 2, thickness: 8 }
						],
						flippers: [
							{ id: 'f1', x: 120, y: height - 80, side: 'left', length: 70, width: 15 },
							{ id: 'f2', x: 280, y: height - 80, side: 'right', length: 70, width: 15 }
						],
						bezierPaths: []
					}
					setConfig(defaultBoard)
				}}>
					📦 Load Default
				</button>
			</div>
			<div ref={instructionsRef} className={styles.instructions}>
				<strong>Controls:</strong> Click to place | Shift+Click for precise placement |
				Alt+Click for right flipper | Triangle needs 3 clicks | Bezier needs 4 clicks | Delete key to remove selected | Esc to cancel/deselect
			</div>
			<canvas
				ref={canvasRef}
				width={canvasDimensions.width * devicePixelRatio}
				height={canvasDimensions.height * devicePixelRatio}
				style={{ width: `${canvasDimensions.width}px`, height: `${canvasDimensions.height}px`, cursor: isDragging ? 'grabbing' : (tool === 'select' && selectedId ? 'grab' : 'crosshair') }}
				onClick={handleCanvasClick}
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onMouseLeave={() => {
					setHoverPos(null)
					handleMouseUp()
				}}
			/>
			{selectedId && (
				<div className={styles.properties}>
					<h3>Properties</h3>
					<PropertyPanel
						id={selectedId}
						config={config}
						onChange={setConfig}
						onDelete={() => {
							setConfig({
								bumpers: config.bumpers.filter(b => b.id !== selectedId),
								triangularBumpers: config.triangularBumpers.filter(t => t.id !== selectedId),
								rails: config.rails.filter(r => r.id !== selectedId),
								curves: config.curves.filter(c => c.id !== selectedId),
								flippers: config.flippers.filter(f => f.id !== selectedId),
								bezierPaths: (config.bezierPaths || []).filter(b => b.id !== selectedId)
							})
							setSelectedId(null)
						}}
					/>
				</div>
			)}
		</div>
	)
}

function PropertyPanel({ id, config, onChange, onDelete }: {
	id: string
	config: BoardConfig
	onChange: (config: BoardConfig) => void
	onDelete: () => void
}) {
	const bumper = config.bumpers.find(b => b.id === id)
	const triangular = config.triangularBumpers.find(t => t.id === id)
	const rail = config.rails.find(r => r.id === id)
	const curve = config.curves.find(c => c.id === id)
	const flipper = config.flippers.find(f => f.id === id)
	const bezier = config.bezierPaths?.find(b => b.id === id)

	if (bumper) {
		return (
			<div>
				<label>
					Radius:
					<input
						type="number"
						value={bumper.radius}
						onChange={(e) => {
							onChange({
								...config,
								bumpers: config.bumpers.map(b =>
									b.id === id ? { ...b, radius: Number(e.target.value) } : b
								)
							})
						}}
					/>
				</label>
				<label>
					Points:
					<input
						type="number"
						value={bumper.points}
						onChange={(e) => {
							onChange({
								...config,
								bumpers: config.bumpers.map(b =>
									b.id === id ? { ...b, points: Number(e.target.value) } : b
								)
							})
						}}
					/>
				</label>
			</div>
		)
	}

	if (triangular) {
		const updateVertex = (vertex: 'v1' | 'v2' | 'v3', coord: 'x' | 'y', value: number) => {
			onChange({
				...config,
				triangularBumpers: config.triangularBumpers.map(t =>
					t.id === id ? { ...t, [vertex]: { ...t[vertex], [coord]: value } } : t
				)
			})
		}

		return (
			<div>
				<label>
					Vertex 1 X:
					<input type="number" value={Math.round(triangular.v1.x)}
						onChange={(e) => updateVertex('v1', 'x', Number(e.target.value))} />
				</label>
				<label>
					Vertex 1 Y:
					<input type="number" value={Math.round(triangular.v1.y)}
						onChange={(e) => updateVertex('v1', 'y', Number(e.target.value))} />
				</label>
				<label>
					Vertex 2 X:
					<input type="number" value={Math.round(triangular.v2.x)}
						onChange={(e) => updateVertex('v2', 'x', Number(e.target.value))} />
				</label>
				<label>
					Vertex 2 Y:
					<input type="number" value={Math.round(triangular.v2.y)}
						onChange={(e) => updateVertex('v2', 'y', Number(e.target.value))} />
				</label>
				<label>
					Vertex 3 X:
					<input type="number" value={Math.round(triangular.v3.x)}
						onChange={(e) => updateVertex('v3', 'x', Number(e.target.value))} />
				</label>
				<label>
					Vertex 3 Y:
					<input type="number" value={Math.round(triangular.v3.y)}
						onChange={(e) => updateVertex('v3', 'y', Number(e.target.value))} />
				</label>
				<div style={{ marginTop: '1em', paddingTop: '1em', borderTop: '1px solid #48dbfb' }}>
					<strong style={{ color: '#48dbfb', display: 'block', marginBottom: '0.5em' }}>Edge Properties</strong>
					<label style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
						<input
							type="checkbox"
							checked={triangular.edge1Bouncy}
							onChange={(e) => {
								onChange({
									...config,
									triangularBumpers: config.triangularBumpers.map(t =>
										t.id === id ? { ...t, edge1Bouncy: e.target.checked } : t
									)
								})
							}}
						/>
						<span>Edge 1→2 Bouncy</span>
					</label>
					<label style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
						<input
							type="checkbox"
							checked={triangular.edge2Bouncy}
							onChange={(e) => {
								onChange({
									...config,
									triangularBumpers: config.triangularBumpers.map(t =>
										t.id === id ? { ...t, edge2Bouncy: e.target.checked } : t
									)
								})
							}}
						/>
						<span>Edge 2→3 Bouncy</span>
					</label>
					<label style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
						<input
							type="checkbox"
							checked={triangular.edge3Bouncy}
							onChange={(e) => {
								onChange({
									...config,
									triangularBumpers: config.triangularBumpers.map(t =>
										t.id === id ? { ...t, edge3Bouncy: e.target.checked } : t
									)
								})
							}}
						/>
						<span>Edge 3→1 Bouncy</span>
					</label>
				</div>
				<label>
					Points:
					<input
						type="number"
						value={triangular.points}
						onChange={(e) => {
							onChange({
								...config,
								triangularBumpers: config.triangularBumpers.map(t =>
									t.id === id ? { ...t, points: Number(e.target.value) } : t
								)
							})
						}}
					/>
				</label>
				<button
					onClick={onDelete}
					style={{
						marginTop: '1em',
						padding: '0.5em 1em',
						background: '#ff4757',
						color: 'white',
						border: 'none',
						borderRadius: '4px',
						cursor: 'pointer',
						width: '100%'
					}}
				>
					🗑️ Delete
				</button>
			</div>
		)
	}

	if (rail) {
		return (
			<div>
				<label>
					Thickness:
					<input
						type="number"
						value={rail.radius}
						onChange={(e) => {
							onChange({
								...config,
								rails: config.rails.map(r =>
									r.id === id ? { ...r, radius: Number(e.target.value) } : r
								)
							})
						}}
					/>
				</label>
				<button
					onClick={onDelete}
					style={{
						marginTop: '1em',
						padding: '0.5em 1em',
						background: '#ff4757',
						color: 'white',
						border: 'none',
						borderRadius: '4px',
						cursor: 'pointer',
						width: '100%'
					}}
				>
					🗑️ Delete
				</button>
			</div>
		)
	}

	if (curve) {
		return (
			<div>
				<label>
					Radius:
					<input
						type="number"
						value={curve.radius}
						onChange={(e) => {
							onChange({
								...config,
								curves: config.curves.map(c =>
									c.id === id ? { ...c, radius: Number(e.target.value) } : c
								)
							})
						}}
					/>
				</label>
				<label>
					Thickness:
					<input
						type="number"
						value={curve.thickness}
						onChange={(e) => {
							onChange({
								...config,
								curves: config.curves.map(c =>
									c.id === id ? { ...c, thickness: Number(e.target.value) } : c
								)
							})
						}}
					/>
				</label>
				<label>
					Start Angle (deg):
					<input
						type="number"
						value={Math.round(curve.startAngle * 180 / Math.PI)}
						onChange={(e) => {
							onChange({
								...config,
								curves: config.curves.map(c =>
									c.id === id ? { ...c, startAngle: Number(e.target.value) * Math.PI / 180 } : c
								)
							})
						}}
					/>
				</label>
				<label>
					End Angle (deg):
					<input
						type="number"
						value={Math.round(curve.endAngle * 180 / Math.PI)}
						onChange={(e) => {
							onChange({
								...config,
								curves: config.curves.map(c =>
									c.id === id ? { ...c, endAngle: Number(e.target.value) * Math.PI / 180 } : c
								)
							})
						}}
					/>
				</label>
				<button
					onClick={onDelete}
					style={{
						marginTop: '1em',
						padding: '0.5em 1em',
						background: '#ff4757',
						color: 'white',
						border: 'none',
						borderRadius: '4px',
						cursor: 'pointer',
						width: '100%'
					}}
				>
					🗑️ Delete
				</button>
			</div>
		)
	}

	if (flipper) {
		return (
			<div>
				<label>
					Side:
					<select
						value={flipper.side}
						onChange={(e) => {
							onChange({
								...config,
								flippers: config.flippers.map(f =>
									f.id === id ? { ...f, side: e.target.value as 'left' | 'right' } : f
								)
							})
						}}
					>
						<option value="left">Left</option>
						<option value="right">Right</option>
					</select>
				</label>
				<label>
					Length:
					<input
						type="number"
						value={flipper.length}
						onChange={(e) => {
							onChange({
								...config,
								flippers: config.flippers.map(f =>
									f.id === id ? { ...f, length: Number(e.target.value) } : f
								)
							})
						}}
					/>
				</label>
				<label>
					Width:
					<input
						type="number"
						value={flipper.width}
						onChange={(e) => {
							onChange({
								...config,
								flippers: config.flippers.map(f =>
									f.id === id ? { ...f, width: Number(e.target.value) } : f
								)
							})
						}}
					/>
				</label>
				<button
					onClick={onDelete}
					style={{
						marginTop: '1em',
						padding: '0.5em 1em',
						background: '#ff4757',
						color: 'white',
						border: 'none',
						borderRadius: '4px',
						cursor: 'pointer',
						width: '100%'
					}}
				>
					🗑️ Delete
				</button>
			</div>
		)
	}

	if (bezier) {
		return (
			<div>
				<div style={{ marginBottom: '1em' }}>
					<strong>{bezier.points.length} points ({Math.floor((bezier.points.length - 1) / 3)} segment{Math.floor((bezier.points.length - 1) / 3) !== 1 ? 's' : ''})</strong>
				</div>
				<label>
					Track Width:
					<input
						type="number"
						value={bezier.trackWidth}
						onChange={(e) => {
							onChange({
								...config,
								bezierPaths: (config.bezierPaths || []).map(b =>
									b.id === id ? { ...b, trackWidth: Number(e.target.value) } : b
								)
							})
						}}
					/>
				</label>
				<button
					onClick={onDelete}
					style={{
						marginTop: '1em',
						padding: '0.5em 1em',
						background: '#ff4757',
						color: 'white',
						border: 'none',
						borderRadius: '4px',
						cursor: 'pointer',
						width: '100%'
					}}
				>
					🗑️ Delete
				</button>
			</div>
		)
	}

	return null
}

function distanceToSegment(
	point: { x: number; y: number },
	lineStart: { x: number; y: number },
	lineEnd: { x: number; y: number }
): number {
	const dx = lineEnd.x - lineStart.x
	const dy = lineEnd.y - lineStart.y
	const lenSq = dx * dx + dy * dy

	if (lenSq === 0) {
		return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2)
	}

	let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq
	t = Math.max(0, Math.min(1, t))

	const closestX = lineStart.x + t * dx
	const closestY = lineStart.y + t * dy

	return Math.sqrt((point.x - closestX) ** 2 + (point.y - closestY) ** 2)
}
