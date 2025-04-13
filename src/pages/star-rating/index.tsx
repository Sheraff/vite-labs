import type { RouteMeta } from "~/router"
import styles from './styles.module.css'
import { Head } from "~/components/Head"
import { useState, type ChangeEventHandler, type CSSProperties, type PointerEventHandler } from "react"

export const meta: RouteMeta = {
	title: 'Star Rating',
	image: './screen.png'
}

export default function StarRatingPage() {
	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<hr />
			<StarsInput name="rating" label="Rate the product" />
		</div>
	)
}

const mdiStar = "M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z"
const img = `url('data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="${mdiStar}"/></svg>`)}')`

const StarsInput = ({ name, label }: { name: string, label: string }) => {
	const [value, setValue] = useState(0)
	const onChange: ChangeEventHandler<HTMLInputElement> = (e) => setValue(Number(e.target.value))
	const onPointerUp: PointerEventHandler<HTMLInputElement> = (e) => setValue(Number(e.currentTarget.value))
	return (
		<fieldset
			className={styles.stars}
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