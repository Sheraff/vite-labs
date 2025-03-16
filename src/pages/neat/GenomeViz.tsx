import { INNATE_NODES, INPUT_NODES, MAX, OUTPUT_NODES, type Type } from "./constants"
import { useEffect, useRef } from "react"

export function GenomeViz({ genome, className }: { genome: Type, className?: string }) {
	const ref = useRef<HTMLCanvasElement>(null)
	useEffect(() => {
		const canvas = ref.current
		if (!canvas) return
		const { width, height } = canvas.getBoundingClientRect()
		canvas.width = width * devicePixelRatio
		canvas.height = height * devicePixelRatio
		const ctx = canvas.getContext('2d')
		if (!ctx) throw new Error('Failed to get canvas context')

		type Connection = {
			from: number
			to: number
			weight: number
			normalized: number
		}

		type Node = {
			index: number
			aggregation: number,
			activation: number
			incoming: Set<Connection>
			outgoing: Set<Connection>
			isInput: boolean
			isOutput: boolean
			depth: number
			name: string
			deadend: boolean
		}

		const connections = new Set<Connection>()
		const nodes = new Map<number, Node>()

		for (let i = 0; i < INNATE_NODES; i++) {
			const isInput = i < INPUT_NODES.length
			const isOutput = i >= INPUT_NODES.length && i < INNATE_NODES
			const depth = isInput ? 0 : isOutput ? Infinity : NaN
			const name = isInput ? INPUT_NODES[i] : isOutput ? OUTPUT_NODES[i - INPUT_NODES.length] : ''
			nodes.set(i, {
				index: i,
				aggregation: 0,
				activation: 0,
				incoming: new Set(),
				outgoing: new Set(),
				isInput,
				isOutput,
				depth,
				name,
				deadend: false,
			})
		}

		for (let i = 0; i < genome.length; i++) {
			const type = genome[i]
			if (type === 0) { // node gene
				const index = genome[i + 1]
				const aggregation = genome[i + 2]
				const activation = genome[i + 3]
				nodes.set(index, {
					index,
					aggregation,
					activation,
					incoming: new Set(),
					outgoing: new Set(),
					isInput: false,
					isOutput: false,
					depth: NaN,
					name: '',
					deadend: false,
				})
				i += 3 // skip index, aggregation, activation
			} else if (type === 1) { // connection gene
				i += 3 // skip from, to, weight
			} else {
				throw new Error(`Unknown gene type allele: ${type}`)
			}
		}
		for (let i = 0; i < genome.length; i++) {
			const type = genome[i]
			if (type === 1) { // connection gene
				const from = genome[i + 1]
				const to = genome[i + 2]
				const weight = genome[i + 3]
				const fromNode = nodes.get(from)
				const toNode = nodes.get(to)
				if (fromNode && toNode) {
					const connection = {
						from,
						to,
						weight,
						normalized: weight / MAX,
					}
					fromNode.outgoing.add(connection)
					toNode.incoming.add(connection)
					connections.add(connection)
				}
				i += 3 // skip from, to, weight
			} else if (type === 0) { // node gene
				i += 3 // skip index, aggregation, activation
			} else {
				throw new Error(`Unknown gene type allele: ${type}`)
			}
		}

		function resolveDeadEnds() {
			for (const node of nodes.values()) {
				if (node.isOutput) {
					node.deadend = node.incoming.size === 0
					continue
				}
				if (node.isInput) {
					node.deadend = node.outgoing.size === 0
					continue
				}
				if (node.outgoing.size === 0 && node.incoming.size === 0) {
					node.deadend = true
				}
			}
			let changed = true
			while (changed) {
				changed = false
				for (const node of nodes.values()) {
					if (node.deadend) continue
					const noOutgoingUtility = !node.isOutput && Array.from(node.outgoing).every(conn => {
						const to = nodes.get(conn.to)
						return to?.deadend || to === node
					})
					if (noOutgoingUtility) {
						node.deadend = true
						changed = true
						continue
					}
					const noIncomingUtility = !node.isInput && Array.from(node.incoming).every(conn => {
						const from = nodes.get(conn.from)
						return from?.deadend || from === node
					})
					if (noIncomingUtility) {
						node.deadend = true
						changed = true
						continue
					}
				}
			}
		}
		resolveDeadEnds()

		function assignLayers() {
			const visited = new Set<Node>()
			function dfs(node: Node, depth: number, stack: Set<Node> = new Set()): number {
				if (node.isInput) return 0
				if (stack.has(node)) return depth
				if (visited.has(node)) return node.depth
				stack.add(node)
				let maxDepth = depth
				for (const conn of node.incoming) {
					const nextNode = nodes.get(conn.from)
					if (!nextNode) continue
					const nextDepth = dfs(nextNode, depth + 1, stack)
					if (nextDepth > maxDepth) {
						maxDepth = nextDepth
					}
				}
				visited.add(node)
				node.depth = maxDepth
				return maxDepth
			}
			for (let i = INPUT_NODES.length; i < INNATE_NODES; i++) {
				const node = nodes.get(i)
				if (!node) continue
				dfs(node, 0)
			}
			for (const node of nodes.values()) {
				if (!visited.has(node)) {
					dfs(node, 1)
				}
			}
			const maxDepth = Math.max(...Array.from(nodes.values()).map(node => node.depth).filter(d => !isNaN(d)).filter(d => d !== Infinity)) + 1
			for (let i = INPUT_NODES.length; i < INNATE_NODES; i++) {
				const node = nodes.get(i)
				if (!node) continue
				node.depth = maxDepth
			}

			let compacted = false
			while (!compacted) {
				compacted = true
				const layers = new Set(Array.from(nodes.values()).map(node => node.depth))
				layers.delete(NaN)
				for (let i = 0; i < layers.size; i++) {
					if (layers.has(i)) continue
					compacted = false
					for (const node of nodes.values()) {
						if (node.depth >= i) {
							node.depth -= 1
						}
					}
				}
			}
		}
		assignLayers()

		const perLayer = new Map<number, Node[]>()
		for (const node of nodes.values()) {
			const layer = node.depth
			if (!perLayer.has(layer)) {
				perLayer.set(layer, [])
			}
			perLayer.get(layer)!.push(node)
		}
		perLayer.delete(NaN)

		ctx.font = `${16 * devicePixelRatio}px sans-serif`
		const leftOffset = Math.max(...INPUT_NODES.map(t => ctx.measureText(t).width)) + 20
		const rightOffset = Math.max(...OUTPUT_NODES.map(t => ctx.measureText(t).width)) + 20
		const topOffset = 20
		const bottomOffset = 20
		const layerCount = perLayer.size
		const layerWidth = (ctx.canvas.width - leftOffset - rightOffset) / (layerCount)
		const maxLayerSize = Math.max(...Array.from(perLayer.values()).map(layer => layer.length))
		const layerHeight = (ctx.canvas.height - topOffset - bottomOffset) / (maxLayerSize - 1)
		const nodeSize = 10

		const getX = (node: Node) => node.depth * layerWidth + leftOffset
		const getY = (node: Node) => {
			const layer = perLayer.get(node.depth)
			if (!layer) return 0
			const index = layer.indexOf(node)
			if (index === -1) return 0
			const y = index * layerHeight + topOffset
			return y
		}
		const getNodeColor = (node: Node) => {
			const hue = node.isInput ? 240 : node.isOutput ? 0 : 120
			const saturation = node.deadend ? 50 : 100
			const lightness = node.deadend ? 25 : 50
			return `hsl(${hue}, ${saturation}%, ${lightness}%)`
		}

		for (const node of nodes.values()) {
			ctx.fillStyle = getNodeColor(node)
			ctx.beginPath()
			const x = getX(node)
			const y = getY(node)
			ctx.arc(x, y, nodeSize, 0, Math.PI * 2)
			ctx.fill()

			if (node.isInput) {
				ctx.fillStyle = 'white'
				ctx.textBaseline = 'middle'
				ctx.fillText(node.name, 0, y)
			} else if (node.isOutput) {
				ctx.fillStyle = 'white'
				ctx.textBaseline = 'middle'
				ctx.fillText(node.name, x + nodeSize + 20, y)
			}
		}

		for (const conn of connections) {
			const fromNode = nodes.get(conn.from)
			const toNode = nodes.get(conn.to)
			if (!fromNode || !toNode) continue
			const isDeadEnd = fromNode.deadend || toNode.deadend
			ctx.strokeStyle = isDeadEnd ? 'hsl(0, 0%, 50%)' : 'white'
			ctx.lineWidth = 0.5 + conn.normalized * 3
			if (fromNode === toNode) {
				ctx.setLineDash([5, 5])
				ctx.beginPath()
				ctx.arc(getX(fromNode), getY(fromNode) - nodeSize, nodeSize, 0, Math.PI * 2)
				ctx.stroke()
				continue
			}
			const isBackward = fromNode.depth >= toNode.depth
			const fromX = getX(fromNode)
			const fromY = getY(fromNode)
			const toX = getX(toNode)
			const toY = getY(toNode)
			if (isBackward) {
				ctx.setLineDash([5, 5])
			} else {
				ctx.setLineDash([])
			}
			ctx.beginPath()
			ctx.moveTo(fromX + nodeSize, fromY)
			const dx = layerWidth
			ctx.bezierCurveTo(
				fromX + nodeSize + dx / 3,
				fromY,
				toX - nodeSize - dx / 3,
				toY,
				toX - nodeSize,
				toY,
			)
			ctx.stroke()
		}

	}, [genome])
	return (
		<canvas ref={ref} className={className} />
	)
}