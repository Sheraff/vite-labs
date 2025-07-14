/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ComponentPropsWithoutRef, type ReactNode } from "react"
import { ROUTES, type Routes } from "../router"
import { flushSync } from "react-dom"


type NavigationEvent = {
	canIntercept: boolean
	destination: {
		url: string
	}
	intercept: (options: {
		handler: () => void
	}) => void
}

declare global {
	interface Window {
		navigation: {
			addEventListener: (type: "navigate", listener: (event: NavigationEvent) => void) => void
			removeEventListener: (type: "navigate", listener: (event: NavigationEvent) => void) => void
			canGoBack: boolean
			back: () => {
				committed: Promise<void>
				finished: Promise<void>
			}
		}
	}
	interface Document {
		startViewTransition(callback: () => void): void
	}
}

function parseUrl(href: string) {
	const url = new URL(href)
	if (!url.pathname.startsWith(import.meta.env.BASE_URL)) return null
	let key = url.pathname.slice(import.meta.env.BASE_URL.length)
	if (key.endsWith("/")) key = key.slice(0, -1)
	if (key in ROUTES) {
		return key as Routes
	}
	return null
}

const NavigationContext = createContext<Routes | null>(null)

export function NavigationProvider({ children }: { children: ReactNode }) {
	const [route, setRoute] = useState<Routes | null>(() => parseUrl(window.location.href))
	useEffect(() => {
		const onNavigate = (event: NavigationEvent) => {
			if (!event.canIntercept) return
			const next = new URL(event.destination.url)
			if (next.pathname === location.pathname) return
			const key = parseUrl(event.destination.url)
			event.intercept({
				handler() {
					document.startViewTransition(() => flushSync(() => setRoute(key)))
				}
			})
		}
		window.navigation.addEventListener("navigate", onNavigate)
		return () => {
			window.navigation.removeEventListener("navigate", onNavigate)
		}
	}, [])
	return (
		<NavigationContext.Provider value={route}>
			{children}
		</NavigationContext.Provider>
	)
}

export function useNavigation() {
	return useContext(NavigationContext)
}

export function Link({ href, ...props }: Omit<ComponentPropsWithoutRef<"a">, "href"> & { href: `/${Routes}` | '/' }) {
	return <a {...props} href={import.meta.env.BASE_URL + href.slice(1)} />
}