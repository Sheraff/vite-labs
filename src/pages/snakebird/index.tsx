import styles from './styles.module.css'
import { Head } from "#components/Head"
import type { RouteMeta } from "#router"
import { useEffect, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { LEVELS } from "./levels"

export const meta: RouteMeta = {
	title: 'Snakebird',
	image: './screen.png',
	tags: ['game']
}

export default function Snakebird() {
	const [levelNum, setLevelNum] = useState(0)

	return (
		<div className={styles.main}>
			<Head />

			<div className={styles.content}>
				<PlayLevel
					key={levelNum}
					levelNum={levelNum}
					onSuccess={() => setLevelNum((n) => (n + 1) % LEVELS.length)}
				/>
			</div>
		</div>
	)
}

function PlayLevel({ levelNum, onSuccess }: { levelNum: number; onSuccess: () => void }) {
	const level = LEVELS[levelNum]
	const width = level[0].length
	const height = level.length
	const groundPaths = useMemo(() => processGround(level), [level])
	const { fruits, goal } = useMemo(() => processGoal(level), [level])
	const initialPositions = useMemo(() => processInitialPositions(level), [level])
	const spikes = useMemo(() => processSpikes(level), [level])

	const snakeRef = useRef<SVGSVGElement>(null)

	const [key, resetKey] = useState({})
	const [positionState, setPositions] = useState(initialPositions)
	const [collectedFruits, setCollectedFruits] = useState<ReadonlyArray<readonly [x: number, y: number]>>([])

	useEffect(() => {
		const snake = snakeRef.current!.querySelector('circle')!
		const controller = new AbortController()
		const map = {
			arrowup: [0, -1],
			arrowdown: [0, 1],
			arrowleft: [-1, 0],
			arrowright: [1, 0],
		} as const
		let moving = false
		let nextAction: readonly [number, number] | null = null
		let positions = positionState
		let collectedFruits: Array<readonly [number, number]> = []

		const isAvailableFruit = (x: number, y: number) => {
			return level[y][x] === '*' && !collectedFruits.some(([fx, fy]) => fx === x && fy === y)
		}

		const processNextAction = () => {
			if (!nextAction || moving) return
			const [dx, dy] = nextAction
			nextAction = null
			const last = positions.at(-1)!
			const newHead = [last[0] + dx, last[1] + dy] as const
			// out of bounds
			if (newHead[0] < 0 || newHead[0] >= width || newHead[1] < 0 || newHead[1] >= height) return
			// self collision
			if (positions.some(([x, y]) => x === newHead[0] && y === newHead[1])) return
			// ground collision
			if (level[newHead[1]][newHead[0]] === '#') return
			// spike collision
			if (level[newHead[1]][newHead[0]] === 'x') return

			const isFruit = isAvailableFruit(newHead[0], newHead[1])
			moving = true
			if (isFruit) {
				flushSync(() => {
					setPositions((positions) => [positions[0], ...positions])
				})
				requestAnimationFrame(() => {
					positions = [...positions, newHead]
					setPositions(positions)
					collectedFruits.push(newHead)
					setCollectedFruits(collectedFruits)
				})
			} else {
				positions = [...positions.slice(1), newHead]
				setPositions(positions)
			}
		}

		const reset = () => {
			moving = true
			setPositions(initialPositions)
			setCollectedFruits([])
			resetKey({})
		}

		const checkDeath = () => {
			if (moving) return
			for (const [x, y] of positions) {
				if (y + 1 === height) {
					reset()
					return
				}
			}
		}

		const checkGoal = () => {
			if (moving) return
			const head = positions.at(-1)!
			if (head[0] !== goal[0] || head[1] !== goal[1]) return
			if (collectedFruits.length !== fruits.length) return
			moving = true
			controller.abort()
			onSuccess()
		}

		const checkGround = () => {
			if (moving) return
			let fallsOnSpikes = false
			for (const [x, y] of positions) {
				if (level[y + 1][x] === 'x') fallsOnSpikes = true
				if (level[y + 1][x] === '#' || isAvailableFruit(x, y + 1)) {
					return
				}
			}
			if (fallsOnSpikes) {
				reset()
				return
			}
			nextAction = null
			moving = true
			positions = positions.map(([x, y]) => [x, y + 1] as const)
			setPositions(positions)
		}
		checkGround()

		snake.addEventListener('transitionend', () => {
			moving = false
			checkDeath()
			checkGoal()
			checkGround()
			processNextAction()
		}, { signal: controller.signal })

		window.addEventListener('keydown', (e) => {
			const key = e.key.toLowerCase()
			if (key in map) {
				const action = map[key as keyof typeof map]
				nextAction = action
				if (moving) return
				processNextAction()
			}
			if (key === 'escape' || key === ' ') {
				reset()
			}
		}, { signal: controller.signal })

		return () => controller.abort()
	}, [key, level])

	return (
		<>
			<svg className={styles.ground} viewBox={`0 0 ${width} ${height}`}>
				{groundPaths.map((path, index) => (
					<path
						key={index}
						d={path}
						fill="saddlebrown"
						stroke="darkslategray"
						strokeWidth="0.05"
					/>
				))}
				{spikes.map(([x, y]) => (
					<polygon
						key={`${x}-${y}`}
						points={`
							${x},${y}
							${x + 0.5},${y + 0.3}
							${x + 1},${y}
							${x + 0.7},${y + 0.5}
							${x + 1},${y + 1}
							${x + 0.5},${y + 0.7}
							${x},${y + 1}
							${x + 0.3},${y + 0.5}
						`}
						fill="gray"
					/>
				))}
				{fruits.map(([x, y]) => !collectedFruits.some(([fx, fy]) => fx === x && fy === y) && (
					<circle
						key={`${x}-${y}`}
						cx={x + 0.5}
						cy={y + 0.5}
						r="0.5"
						fill="gold"
					/>
				))}
				<circle
					cx={goal[0] + 0.5}
					cy={goal[1] + 0.5}
					r={collectedFruits.length === fruits.length ? "0.5" : "0.3"}
					fill={collectedFruits.length === fruits.length ? "red" : "purple"}
				/>
			</svg>
			<svg className={styles.snake} viewBox={`0 0 ${width} ${height}`} ref={snakeRef}>
				<path
					d={`M ${positionState.map(([x, y]) => `${x + 0.5} ${y + 0.5}`).join(' ')}`}
					stroke="green"
					strokeWidth="0.9"
					fill="none"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<circle
					cx={positionState.at(-1)![0] + 0.5}
					cy={positionState.at(-1)![1] + 0.5}
					r="0.45"
					fill="darkgreen"
				/>
			</svg>
		</>
	)
}

function processSpikes(level: string[]) {
	const spikes: Array<readonly [number, number]> = []
	for (let y = 0; y < level.length; y++) {
		for (let x = 0; x < level[0].length; x++) {
			const char = level[y][x]
			if (char === 'x') {
				spikes.push([x, y] as const)
			}
		}
	}
	return spikes
}

function processGoal(level: string[]) {
	const fruits: Array<readonly [number, number]> = []
	const goal = [0, 0] as [number, number]

	for (let y = 0; y < level.length; y++) {
		for (let x = 0; x < level[0].length; x++) {
			const char = level[y][x]
			if (char === '*') {
				fruits.push([x, y] as const)
			} else if (char === 'O') {
				goal[0] = x
				goal[1] = y
			}
		}
	}

	return { fruits, goal }
}

function processInitialPositions(level: string[]) {
	const height = level.length
	const width = level[0].length

	// find numbers in level
	const found = [] as [number, number, number][]
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const char = level[y][x]
			const num = parseInt(char)
			if (!isNaN(num)) {
				found.push([num, x, y])
			}
		}
	}

	const positions: Array<readonly [number, number]> = []
	const sorted = found.sort((a, b) => b[0] - a[0])
	for (const [, x, y] of sorted) {
		positions.push([x, y] as const)
	}

	return positions
}

