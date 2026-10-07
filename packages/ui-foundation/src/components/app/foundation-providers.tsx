import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { createQueryClient } from '@/api/query-client'
import { AuthProvider } from '@/auth/use-auth'
import { MockModeBanner } from '@/components/app/mock-mode-banner'
import { ThemeProvider } from '@/components/theme-provider'

// Everything an app's root needs around its router, in the order that
// works: the theme outermost, the mock-mode banner above the router so it
// shows on every route (/login included), and AuthProvider inside
// QueryClientProvider because it queries /auth/me through TanStack Query.
// An app's DataEnvironmentBanner goes first among the children, before its
// router: it queries too, and shows on every route like the mock banner.
export function FoundationProviders({
  mockMode,
  queryClient,
  children,
}: {
  /** Whether the API is served by MSW — the app's own IS_MOCK_MODE. */
  mockMode: boolean
  /** Defaults to createQueryClient(); pass one to share it with code outside React. */
  queryClient?: QueryClient
  children: ReactNode
}) {
  const [client] = useState(() => queryClient ?? createQueryClient())
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <MockModeBanner active={mockMode} />
      <QueryClientProvider client={client}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
