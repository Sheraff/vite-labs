import type { ComponentPropsWithoutRef } from "react"

const state = Symbol('state')
const value = Symbol('value')

export function Image({ src, ...props }: Omit<ComponentPropsWithoutRef<'img'>, 'src'> & {
	src: Promise<string> & (
		| {
			[state]?: 'pending'
			[value]?: undefined
		}
		| {
			[state]?: 'fulfilled'
			[value]?: string
		}
		| {
			[state]?: 'rejected'
			[value]?: Error
		}
	) | string
}) {
	if (typeof src === 'string') return <img src={src} {...props} />
	if (!src[state]) {
		src[state] = 'pending'
		src.then(url => {
			src[state] = 'fulfilled'
			src[value] = url
		})
		src.catch((err) => {
			src[state] = 'rejected'
			src[value] = err
		})
	}
	if (src[state] === 'pending') throw src
	if (src[state] === 'rejected') throw src[value]
	if (src[state] === 'fulfilled') return <img src={src[value]} {...props} />
	return null
}