function processGround(level: string[]) {
	const zones = new Set<Set<number>>()
	const all = new Set<number>()

	const height = level.length
	const width = level[0].length

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (level[y][x] !== '#') continue
			const index = y * width + x
			all.add(index)

			const topIndex = (y - 1) * width + x
			const leftIndex = y * width + (x - 1)

			if (all.has(topIndex) && all.has(leftIndex)) {
				const topZone = findSet(zones, topIndex)!
				const leftZone = findSet(zones, leftIndex)!
				const zone = topZone.union(leftZone)
				zone.add(index)
				zones.delete(topZone)
				zones.delete(leftZone)
				zones.add(zone)
			} else if (all.has(topIndex)) {
				const zone = findSet(zones, topIndex)!
				zone.add(index)
			} else if (all.has(leftIndex)) {
				const zone = findSet(zones, leftIndex)!
				zone.add(index)
			} else {
				const zone = new Set<number>()
				zone.add(index)
				zones.add(zone)
			}
		}
	}

	const paths: string[] = []
	for (const zone of zones) {
		// find top-left most cell
		const min = [Infinity, Infinity] as [number, number]
		for (const index of zone) {
			const x = index % width
			const y = Math.floor(index / width)
			if (y < min[1] || (y === min[1] && x < min[0])) {
				min[0] = x
				min[1] = y
			}
		}

		let path = `M ${min[0]} ${min[1]}`

		// start at the top-left corner of the top-left most cell
		// advance clockwise until we reach the starting point again
		let dir = 0 // 0: right, 1: down, 2: left, 3: up
		let x = min[0]
		let y = min[1]
		const startX = x
		const startY = y

		let iterations = 0
		do {
			let i = 0
			dirloop: for (; i < 4; i++) {
				if ((i + 2) % 4 === dir) continue // don't go backwards
				switch (i) {
					case 0: { // right
						const hasCellAbove = zone.has((y - 1) * width + x)
						const hasCellBelow = zone.has(y * width + x)
						if (hasCellAbove !== hasCellBelow) {
							x = x + 1
							path += ` ${x} ${y}`
							break dirloop
						}
						break
					}
					case 1: { // down
						const hasCellRight = zone.has(y * width + x)
						const hasCellLeft = zone.has(y * width + (x - 1))
						if (hasCellRight !== hasCellLeft) {
							y = y + 1
							path += ` ${x} ${y}`
							break dirloop
						}
						break
					}
					case 2: { // left
						const hasCellBelow = zone.has(y * width + (x - 1))
						const hasCellAbove = zone.has((y - 1) * width + (x - 1))
						if (hasCellBelow !== hasCellAbove) {
							x = x - 1
							path += ` ${x} ${y}`
							break dirloop
						}
						break
					}
					case 3: { // up
						const hasCellLeft = zone.has((y - 1) * width + (x - 1))
						const hasCellRight = zone.has((y - 1) * width + x)
						if (hasCellLeft !== hasCellRight) {
							y = y - 1
							path += ` ${x} ${y}`
							break dirloop
						}
						break
					}
				}
			}
			dir = i
			if (++iterations > 1000) throw new Error('Infinite loop detected while processing ground')
		} while (x !== startX || y !== startY || dir === 0)

		path += ' Z'

		paths.push(path)
	}
	return paths
}

function findSet(sets: Set<Set<number>>, value: number) {
	for (const set of sets) {
		if (set.has(value)) return set
	}
	return null
}