import type { Routes } from "#router"

import { createContext, useContext } from "react"

export const NavigationContext = createContext<Routes | null>(null)

export function useNavigation() {
	return useContext(NavigationContext)
}
