import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '@/api/query-client'
import { AuthProvider } from '@/auth/use-auth'
import { ThemeProvider } from '@/components/theme-provider'
import './index.css'
import App from './App.tsx'

const queryClient = createQueryClient()

// MSW serves the whole API contract until a real backend exists (Phase 8
// swaps this for VITE_API=real against a running backend — see
// docs/BUILD-PLAN.md Phase 8 and "Backend Decoupling"). Enabled by default,
// including in the Playwright preview build, so there is no backend process
// to run before then.
async function enableMocking() {
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
  const { exposeMswForE2E } = await import('./mocks/e2e-hooks')
  exposeMswForE2E()
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <QueryClientProvider client={queryClient}>
          {/* AuthProvider queries /auth/me via TanStack Query (Phase 10),
              so it must sit inside QueryClientProvider, not outside it. */}
          <AuthProvider>
            <App />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </StrictMode>,
  )
})
