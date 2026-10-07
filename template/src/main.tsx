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

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <FoundationProviders mockMode={IS_MOCK_MODE}>
        {/* Above the router, so it shows on every route: the backend's
            DATA_LABEL when its data isn't production's (backend/.env). */}
        <DataEnvironmentBanner />
        <App />
      </FoundationProviders>
    </StrictMode>,
  )
})
