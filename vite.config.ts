import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import viteTsconfigPaths from 'vite-tsconfig-paths'
import { fileRouter } from './scripts/file-router'


// https://vitejs.dev/config/
export default defineConfig(async () => {
	return ({
		plugins: [react(), fileRouter(), viteTsconfigPaths()],
		clearScreen: false,
		base: '/vite-labs/',
		build: {
			target: 'esnext',
		}
	})
})
