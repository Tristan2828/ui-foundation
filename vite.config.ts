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

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: { '/api': BACKEND_URL },
  },
  preview: {
    proxy: { '/api': BACKEND_URL },
  },
})
