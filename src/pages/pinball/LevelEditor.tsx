import { useEffect, useRef, useState } from 'react'
import styles from './styles.module.css'
import type { BoardConfig } from './types'

type Tool = 'bumper' | 'triangular' | 'rail' | 'curve' | 'flipper' | 'select' | 'delete'

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
		flippers: []
	})
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [railStart, setRailStart] = useState<{ x: number; y: number } | null>(null)
	const [triangleVertices, setTriangleVertices] = useState<Array<{ x: number; y: number }>>([])
	const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
	const [isAltPressed, setIsAltPressed] = useState(false)

	// Draw the editor view
	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		const ctx = canvas.getContext('2d')!
		ctx.save()
		ctx.setTransform(1, 0, 0, 1, 0, 0) // Reset transform
		ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

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
			ctx.beginPath()
			ctx.moveTo(t.v1.x, t.v1.y)
			ctx.lineTo(t.v2.x, t.v2.y)
			ctx.lineTo(t.v3.x, t.v3.y)
			ctx.closePath()
			ctx.fillStyle = selectedId === t.id ? '#ffd93d' : '#f6b93b'
			ctx.fill()
			ctx.strokeStyle = '#e55039'
			ctx.lineWidth = 3
			ctx.stroke()

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
			}
			ctx.globalAlpha = 1
		}

		ctx.restore()
	}, [config, selectedId, tool, hoverPos, railStart, triangleVertices, width, height])

	const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
		const canvas = canvasRef.current!
		const rect = canvas.getBoundingClientRect()
		const x = ((e.clientX - rect.left) / rect.width) * width
		const y = ((e.clientY - rect.top) / rect.height) * height
		return { x, y }
	}

	const snapToGrid = (x: number, y: number, gridSize = 20) => {
		return {
			x: Math.round(x / gridSize) * gridSize,
			y: Math.round(y / gridSize) * gridSize
		}
	}

	const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
						points: 250
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
		}
	}

	const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
		const pos = getCanvasCoords(e)
		const snapped = e.shiftKey ? pos : snapToGrid(pos.x, pos.y)
		setHoverPos(snapped)
		setIsAltPressed(e.altKey)
	}

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === 'Delete' && selectedId) {
			setConfig({
				bumpers: config.bumpers.filter(b => b.id !== selectedId),
				triangularBumpers: config.triangularBumpers.filter(t => t.id !== selectedId),
				rails: config.rails.filter(r => r.id !== selectedId),
				curves: config.curves.filter(c => c.id !== selectedId),
				flippers: config.flippers.filter(f => f.id !== selectedId)
			})
			setSelectedId(null)
		} else if (e.key === 'Escape') {
			setRailStart(null)
			setTriangleVertices([])
			setSelectedId(null)
		} else if (e.key === 'v' || e.key === 'V') {
			setTool('select')
		} else if (e.key === 'b' || e.key === 'B') {
			setTool('bumper')
		} else if (e.key === 't' || e.key === 'T') {
			setTool('triangular')
		} else if (e.key === 'r' || e.key === 'R') {
			setTool('rail')
		} else if (e.key === 'c' || e.key === 'C') {
			setTool('curve')
		} else if (e.key === 'f' || e.key === 'F') {
			setTool('flipper')
		} else if (e.key === 'd' || e.key === 'D') {
			setTool('delete')
		}
	}

	useEffect(() => {
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [selectedId, config])

	return (
		<div className={styles.editor}>
			<div className={styles.toolbar}>
				<button
					className={tool === 'select' ? styles.active : ''}
					onClick={() => setTool('select')}
					title="Select (V)"
				>
					Select
				</button>
				<button
					className={tool === 'bumper' ? styles.active : ''}
					onClick={() => setTool('bumper')}
					title="Bumper (B)"
				>
					Bumper
				</button>
				<button
					className={tool === 'triangular' ? styles.active : ''}
					onClick={() => setTool('triangular')}
					title="Triangle (T)"
				>
					Triangle
				</button>
				<button
					className={tool === 'rail' ? styles.active : ''}
					onClick={() => setTool('rail')}
					title="Rail (R)"
				>
					Rail
				</button>
				<button
					className={tool === 'curve' ? styles.active : ''}
					onClick={() => setTool('curve')}
					title="Curve (C)"
				>
					Curve
				</button>
				<button
					className={tool === 'flipper' ? styles.active : ''}
					onClick={() => setTool('flipper')}
					title="Flipper (F) | Alt+Click for right"
				>
					Flipper
				</button>
				<button
					className={tool === 'delete' ? styles.active : ''}
					onClick={() => setTool('delete')}
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
							flippers: []
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
								points: 250
							},
							{
								id: 't2',
								v1: { x: 310, y: height - 150 - 15.6 },
								v2: { x: 295, y: height - 150 + 10.4 },
								v3: { x: 325, y: height - 150 + 10.4 },
								points: 250
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
						]
					}
					setConfig(defaultBoard)
				}}>
					📦 Load Default
				</button>
			</div>
			<div className={styles.instructions}>
				<strong>Controls:</strong> Click to place | Shift+Click for precise placement |
				Alt+Click for right flipper | Triangle needs 3 clicks | Delete key to remove selected | Esc to cancel/deselect
			</div>
			<canvas
				ref={canvasRef}
				width={width * devicePixelRatio}
				height={height * devicePixelRatio}
				style={{ width: `${width}px`, height: `${height}px` }}
				onClick={handleCanvasClick}
				onMouseMove={handleMouseMove}
				onMouseLeave={() => setHoverPos(null)}
			/>
			{selectedId && (
				<div className={styles.properties}>
					<h3>Properties</h3>
					<PropertyPanel
						id={selectedId}
						config={config}
						onChange={setConfig}
					/>
				</div>
			)}
		</div>
	)
}

function PropertyPanel({ id, config, onChange }: {
	id: string
	config: BoardConfig
	onChange: (config: BoardConfig) => void
}) {
	const bumper = config.bumpers.find(b => b.id === id)
	const triangular = config.triangularBumpers.find(t => t.id === id)
	const rail = config.rails.find(r => r.id === id)
	const curve = config.curves.find(c => c.id === id)
	const flipper = config.flippers.find(f => f.id === id)

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
