/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ComponentPropsWithoutRef } from "react"
import { ROUTES, type Routes } from "./router"


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
		}
	}
}

function parseUrl(href: string) {
	const url = new URL(href)
	const key = url.pathname.slice(1)
	if (key in ROUTES) {
		return key as Routes
	}
	return null
}

const NavigationContext = createContext<Routes | null>(null)

export function NavigationProvider({ children }: { children: React.ReactNode }) {
	const [route, setRoute] = useState<Routes | null>(() => parseUrl(window.location.href))
	useEffect(() => {
		const onNavigate = (event: NavigationEvent) => {
			if (!event.canIntercept) return
			const key = parseUrl(event.destination.url)
			event.intercept({
				handler() {
					setRoute(key)
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

export function Link(props: Omit<ComponentPropsWithoutRef<"a">, "href"> & { href: `/${Routes}` | '/' }) {
	return <a {...props} />
}