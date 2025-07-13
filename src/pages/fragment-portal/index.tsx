import { useEffect, useRef, useState } from "react"
import { useFragment, Receptacle, Portal, type FragmentPortal } from './FragmentPortal'
import styles from './styles.module.css'
import { Head } from "~/components/Head"

export const meta = {
	title: 'Fragment Portal',
	tags: ['react']
}

export default function () {
	const fragment = useFragment('div')

	return (
		<div className={styles.main}>
			<Head />
			<Slots fragment={fragment} />
			<LiveComponents fragment={fragment} />
		</div>
	)
}

function LiveComponents({ fragment }: { fragment: FragmentPortal }) {
	const [, rerender] = useState({})
	const i = useRef(0).current++
	return (
		<Portal fragment={fragment}>
			<button onClick={() => rerender({})}>rerender: {i}</button>
			<Video />
			<Timer />
			<input type="text" />
		</Portal>
	)
}


function Slots({ fragment }: { fragment: FragmentPortal }) {
	const [side, setSide] = useState([0, 0])
	const onClick = () => {
		// pick a random receptacle to display the `fragment` in
		setSide(([_i, _j]) => {
			let i, j
			do {
				i = Math.floor(Math.random() * 2)
				j = Math.floor(Math.random() * 3)
			} while (i === _i && j === _j)
			return [i, j]
		})
	}
	return (
		<>
			<button onClick={onClick}>
				move somewhere else in DOM
			</button>
			<ul className={styles.grid}>
				{/* make many receptacles */}
				{[0, 1].map((i) => (
					[0, 1, 2].map((j) => (
						<li key={i + '-' + j}>
							<Receptacle
								fragment={(side[0] === i && side[1] === j) ? fragment : undefined}
								props={{ label: `${j + 1}x${i + 1}` }}
							/>
						</li>
					))
				))}
			</ul>
		</>
	)
}

function Video({ label }: { label?: string }) {
	const i = useRef(0).current++
	return (
		<>
			<video width="320" height="240" controls loop muted autoPlay playsInline crossOrigin="anonymous" >
				<source
					src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"
					type="video/mp4"
				/>
			</video>
			<div>
				renders: {i}, parent: {label}
			</div>
		</>
	)
}

function Timer({ label }: { label?: string }) {
	const [time, setTime] = useState(0)
	useEffect(() => {
		const id = setInterval(() => setTime((t) => t + 1), 1000)
		return () => clearInterval(id)
	}, [])
	const i = useRef(0).current++
	return (
		<p>
			{time}s since mounted, renders: {i}, parent: {label}
		</p>
	)
}