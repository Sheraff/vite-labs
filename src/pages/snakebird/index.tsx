import styles from './styles.module.css'
import { Head } from "#components/Head"
import type { RouteMeta } from "#router"
import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { FRUIT, GOAL, LEVELS, SPIKE, WALL } from "./levels"

export const meta: RouteMeta = {
	title: 'Snakebird',
	image: './screen.png',
	tags: ['game']
}

export default function Snakebird() {
	const [levelNum, setLevelNum] = useState(0)

	const isMultiSnakeLevel = useMemo(() => {
		for (const line of LEVELS[levelNum]) {
			if (line.includes('A') || line.includes('a')) {
				return true
			}
		}
	}, [levelNum])

	return (
		<div className={styles.main}>
			<Head />
			<div>
				<fieldset>
					<legend>Controls</legend>
					<p>Arrow keys to move</p>
					<p>Space or Escape to restart</p>
					{isMultiSnakeLevel && <p>Tab or Enter to select snake</p>}
					<p>Backspace to undo</p>
				</fieldset>
				<fieldset>
					<legend>Level</legend>
					Level {levelNum} / {LEVELS.length - 1}
					<button type="button" onClick={() => setLevelNum((n) => (n - 1 + LEVELS.length) % LEVELS.length)}>Previous</button>
					<button type="button" onClick={() => setLevelNum((n) => (n + 1) % LEVELS.length)}>Next</button>
				</fieldset>
			</div>

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
	const [controlling, setControlling] = useState(0)
	const spikes = useMemo(() => processSpikes(level), [level])

	const snakeRef = useRef<SVGSVGElement>(null)

	const [key, resetKey] = useState(0)
	const [positionState, setPositions] = useState(initialPositions)
	const [collectedFruits, setCollectedFruits] = useState<ReadonlyArray<readonly [x: number, y: number]>>([])
	const [snakesInGoal, setSnakesInGoal] = useState<number[]>([])

	useEffect(() => {
		const snake = snakeRef.current!
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
		let controlling = 0
		let collectedFruits: Array<readonly [number, number]> = []
		let snakesInGoal: number[] = []

		const isAvailableFruit = (x: number, y: number) => level[y]?.[x] === FRUIT && !collectedFruits.some(([fx, fy]) => fx === x && fy === y)
		const isOutOfBounds = (x: number, y: number) => x < 0 || x >= width || y < 0 || y >= height
		const isSelfCollision = (i: number, x: number, y: number) => positions[i].some(([px, py]) => px === x && py === y)
		const isInWalls = (x: number, y: number) => level[y]?.[x] === WALL
		const isInSpikes = (x: number, y: number) => level[y]?.[x] === SPIKE

		const nextSnake = () => {
			do {
				controlling = (controlling + 1) % positions.length
			} while (snakesInGoal.includes(controlling))
			setControlling(controlling)
		}

		const memory: string[] = []
		const serialize = () => {
			const state = JSON.stringify({
				controlling,
				positions,
				collectedFruits,
				snakesInGoal,
			})
			if (memory.at(-1) === state) return
			memory.push(state)
		}
		const deserialize = () => {
			const str = memory.pop()
			if (!str) return
			const state = JSON.parse(str)
			controlling = state.controlling
			positions = state.positions
			collectedFruits = state.collectedFruits
			snakesInGoal = state.snakesInGoal
			moving = false
			nextAction = null
			setControlling(controlling)
			setPositions(positions)
			setCollectedFruits(collectedFruits)
			setSnakesInGoal(snakesInGoal)
		}

		const processNextAction = () => {
			if (!nextAction || moving) return
			const [dx, dy] = nextAction
			nextAction = null
			const last = positions[controlling].at(-1)!
			const x = last[0] + dx
			const y = last[1] + dy

			const checked = new Set([controlling])

			// out of bounds
			if (isOutOfBounds(x, y)) return
			// self collision (only for controlling snake, the other cannot collide with theirselves)
			if (isSelfCollision(controlling, x, y)) return
			// ground collision
			if (isInWalls(x, y)) return
			// spike collision
			if (isInSpikes(x, y)) return
			// collision with other snakes
			const collisionIndex = positions.findIndex((snake, i) => {
				if (i === controlling) return
				if (snakesInGoal.includes(i)) return
				return snake.some(([px, py]) => px === x && py === y)
			})
			if (collisionIndex !== -1) {
				const checking = new Set([collisionIndex])
				for (const j of checking) {
					if (j === controlling) continue
					const snake = positions[j]
					for (const [px, py] of snake) {
						if (isOutOfBounds(px + dx, py + dy)) return
						if (isInWalls(px + dx, py + dy)) return
						if (isInSpikes(px + dx, py + dy)) return
						if (isAvailableFruit(px + dx, py + dy)) return
						for (let k = 0; k < positions.length; k++) {
							if (k === j) continue
							if (snakesInGoal.includes(k)) continue
							const other = positions[k]
							// if it would collide with yet another snake, we need to check that one too
							const collides = other.some(([ox, oy]) => ox === px + dx && oy === py + dy)
							if (collides) checking.add(k)
						}
					}
					checked.add(j)
				}
			}
			// verify that all the snakes that move won't collide with the current one
			for (const j of checked) {
				if (j === controlling) continue
				const snake = positions[j]
				for (const [px, py] of snake) {
					const collides = positions[controlling].some(([ox, oy]) => ox === px + dx && oy === py + dy)
					if (collides) return
				}
			}

			serialize()
			moving = true
			const newHead = [x, y] as const
			if (isAvailableFruit(x, y)) {
				flushSync(() => {
					// duplicate the tail point, so animation plays when growing
					setPositions((positions) => {
						positions = [...positions]
						positions[controlling] = [positions[controlling][0], ...positions[controlling]]
						return positions
					})
				})
				requestAnimationFrame(() => {
					positions = [...positions]
					positions[controlling] = [...positions[controlling], newHead]
					setPositions(positions)
					collectedFruits.push(newHead)
					setCollectedFruits(collectedFruits)
				})
			} else {
				positions = [...positions]
				for (const i of checked) {
					if (i === controlling) {
						positions[i] = [...positions[i].slice(1), newHead]
					} else {
						positions[i] = positions[i].map(([x, y]) => [x + dx, y + dy] as const)
					}
				}
				setPositions(positions)
			}
		}

		const reset = () => {
			moving = true
			setPositions(initialPositions)
			setCollectedFruits([])
			setControlling(0)
			setSnakesInGoal([])
			resetKey(r => r + 1)
		}

		let animating = false
		const checkGoal = () => {
			if (moving) return
			const winner = positions[controlling]
			const head = winner.at(-1)!
			if (head[0] !== goal[0] || head[1] !== goal[1]) return
			if (collectedFruits.length !== fruits.length) return

			queueMicrotask(async () => {
				animating = true
				for (let i = 0; i < winner.length - 1; i++) {
					positions = [...positions]
					const part = winner[i + 1]
					const next = [...Array(i + 1).fill(part), ...winner.slice(i + 1)]
					positions[controlling] = next
					const p = new Promise(r => {
						const controller = new AbortController()
						const onMoveEnd = () => {
							controller.abort()
							r(null)
						}
						snake.addEventListener('transitionend', onMoveEnd, { signal: controller.signal })
						snake.addEventListener('transitioncancel', onMoveEnd, { signal: controller.signal })
					})
					setPositions(positions)
					await p
				}

				snakesInGoal = [...snakesInGoal, controlling]
				setSnakesInGoal(snakesInGoal)
				if (snakesInGoal.length < positions.length) {
					animating = false
					moving = false
					nextSnake()
					checkGround()
				} else {
					moving = true
					controller.abort()
					onSuccess()
				}
			})

			return true
		}

		const checkGround = () => {
			if (moving) return
			snake_loop: for (let i = 0; i < positions.length; i++) {
				if (snakesInGoal.includes(i)) continue
				let fallsOnSpikes = false
				for (const [x, y] of positions[i]) {
					if (level[y + 1]?.[x] === SPIKE) fallsOnSpikes = true
					if (level[y + 1]?.[x] === WALL) continue snake_loop
					if (isAvailableFruit(x, y + 1)) continue snake_loop
					if (positions.some((other, otherIndex) => otherIndex !== i && other.some(([ox, oy]) => ox === x && oy === y + 1))) continue snake_loop
				}
				if (fallsOnSpikes) {
					reset()
					return
				}
				nextAction = null
				moving = true
				// check if any part would fall out of bounds
				for (const [x, y] of positions[i]) {
					if (y + 1 === height) {
						reset()
						return
					}
				}
				positions = [...positions]
				positions[i] = positions[i].map(([x, y]) => [x, y + 1] as const)
				setPositions(positions)
			}
		}
		checkGround()

		let tcount = 0
		const onMoveEnd = () => {
			if (animating) return
			tcount--
			if (tcount > 0) return
			moving = false
			const hasGoal = checkGoal()
			if (hasGoal) return
			checkGround()
			processNextAction()
		}
		snake.addEventListener('transitionstart', () => {
			if (animating) return
			tcount++
		}, { signal: controller.signal })
		snake.addEventListener('transitioncancel', onMoveEnd, { signal: controller.signal })
		snake.addEventListener('transitionend', onMoveEnd, { signal: controller.signal })

		window.addEventListener('keydown', (e) => {
			const key = e.key.toLowerCase()
			if (key in map) {
				e.preventDefault()
				const action = map[key as keyof typeof map]
				nextAction = action
				if (moving) return
				processNextAction()
			}
			if (key === 'escape' || key === ' ') {
				e.preventDefault()
				reset()
			}
			if (key === 'tab' || key === 'enter') {
				e.preventDefault()
				nextAction = null
				nextSnake()
			}
			if (key === 'backspace') {
				e.preventDefault()
				if (moving) return
				deserialize()
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
			<svg key={key} className={styles.snake} viewBox={`0 0 ${width} ${height}`} ref={snakeRef}>
				{positionState.map((snake, index) => {
					if (snakesInGoal.includes(index)) return null
					return (
						<Fragment key={index}>
							<path
								d={`M ${snake.map(([x, y]) => `${x + 0.5} ${y + 0.5}`).join(' ')}`}
								stroke={index === 0 ? "green" : index === 1 ? "blue" : "salmon"}
								strokeWidth="0.9"
								fill="none"
								strokeLinecap="round"
								strokeLinejoin="round"
								opacity={controlling === index ? 1 : 0.5}
							/>
							<circle
								cx={snake.at(-1)![0] + 0.5}
								cy={snake.at(-1)![1] + 0.5}
								r={controlling === index ? "0.45" : "0.3"}
								fill={index === 0 ? "darkgreen" : index === 1 ? "royalblue" : "coral"}
								opacity={controlling === index ? 1 : 0.5}
							/>
						</Fragment>
					)
				})}
			</svg>
		</>
	)
}

function processSpikes(level: string[]) {
	const spikes: Array<readonly [number, number]> = []
	for (let y = 0; y < level.length; y++) {
		for (let x = 0; x < level[0].length; x++) {
			const char = level[y][x]
			if (char === SPIKE) {
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
			if (char === FRUIT) {
				fruits.push([x, y] as const)
			} else if (char === GOAL) {
				goal[0] = x
				goal[1] = y
			}
		}
	}

	return { fruits, goal }
}

function processInitialPositions(level: string[]) {
	const ref = [
		['1', '2', '3', '4', '5', '6', '7', '8'],
		['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
		['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
	]
	const height = level.length
	const width = level[0].length

	const snakes = [] as Array<Array<readonly [number, number]>>
	for (const ids of ref) {

		// find numbers in level
		const found = [] as [number, number][]
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const char = level[y][x]
				if (ids.includes(char)) {
					found.push([x, y])
				}
			}
		}

		found.sort((a, b) => {
			const aVal = ids.indexOf(level[a[1]][a[0]])
			const bVal = ids.indexOf(level[b[1]][b[0]])
			return bVal - aVal
		})

		if (found.length > 0) {
			snakes.push(found)
		}
	}

	return snakes
}

function processGround(level: string[]) {
	const zones = new Set<Set<number>>()
	const all = new Set<number>()

	const height = level.length
	const width = level[0].length

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (level[y][x] !== WALL) continue
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