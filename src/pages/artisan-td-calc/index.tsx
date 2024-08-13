import { useMemo, useState, type CSSProperties } from "react"
import styles from './styles.module.css'
import { Head } from "~/components/Head"
import type { RouteMeta } from "~/router"

export const meta: RouteMeta = {
	title: 'Artisan TD calculator',
}

const SIDE = 8
const TURNS = 15

enum State {
	OFF,
	ON,
	INSIDE,
}

const makeGrid = (value: State = State.OFF) => Array.from({ length: SIDE }, () => Array.from({ length: SIDE }, () => value))

export default function Lightning() {
	const [grid, setGrid] = useState(makeGrid)

	const computed = useMemo(() => computeInside(grid), [grid])


	return (
		<div className={styles.main}>
			<Head />
			<Results grid={computed} />
			<p>Click on the grid below to draw your farm towers:</p>
			<DisplayGrid
				grid={computed}
				onToggle={(x, y, value) => {
					const newGrid = structuredClone(grid)
					newGrid[y][x] = value
					setGrid(newGrid)
				}}
			/>

		</div>
	)
}

function Results({ grid }: { grid: State[][] }) {
	const summary = useMemo(() => counts(grid), [grid])

	const cost = summary[State.ON] * 20
	const perTurn = summary[State.INSIDE] * 10

	const rows = {
		total: Array.from({ length: TURNS }, (_, i) => Math.round(perTurn * (i + 1) - cost)),
		totalSell: Array.from({ length: TURNS }, (_, i) => Math.round(perTurn * (i + 1) - cost / 2)),
		bank: Array.from({ length: TURNS }, (_, i) => Math.round(i * cost * 0.2)),
		bankCompound: Array.from({ length: TURNS }, (_, i) => Math.round(cost * 1.2 ** i - cost)),
		both: Array.from({ length: TURNS }).reduce<number[]>((arr, _, i) => (arr.push(Math.round((i === 0 ? 0 : ((arr[i - 1] + cost / 2) * 1.2)) + perTurn - cost / 2)), arr), []),
	} as const

	return (
		<>
			<table className={styles.table}>
				<tbody>
					<tr>
						<th scope="row">Initial cost</th>
						<td>{cost}</td>
					</tr>
					<tr>
						<th scope="row">Sale price</th>
						<td>{cost / 2}</td>
					</tr>
					<tr>
						<th scope="row">Per turn</th>
						<td>{perTurn}</td>
					</tr>
					<tr>
						<th scope="row">Walls</th>
						<td>{summary[State.ON]}</td>
					</tr>
					<tr>
						<th scope="row">Fields</th>
						<td>{summary[State.INSIDE]}</td>
					</tr>
				</tbody>
			</table>
			<table className={styles.table} width="100%">
				<thead>
					<tr>
						<th></th>
						{Array.from({ length: TURNS }, (_, i) => (
							<th key={i}>{i + 1}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{Object.entries(rows).map(([key, values]) => {
						const det = details[key as keyof typeof details]
						return (
							<tr key={key}>
								<th scope="row">
									<p data-title>{det.title}</p>
									<p data-subtitle>{det.subtitle}</p>
									<math display="block">
										{det.formula}
									</math>
								</th>

								{values.map((v, i) => (
									<td key={i}>{v}</td>
								))}
							</tr>
						)
					})}
				</tbody>
			</table>
		</>
	)
}

function DisplayGrid({ grid, onToggle }: { grid: State[][], onToggle: (x: number, y: number, value: State) => void }) {
	return (
		<div className={styles.grid} style={{ '--side': SIDE } as CSSProperties}>
			{grid.map((row, y) => (
				row.map((cell, x) => (
					<div
						key={`${x}-${y}`}
						className={styles.cell}
						data-state={cell === State.ON ? 'on' : cell === State.INSIDE ? 'in' : 'off'}
						onClick={() => onToggle(x, y, cell === State.ON ? State.OFF : State.ON)}
					>
						{cell === State.INSIDE ? '🌾' : cell === State.ON ? '🚜' : ''}
					</div>
				))
			))}
		</div>
	)
}

function computeInside(grid: State[][]): State[][] {
	const next = makeGrid(State.INSIDE)

	// copy walls, list entry points
	const queue: [number, number][] = []
	for (let y = 0; y < SIDE; y++) {
		for (let x = 0; x < SIDE; x++) {
			if (grid[y][x] === State.ON) {
				next[y][x] = grid[y][x]
			} else if (y === 0 || x === 0 || y === SIDE - 1 || x === SIDE - 1) {
				next[y][x] = State.OFF
				queue.push([x, y])
			}
		}
	}

	// flood fill
	const neighbors = [
		[-1, 0],
		[1, 0],
		[0, -1],
		[0, 1],
	]
	while (queue.length) {
		const [x, y] = queue.shift()!
		for (const [dx, dy] of neighbors) {
			const nx = x + dx
			const ny = y + dy
			if (nx < 0 || nx >= SIDE || ny < 0 || ny >= SIDE) continue
			if (grid[ny][nx] !== State.OFF) continue
			if (next[ny][nx] === State.OFF) continue
			next[ny][nx] = State.OFF
			queue.push([nx, ny])
		}
	}

	return next
}

function counts(grid: State[][]): Record<State, number> {
	const result = {
		[State.OFF]: 0,
		[State.ON]: 0,
		[State.INSIDE]: 0,
	}
	for (const row of grid) {
		for (const cell of row) {
			result[cell]++
		}
	}
	return result
}

const details = {
	total: {
		title: 'Total gains',
		subtitle: 'Total earnings from all fields after N turns.',
		formula: (
			<mrow>
				<mi>f</mi>
				<mo fence>{'('}</mo>
				<mrow>
					<mi>n</mi>
				</mrow>
				<mo fence>{')'}</mo>
				<mo>=</mo>
				<mi>fields</mi>
				<mo>×</mo>
				<mn>10</mn>
				<mo>×</mo>
				<mi>n</mi>
				<mo>-</mo>
				<mi>cost</mi>
			</mrow>
		)
	},
	totalSell: {
		title: 'Total after sale',
		subtitle: 'Total earnings from all fields after N turns,\nafter having sold the farms.',
		formula: (
			<mrow>
				<mi>f</mi>
				<mo fence>{'('}</mo>
				<mrow>
					<mi>n</mi>
				</mrow>
				<mo fence>{')'}</mo>
				<mo>=</mo>
				<mi>fields</mi>
				<mo>×</mo>
				<mn>10</mn>
				<mo>×</mo>
				<mi>n</mi>
				<mo>-</mo>
				<mi>cost</mi>
				<mo>/</mo>
				<mn>2</mn>
			</mrow>
		)
	},
	both: {
		title: 'Both',
		subtitle: 'Total earnings from all fields after N turns,\nearnings are accumulated in the bank and not spent.\nGains are only realized at the end.',
		formula: (
			<mrow>
				<mi>f</mi>
				<mo fence>{'('}</mo>
				<mrow>
					<mi>n</mi>
				</mrow>
				<mo fence>{')'}</mo>
				<mo>=</mo>
				<mi>fields</mi>
				<mo>×</mo>
				<mn>10</mn>
				<mo>+</mo>
				<mi>f</mi>
				<mo fence>{'('}</mo>
				<mrow>
					<mi>n</mi>
					<mo>-</mo>
					<mn>1</mn>
				</mrow>
				<mo fence>{')'}</mo>
				<mo>×</mo>
				<mn>1.2</mn>
			</mrow>
		)
	},
	bank: {
		title: 'Bank',
		subtitle: 'Initial cost of the farms is kept frozen in the bank instead,\nsurplus is spent every turn.',
		formula: (
			<mrow>
				<mi>f</mi>
				<mo fence>{'('}</mo>
				<mrow>
					<mi>n</mi>
				</mrow>
				<mo fence>{')'}</mo>
				<mo>=</mo>
				<mi>cost</mi>
				<mo>×</mo>
				<mn>0.2</mn>
				<mo>×</mo>
				<mi>n</mi>
			</mrow>
		)
	},
	bankCompound: {
		title: 'Bank (accumulate)',
		subtitle: 'Initial cost of the farms is kept in the bank,\nearnings accumulate every turn and are not spent.\nGains are only realized at the end.',
		formula: (
			<mrow>
				<mi>f</mi>
				<mo fence>{'('}</mo>
				<mrow>
					<mi>n</mi>
				</mrow>
				<mo fence>{')'}</mo>
				<mo>=</mo>
				<mi>cost</mi>
				<mo>×</mo>
				<mo fence>{'('}</mo>
				<mrow>
					<msup>
						<mn>1.2</mn>
						<mi>n</mi>
					</msup>
					<mo>-</mo>
					<mn>1</mn>
				</mrow>
				<mo fence>{')'}</mo>
			</mrow>
		)
	}
} as const


declare global {
	namespace JSX {
		interface IntrinsicElements {
			math: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { display?: 'block' | 'inline' }, HTMLElement>
			mrow: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
			mi: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
			mn: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
			mo: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { fence?: boolean }, HTMLElement>
			msup: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
			munderover: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
		}
	}
}