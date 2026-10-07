import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// Only reached when VITE_API=real (src/main.tsx skips MSW in that mode) —
// forwards /api to the FastAPI backend (Phase 8) started separately via
// `uvicorn app.main:app` from backend/. MSW intercepts requests before they
// reach the network otherwise, so this proxy is inert the rest of the time.
const BACKEND_URL = 'http://localhost:8000'

// Not Vite's defaults (5173, 4173): another Vite app on the same machine
// is likely on those, and Playwright reuses whatever answers on the test
// port (playwright.config.ts). strictPort: a busy port is an error, not a
// silent move to the next one. Another port for one run:
// `npm run dev -- --port 5181`.
const DEV_PORT = 5180
const PREVIEW_PORT = 4180

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: DEV_PORT,
    strictPort: true,
    proxy: { '/api': BACKEND_URL },
  },
  preview: {
    port: PREVIEW_PORT,
    strictPort: true,
    proxy: { '/api': BACKEND_URL },
  },
})
