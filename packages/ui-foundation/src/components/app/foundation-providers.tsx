import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { createQueryClient } from '@/api/query-client'
import { AuthProvider } from '@/auth/use-auth'
import { MockModeBanner } from '@/components/app/mock-mode-banner'
import { ThemeProvider } from '@/components/theme-provider'
import { ErrorReportingProvider } from '@/error-reporting/error-reporting-provider'
import { resolveErrorReporting, type ErrorReportingOptions } from '@/error-reporting/reporter'
import { browserStaleChunkReload } from '@/lib/stale-chunk-reload'

// Everything an app's root needs around its router, in the order that
// works: the theme outermost, the mock-mode banner above the router so it
// shows on every route (/login included), and AuthProvider inside
// QueryClientProvider because it queries /auth/me through TanStack Query.
// An app's DataEnvironmentBanner goes first among the children, before its
// router: it queries too, and shows on every route like the mock banner.
// It also reloads the page once when a lazy chunk is gone after a deploy
// (lib/stale-chunk-reload.ts), so no app adds its own listener.
export function FoundationProviders({
  mockMode,
  queryClient,
  errorReporting,
  children,
}: {
  /** Whether the API is served by MSW — the app's own IS_MOCK_MODE. */
  mockMode: boolean
  /** Defaults to createQueryClient(); pass one to share it with code outside React. */
  queryClient?: QueryClient
  /**
   * Off by default. On, crashes, uncaught errors and server failures are
   * posted to the app's own POST /api/client-errors (while signed in),
   * which forwards them; see docs/deploy.md "Error reporting" for what a
   * report holds and never holds. `{ release }` names the build.
   */
  errorReporting?: boolean | ErrorReportingOptions
  children: ReactNode
}) {
  const [client] = useState(() => queryClient ?? createQueryClient())
  const reporting = resolveErrorReporting(errorReporting)
  useEffect(() => browserStaleChunkReload().install(window), [])
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <MockModeBanner active={mockMode} />
      <QueryClientProvider client={client}>
        <AuthProvider>
          {reporting ? <ErrorReportingProvider options={reporting}>{children}</ErrorReportingProvider> : children}
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
