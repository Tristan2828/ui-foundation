import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/auth/use-auth'
import { ThemeProvider } from '@/components/theme-provider'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient()

// MSW serves the whole API contract until a real backend exists (Phase 8
// swaps this for VITE_API=real against a running backend — see
// docs/BUILD-PLAN.md Phase 8 and "Backend Decoupling"). Enabled by default,
// including in the Playwright preview build, so there is no backend process
// to run before then.
async function enableMocking() {
  if (import.meta.env.VITE_API === 'real') return
  const { worker } = await import('./mocks/browser')
  return worker.start({ onUnhandledRequest: 'bypass' })
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </AuthProvider>
      </ThemeProvider>
    </StrictMode>,
  )
})
