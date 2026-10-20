import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DataEnvironmentBanner, FoundationProviders } from '@tristan2828/ui-foundation'
import { IS_MOCK_MODE } from '@/lib/mock-mode'
import './index.css'
import App from './App.tsx'

// MSW serves the whole API contract until the app runs against a real
// backend (VITE_API=real). Enabled by default, including in the Playwright
// preview build, so there is no backend process to run before then.
async function enableMocking() {
  // The literal check, not IS_MOCK_MODE: the bundler folds
  // `import.meta.env.VITE_API` to a constant only where it is written, so
  // only this form lets `build:real` drop MSW entirely. Behind an imported
  // constant the dynamic imports below survive and MSW ships to production.
  if (import.meta.env.VITE_API === 'real') return
  swapBlockedLocalStorage()
  const { worker } = await import('./mocks/browser')
  // start() before exposeMswForE2E(): worker.start() resets the runtime
  // handler list to the ones setupWorker() was configured with, so a
  // worker.use() override registered before start() gets silently
  // discarded rather than applied. React doesn't render (and so doesn't
  // issue its first fetch) until this whole function's returned promise
  // resolves, so applying the override after start() is still safely
  // ahead of any app code.
  await worker.start({ onUnhandledRequest: 'bypass' })
  const { exposeMswForE2E } = await import('@tristan2828/ui-foundation/mocks')
  exposeMswForE2E(worker)
}

// Mock mode only. MSW's cookie store calls localStorage.getItem unguarded
// when its module loads, so where the browser blocks storage (a private
// window with site data blocked, or every Storage call throwing) the import
// above throws and the app never renders. An in-memory localStorage keeps
// the mocks running for the page's life. Not for the real build: there the
// package's own storage reads already fall back on their own.
function swapBlockedLocalStorage() {
  try {
    const probe = '__storage_probe__'
    window.localStorage.setItem(probe, probe)
    window.localStorage.removeItem(probe)
    return
  } catch {
    // Blocked: replace it below.
  }
  const items = new Map<string, string>()
  const memory = {
    get length() {
      return items.size
    },
    key: (index: number) => [...items.keys()][index] ?? null,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, String(value)),
    removeItem: (key: string) => void items.delete(key),
    clear: () => items.clear(),
  }
  Object.defineProperty(window, 'localStorage', { value: memory, configurable: true })
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {/* errorReporting: crashes and server failures go to the backend's
          POST /api/client-errors, which forwards them when
          ERROR_REPORTING_DSN is set (docs/deploy.md "Error reporting").
          VITE_RELEASE names the build, e.g. the commit, set at build time. */}
      <FoundationProviders mockMode={IS_MOCK_MODE} errorReporting={{ release: import.meta.env.VITE_RELEASE }}>
        {/* Above the router, so it shows on every route: the backend's
            DATA_LABEL when its data isn't production's (backend/.env). */}
        <DataEnvironmentBanner />
        <App />
      </FoundationProviders>
    </StrictMode>,
  )
})
