import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

import { fileRouter } from "./scripts/file-router"

// https://vitejs.dev/config/
export default defineConfig(async () => {
	return {
		plugins: [react(), fileRouter()],
		clearScreen: false,
		base: "/vite-labs/",
		server: {
			headers: {
				"Cross-Origin-Opener-Policy": "same-origin",
				"Cross-Origin-Embedder-Policy": "require-corp",
			},
		},
		build: {
			target: "esnext",
		},
	}
})
