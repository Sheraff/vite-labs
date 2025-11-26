/* eslint-disable react/no-unknown-property */
import styles from './styles.module.css'
import { Head } from "#components/Head"
import type { RouteMeta } from "#router"

export const meta: RouteMeta = {
	title: 'Silky Modal',
	tags: ['css', 'wip']
}

declare module 'react' {
	interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {
		commandfor?: string
		command?: 'show-modal' | 'close' | 'toggle-popover' | 'hide-popover'
	}
}

export default function SilkyModalPage() {
	return (
		<div className={styles.main}>
			<Head />
			<button commandfor="mydialog" command="show-modal">Show modal dialog</button>
			<dialog id="mydialog" ref={(e) => {
				if (!e) return
				const content = e.querySelector<HTMLDivElement>('[data-dialog-content]')!
				const observer = new IntersectionObserver(([entry]) => !entry.isIntersecting && e.close())
				observer.observe(content)
				return () => observer.disconnect()
			}}>
				<div data-dialog-bumper="top" />
				<div data-dialog-content>
					<button commandfor="mydialog" command="close">Close</button>
					<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam scelerisque aliquam odio et faucibus.</p>
					<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam scelerisque aliquam odio et faucibus.</p>
					<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam scelerisque aliquam odio et faucibus.</p>
					<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam scelerisque aliquam odio et faucibus.</p>
					<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam scelerisque aliquam odio et faucibus.</p>
					<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam scelerisque aliquam odio et faucibus.</p>
					<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam scelerisque aliquam odio et faucibus.</p>
					<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam scelerisque aliquam odio et faucibus.</p>
					<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam scelerisque aliquam odio et faucibus.</p>
					<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam scelerisque aliquam odio et faucibus.</p>
					<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam scelerisque aliquam odio et faucibus.</p>
					<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam scelerisque aliquam odio et faucibus.</p>
					<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam scelerisque aliquam odio et faucibus.</p>
					<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam scelerisque aliquam odio et faucibus.</p>
					<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam scelerisque aliquam odio et faucibus.</p>
					<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam scelerisque aliquam odio et faucibus.</p>
					<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam scelerisque aliquam odio et faucibus.</p>
					<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam scelerisque aliquam odio et faucibus.</p>
				</div>
				<div data-dialog-bumper="bottom" />
			</dialog>
		</div>
	)
}