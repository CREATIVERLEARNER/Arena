import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Host is enabled so the dev server is reachable from the sandbox preview.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // allow the sandbox preview proxy host (dev convenience only)
    allowedHosts: ['.e2b.app'],
  },
})
