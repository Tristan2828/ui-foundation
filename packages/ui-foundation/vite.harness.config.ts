import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const harness = path.resolve(dirname, 'e2e/harness')

// The fixtures harness (e2e/harness/): an index page and one page per
// fixture, built from source and served by `vite preview` for the browser
// tests (playwright.harness.config.ts), or by `npm run harness` to browse.
export default defineConfig({
  root: harness,
  publicDir: path.resolve(harness, 'public'),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(dirname, 'src') } },
  build: {
    outDir: path.resolve(dirname, 'harness-dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(harness, 'index.html'),
        story: path.resolve(harness, 'story.html'),
      },
    },
  },
  preview: { port: 6180, strictPort: true },
  server: { port: 6180, strictPort: true },
})
