import type { RouteMeta } from "#router"

import { Head } from "#components/Head"
import { makeFrameCounter } from "#components/makeFrameCounter"
import { useEffect, useRef, useState } from "react"

import styles from "./styles.module.css"
import { flushSync } from "react-dom"

export const meta: RouteMeta = {
	title: "2048",
	image: "./screen.png",
	tags: ["game"],
}

const SIDE = 4

export default function TwoThousandFortyEightPage() {
	const [state, setState] = useState<State>({tiles: []})
	const container = useRef<HTMLDivElement>(null)
	const [lost, setLost] = useState<null|Summary>(null)
	const [key, setKey] = useState(0)

	useEffect(() => {
		const element = container.current
		if (!element) return
		const controller = new AbortController()
		const s = state

		start({
			signal: controller.signal,
			state: s,
			container: element,
			setState: (next) => {
				const val = typeof next === 'function' ? next(s) : next
				Object.assign(s, val)
				setState(val)
			},
			onLost: (summary) => setLost(summary),
		})

		return () => {
			controller.abort()
		}
	}, [key])

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
				<output>
					<button type="button" onClick={()=>{
						setLost(null)
						setState({tiles: []})
						setKey(p => p+1)
					}}>restart</button>
					{lost && <p>Scored {lost.score} in {lost.turns} turns</p>}
				</output>
			</div>
			<div
				ref={container}
				className={styles.game}
				style={{
					'--side': SIDE,
				} as React.CSSProperties}
			>
				{Array.from({ length: SIDE*SIDE}).map((_, i) => (
					<div key={i} className={styles.spot} />
				))}
				{state.tiles.map((tile) => (
					<div
						key={tile.id}
						className={styles.tile}
						data-value={2**tile.value}
						data-prev={2**tile.previous}
						data-state={tile.state}
						style={{
							'--x': tile.x,
							'--y': tile.y,
							'--z': tile.order,
							'--id': tile.id,
							'--dist': tile.distance,
							'--prev': tile.previous,
							'--value': tile.value,
						} as React.CSSProperties}
					/>
				))}
			</div>
		</div>
	)
}

type Tile = {
	id: number
	value: number
	previous: number,
	x: number
	y: number
	state: 'merge-away' | 'merge-grow' | 'new' | 'stable'
	distance: number
	order: number
}

type State = {
	tiles: Tile[]
}

type Summary = {
	turns: number
	score: number
}

