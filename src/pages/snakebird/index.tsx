import styles from './styles.module.css'
import { Head } from "#components/Head"
import type { RouteMeta } from "#router"
import { useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"

export const meta: RouteMeta = {
	title: 'Snakebird',
	tags: ['wip']
}

const SIZE = 30

const LEVEL_0 = [
	'..............................',
	'..............................',
	'..............................',
	'..............................',
	'..............................',
	'..............................',
	'..............................',
	'..............................',
	'..............................',
	'..............................',
	'..............................',
	'..............................',
	'..............................',
	'................##.....O......',
	'................####..........',
	'.................##...........',
	'.................#...*.#......',
	'.................#.#...##...*.',
	'################...##.......##',
	'##############################',
	'##############################',
	'..............................',
	'..............................',
	'..............................',
	'..............................',
	'..............................',
	'..............................',
	'..............................',
	'..............................',
	'..............................',
]

const level_map = {
	'.': 'empty',
	'#': 'ground',
	'*': 'fruit',
	'O': 'goal',
}

export default function Snakebird() {
	const snakeRef = useRef<SVGSVGElement>(null)
	const [positionState, setPositions] = useState<ReadonlyArray<readonly [x: number, y: number]>>([[10, 17], [11, 17], [12, 17]])

	const [collectedFruits, setCollectedFruits] = useState<ReadonlyArray<readonly [x: number, y: number]>>([])
	const [level, setLevel] = useState(() => structuredClone(LEVEL_0))

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
		let collectedFruits: Array<readonly [number, number]> = []

		const processNextAction = () => {
			if (!nextAction || moving) return
			const [dx, dy] = nextAction
			nextAction = null
			const last = positions.at(-1)!
			const newHead = [last[0] + dx, last[1] + dy] as const
			// out of bounds
			if (newHead[0] < 0 || newHead[0] >= SIZE || newHead[1] < 0 || newHead[1] >= SIZE) return
			// self collision
			if (positions.some(([x, y]) => x === newHead[0] && y === newHead[1])) return
			// ground collision
			if (level[newHead[1]][newHead[0]] === '#') return

			const isFruit = level[newHead[1]][newHead[0]] === '*' && !collectedFruits.some(([x, y]) => x === newHead[0] && y === newHead[1])
			moving = true
			if (isFruit) {
				flushSync(() => {
					setPositions((positions) => [...positions, last])
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

		const checkGround = () => {
			for (const [x, y] of positions) {
				if (level[y + 1][x] === '#') {
					return
				}
			}
			nextAction = null
			moving = true
			positions = positions.map(([x, y]) => [x, y + 1] as const)
			setPositions(positions)
		}

		checkGround()

		snake.querySelector('circle')!.addEventListener('transitionend', () => {
			console.log('transitionend')
			moving = false
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
		}, { signal: controller.signal })

		return () => controller.abort()
	}, [level])

	return (
		<div className={styles.main}>
			<Head />

			<div className={styles.content}>
				<svg className={styles.ground} viewBox={`0 0 ${SIZE} ${SIZE}`}>
					{level.map((row, y) =>
						[...row].map((cell, x) => {
							const type = level_map[cell as keyof typeof level_map]
							if (type === 'empty') return null
							if (type === 'fruit' && collectedFruits.some(([fx, fy]) => fx === x && fy === y)) return null
							return (
								<rect
									key={`${x}-${y}`}
									x={x}
									y={y}
									width={1}
									height={1}
									fill={type === 'ground' ? 'saddlebrown' : type === 'fruit' ? 'gold' : 'purple'}
								/>
							)
						})
					)}
				</svg>
				<svg className={styles.snake} viewBox={`0 0 ${SIZE} ${SIZE}`} ref={snakeRef}>
					<path
						d={`M ${positionState.map(([x, y]) => `${x + 0.5} ${y + 0.5}`).join(' ')}`}
						stroke="green"
						strokeWidth="1"
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
			</div>
		</div>
	)
}
