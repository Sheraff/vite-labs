import type { RouteMeta } from "#router"
import styles from './styles.module.css'
import { Head } from "#components/Head"
import { useState, type ChangeEventHandler, type CSSProperties, type PointerEventHandler } from "react"

export const meta: RouteMeta = {
	title: 'Star Rating',
	image: './screen.png',
	tags: ['html', 'components']
}

export default function StarRatingPage() {
	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<hr />
			<RadioStarsInput name="rating" label="Radio button based" />
			<hr />
			<RangeStarsInput name="rating" label="Range input based" />
		</div>
	)
}

const mdiStar = "M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z"
const img = `url('data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="${mdiStar}"/></svg>`)}')`

const RadioStarsInput = ({ name, label }: { name: string, label: string }) => {
	const [value, setValue] = useState(1)
	const onChange: ChangeEventHandler<HTMLInputElement> = (e) => setValue(Number(e.target.value))
	const onPointerUp: PointerEventHandler<HTMLInputElement> = (e) => setValue(Number(e.currentTarget.value))
	return (
		<fieldset
			className={styles.radio}
			style={{ '--svg-bg-image': img } as CSSProperties}
		>
			<legend>{label}</legend>
			<input type="radio" name={name} value="1" checked={value === 1} onChange={onChange} onPointerUp={onPointerUp} />
			<input type="radio" name={name} value="2" checked={value === 2} onChange={onChange} onPointerUp={onPointerUp} />
			<input type="radio" name={name} value="3" checked={value === 3} onChange={onChange} onPointerUp={onPointerUp} />
			<input type="radio" name={name} value="4" checked={value === 4} onChange={onChange} onPointerUp={onPointerUp} />
			<input type="radio" name={name} value="5" checked={value === 5} onChange={onChange} onPointerUp={onPointerUp} />
		</fieldset>
	)
}

const RangeStarsInput = ({ name, label }: { name: string, label: string }) => {
	const [value, setValue] = useState(1)
	const step = 0.5
	const min = step
	const max = 5
	const onChange: ChangeEventHandler<HTMLInputElement> = (e) => setValue(Number(e.target.value))
	return (
		<div
			className={styles.range}
			style={{ '--svg-bg-image': img, '--value': value, '--max': max, '--min': min, '--step': step } as CSSProperties}
		>
			<label htmlFor="range">{label}</label>
			<input
				id="range"
				type="range"
				name={name}
				min={min}
				max={max}
				step={step}
				onChange={onChange}
				value={value}
			/>
		</div>
	)
}