function start({
	signal,
	state,
	container,
	setState,
	onLost,
}: {
	signal: AbortSignal
	state: State
	container: HTMLDivElement
	setState: React.Dispatch<React.SetStateAction<State>>
	onLost: (summary: Summary) => void
}) {
	let animating = false
	type Direction = 'up' | 'down' | 'left' | 'right'
	let nextDirection: Direction | null = null
	let lost = false
	let turns = 0
	let score = 0

	function queueAction(dir: Direction) {
		nextDirection = dir
		if (!animating) {
			performAction()
		}
	}

	document.addEventListener('keydown', (e) => {
		if (lost) return
		if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return
		if (e.key === 'ArrowUp') {
			queueAction('up')
		} else if (e.key === 'ArrowDown') {
			queueAction('down')
		} else if (e.key === 'ArrowLeft') {
			queueAction('left')
		} else if (e.key === 'ArrowRight') {
			queueAction('right')
		}
	}, { signal })

	function performAction() {
		if (lost) return
		if (!nextDirection || animating) throw new Error("Invalid state: no action queued or already animating")
		const dir = nextDirection
		nextDirection = null
		let someMoved = false

		const next = structuredClone(state)
		const ordered = next.tiles.toSorted((a, b) => {
			if (dir === 'up') return a.y - b.y
			if (dir === 'down') return b.y - a.y
			if (dir === 'left') return a.x - b.x
			if (dir === 'right') return b.x - a.x
			throw new Error("Invalid direction")
		})

		for (let i = 0; i < ordered.length; i++) {
			const tile = ordered[i]
			tile.order = i
			const x = tile.x
			const y = tile.y

			let moved = false
			for (let j = i - 1; j >= 0; j--) {
				const other = ordered[j]
				const sameLine = (dir === 'up' || dir === 'down') ? other.x === tile.x : other.y === tile.y
				if (!sameLine) continue
				const collides = (dir === 'up' && other.y < tile.y) || (dir === 'down' && other.y > tile.y) || (dir === 'left' && other.x < tile.x) || (dir === 'right' && other.x > tile.x)
				if (!collides) continue
				if (other.value !== tile.value || other.state === 'merge-grow') {
					if (dir === 'up') tile.y = other.y + 1
					if (dir === 'down') tile.y = other.y - 1
					if (dir === 'left') tile.x = other.x + 1
					if (dir === 'right') tile.x = other.x - 1
					moved = true
					break
				}
				other.state = 'merge-away'
				tile.state = 'merge-grow'
				tile.value += 1
				if (dir === 'up') tile.y = other.y
				if (dir === 'down') tile.y = other.y
				if (dir === 'left') tile.x = other.x
				if (dir === 'right') tile.x = other.x
				moved = true
				break
			}
			if (!moved) {
				if (dir === 'up') tile.y = 0
				if (dir === 'down') tile.y = SIDE - 1
				if (dir === 'left') tile.x = 0
				if (dir === 'right') tile.x = SIDE - 1
			}

			tile.distance = Math.abs(tile.x - x) + Math.abs(tile.y - y)
			if (tile.distance > 0) someMoved = true
		}

		if (someMoved) {
			animating = true
			turns++
			const newTile = generateRandomTile(next.tiles, 2)
			const axis = (dir === 'up' || dir === 'down') ? 'x' : 'y'
			newTile.distance = Math.max(...next.tiles.filter(t => t[axis] === newTile[axis]).map(t => t.distance))
			next.tiles.push(newTile)
			score += 2**newTile.value

			setState(next)

			if (hasLost(next.tiles)) {
				lost = true
				onLost({turns, score})
			}
		}
	}

	function afterAction() {
		if (!animating) return

		const next = structuredClone(state)
		const tiles = next.tiles
			.filter(tile => tile.state !== 'merge-away')
		next.tiles = tiles
		for (let i = 0; i < tiles.length; i++) {
			const tile = tiles[i]
			tile.state = 'stable'
			tile.previous = tile.value
		}
		flushSync(() => setState(next))

		animating = false
		if (nextDirection) {
			performAction()
		}
	}

	let counter = 0
	function animStart() { counter++ }
	function animEnd() {
		counter--
		if (counter > 0) return
		if (counter < 0) counter = 0
		setTimeout(() => {
			if (counter === 0) {
				afterAction()
			}
		}, 100)
	}
	container.addEventListener('animationstart', animStart, { signal })
	container.addEventListener('transitionstart', animStart, { signal })
	container.addEventListener('animationend', animEnd, { signal })
	container.addEventListener('transitionend', animEnd, { signal })

	init: {
		animating = true
		setState((prev) => {
			const next = structuredClone(prev)
			for (let i = 0; i < 2; i++) {
				next.tiles.push(generateRandomTile(next.tiles, 2))
				score += 2**next.tiles.at(-1)!.value
			}
			return next
		})
	}
}

function generateRandomTile(tiles: Tile[], max: number): Tile {
	const value = Math.floor((Math.random() * max) + 1)
	let x: number, y: number
	do {
		x = Math.floor(Math.random() * SIDE)
		y = Math.floor(Math.random() * SIDE)
	} while (tiles.some(tile => tile.x === x && tile.y === y))
	const id = Math.random()
	const order = tiles.length
	return { id, value, previous: value, x, y, state: 'new', distance: 0, order }
}

function hasLost(tiles: Tile[]) {
	if (tiles.length < SIDE * SIDE) return false

	const set = new Set<number>()
	for (const tile of tiles) {
		const key = tile.x * SIDE + tile.y
		set.add(key)
	}
	if (set.size < SIDE * SIDE) return false

	for (const tile of tiles) {
		if (tile.state === 'merge-away') continue
		for (const other of tiles) {
			if (other.state === 'merge-away') continue
			if (tile === other) continue
			const adjacent = (tile.x === other.x && Math.abs(tile.y - other.y) === 1) || (tile.y === other.y && Math.abs(tile.x - other.x) === 1)
			if (!adjacent) continue
			if (tile.value === other.value) return false
		}
	}

	return true
}