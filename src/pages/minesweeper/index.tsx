import { useEffect, useState, useSyncExternalStore } from "react"
import { Head } from "~/components/Head"
import type { RouteMeta } from "~/router"

export const meta: RouteMeta = {
	title: 'Minesweeper',
	image: './screen.png',
	tags: ['game']
}

type State = {
	width: number
	height: number
	mines: number
	board: number[][]
	visible: boolean[][]
	flagged: boolean[][]
	lost: boolean
	won: boolean
	startTimer: number
}

function getState(): State | undefined {
	const key = window.location.hash
	if (!key) return
	if (cache.has(key)) return cache.get(key)
	const result = JSON.parse(atob(key.slice(1)))
	cache.set(key, result)
	return result
}

function setState(state: State) {
	const next = btoa(JSON.stringify(state))
	window.location.replace(`#${next}`)
	cache.set(window.location.hash, state)
}

function randomInitialState(width: number, height: number, mines: number): State {
	const board = Array(height).fill(0).map(() => Array(width).fill(0))
	const visible = Array(height).fill(0).map(() => Array(width).fill(false))
	const flagged = Array(height).fill(0).map(() => Array(width).fill(false))

	for (let i = 0; i < mines; i++) {
		let x, y
		do {
			x = Math.floor(Math.random() * width)
			y = Math.floor(Math.random() * height)
		} while (board[y][x] === -1)
		board[y][x] = -1
		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				if (board[y + dy]?.[x + dx] !== undefined && board[y + dy][x + dx] !== -1) {
					board[y + dy][x + dx]++
				}
			}
		}
	}

	const startTimer = Date.now()

	return { width, height, mines, board, visible, flagged, lost: false, won: false, startTimer }
}

const cache = new Map<string, State>()

export default function () {
	const state = useSyncExternalStore(
		(sub) => {
			window.addEventListener('hashchange', sub)
			return () => window.removeEventListener('hashchange', sub)
		},
		() => {
			const existing = getState()
			if (existing) return existing
			const initial = randomInitialState(10, 10, 10)
			setState(initial)
			return initial
		},
	)

	const revealAdjacentCells = (rowIndex: number, colIndex: number, newVisible: boolean[][]) => {
		const directions = [
			[-1, -1], [-1, 0], [-1, 1],
			[0, -1], [0, 1],
			[1, -1], [1, 0], [1, 1]
		]

		const stack = [[rowIndex, colIndex]]

		while (stack.length > 0) {
			const [row, col] = stack.pop()!
			for (const [dx, dy] of directions) {
				const newRow = row + dx
				const newCol = col + dy
				if (
					newRow >= 0 && newRow < state.board.length &&
					newCol >= 0 && newCol < state.board[0].length &&
					!newVisible[newRow][newCol]
				) {
					newVisible[newRow][newCol] = true
					if (state.board[newRow][newCol] === 0) {
						stack.push([newRow, newCol])
					}
				}
			}
		}
	}

	const hasWon = (visible: boolean[][], flagged: boolean[][]) => {
		const totalCells = state.width * state.height
		const totalVisible = visible.flat().filter(Boolean).length
		const totalFlagged = flagged.flat().filter(Boolean).length
		const won = totalCells - totalVisible - totalFlagged === 0 && totalFlagged === state.mines
		return won
	}

	const handleCellClick = (rowIndex: number, colIndex: number) => {
		if (state.flagged[rowIndex][colIndex] || state.visible[rowIndex][colIndex]) {
			return // Do nothing if the cell is flagged or already visible
		}

		const newVisible = [...state.visible]
		newVisible[rowIndex][colIndex] = true

		// Check if the cell is a mine
		if (state.board[rowIndex][colIndex] === -1) {
			const newVisible = state.board.map(row => row.map(() => true))
			setState({ ...state, visible: newVisible, lost: true })
		} else {
			if (state.board[rowIndex][colIndex] === 0) {
				revealAdjacentCells(rowIndex, colIndex, newVisible)
			}
			// Check if the player has won
			const won = hasWon(newVisible, state.flagged)
			setState({ ...state, visible: newVisible, won })
		}
	}


	return (
		<>
			<Head />
			<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
				<Timer startTimer={state.startTimer} stop={state.won || state.lost} />
				<div style={{ display: 'grid', gridTemplateColumns: `repeat(${state.width}, min-content)` }}>
					{state.board.map((row, rowIndex) =>
						row.map((cell, colIndex) => (
							<button
								key={`${rowIndex}-${colIndex}`}
								style={{
									width: 30,
									height: 30,
									backgroundColor: state.visible[rowIndex][colIndex] ? '#ddd' : '#bbb',
									border: '1px solid #999',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									fontWeight: 'bold',
									color: state.flagged[rowIndex][colIndex] ? 'red' : 'black',
								}}
								onClick={() => {
									handleCellClick(rowIndex, colIndex)
								}}
								onContextMenu={(e) => {
									e.preventDefault()
									if (state.visible[rowIndex][colIndex]) return
									const newFlagged = [...state.flagged]
									newFlagged[rowIndex][colIndex] = !newFlagged[rowIndex][colIndex]
									const won = hasWon(state.visible, newFlagged)
									setState({ ...state, flagged: newFlagged, won })
								}}
							>
								{state.visible[rowIndex][colIndex] ? (cell === -1 ? '💣' : cell || '') : (state.flagged[rowIndex][colIndex] ? '🚩' : '')}
							</button>
						))
					)}
				</div>
				{(state.won || state.lost) && (
					<form onSubmit={(e) => {
						e.preventDefault()
						const formData = new FormData(e.currentTarget)
						setState(randomInitialState(
							Number(formData.get('width') ?? state.width),
							Number(formData.get('height') ?? state.height),
							Number(formData.get('mines') ?? state.mines),
						))
					}}>
						{state.won ? <h2>You Win!</h2> : <h2>Game Over</h2>}
						<p>
							<label>
								Width: <input type="number" defaultValue={state.width} name="width" />
							</label>
						</p>
						<p>
							<label>
								Height: <input type="number" defaultValue={state.height} name="height" />
							</label>
						</p>
						<p>
							<label>
								Mines: <input type="number" defaultValue={state.mines} name="mines" />
							</label>
						</p>
						<button>Play Again</button>
					</form>
				)}
			</div>
		</>
	)
}


const formatTime = (time: number) => {
	const hours = Math.floor(time / 3600000)
	const minutes = Math.floor((time % 3600000) / 60000)
	const seconds = Math.floor((time % 60000) / 1000)
	return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function Timer({ startTimer, stop }: { startTimer: number, stop: boolean }) {
	const [time, setTime] = useState(() => formatTime(Date.now() - startTimer))

	useEffect(() => {
		if (stop) return
		const interval = setInterval(() => {
			setTime(formatTime(Date.now() - startTimer))
		}, 1000)
		return () => clearInterval(interval)
	}, [stop])

	return <div style={{
		fontFamily: 'Courier, monospace',
		fontSize: '48px',
		fontWeight: 'bold',
		letterSpacing: '5px',
		color: '#f00',
		padding: '10px',
		borderRadius: '5px',
		display: 'inline-block',
	}}>{time}</div>
}