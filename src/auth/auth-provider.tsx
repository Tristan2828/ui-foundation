import { useEffect, type ReactNode } from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { AppError } from '@/api/contracts'
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from '@/api/gateway/auth'
import { AuthContext, type AuthStatus, type AuthUser } from './auth-context'

// TanStack Query, not useEffect — AGENTS.md's "NEVER fetch in useEffect"
// rule applies here too. A 401 here just means "not logged in", which the
// global QueryClient retry policy (api/query-client.ts) already treats as
// final rather than retrying.
const AUTH_QUERY_KEY = ['auth', 'me'] as const

function isAuthError(error: unknown): boolean {
  return (error as AppError | null)?.kind === 'auth'
}

// Every cached query except the session itself belongs to whoever was
// logged in when it ran. Dropped on every session change so the next user
// never sees the previous user's rows — widgets are per-user on the
// backend. `removeQueries` with a predicate, not `clear()`: clear() would
// also drop the auth query this provider's own useQuery observes, and that
// observer wouldn't pick up the replacement setQueryData creates.
function removeUserScopedQueries(queryClient: QueryClient) {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== AUTH_QUERY_KEY[0] })
}

function startSession(queryClient: QueryClient, user: AuthUser) {
  removeUserScopedQueries(queryClient)
  queryClient.setQueryData(AUTH_QUERY_KEY, user)
}

function endSession(queryClient: QueryClient) {
  removeUserScopedQueries(queryClient)
  queryClient.setQueryData(AUTH_QUERY_KEY, null)
}

// This is the only file that knows how auth works — everything else
// consumes useAuth() from ./use-auth. See docs/BUILD-PLAN.md "Auth
// Boundary" and its Phase 10 (session cookies against the real backend).
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const {
    data: user,
    error,
    isLoading,
    refetch,
  } = useQuery<AuthUser | null, AppError>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: getCurrentUser,
  })

  // A session can expire while the app is open: the next request for any
  // other resource comes back 401. End the session here, once, rather than
  // leaving each screen to show a "Not authorized" error inside a shell
  // that still thinks it's logged in — AppShell then redirects to /login.
  // A subscription, not a fetch; the auth query's own 401 is excluded (it
  // is already the "logged out" signal).
  useEffect(() => {
    const onError = (error: unknown) => {
      // Deferred: mutating the cache from inside its own notify callback
      // would re-enter the cache mid-dispatch.
      if (isAuthError(error)) queueMicrotask(() => endSession(queryClient))
    }
    const unsubscribeQueries = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === 'updated' &&
        event.action.type === 'error' &&
        event.query.queryKey[0] !== AUTH_QUERY_KEY[0]
      ) {
        onError(event.action.error)
      }
    })
    const unsubscribeMutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'error') {
        onError(event.action.error)
      }
    })
    return () => {
      unsubscribeQueries()
      unsubscribeMutations()
    }
  }, [queryClient])

  // A 401 always means logged out, even if a user was cached from before
  // (a background refetch of /auth/me after the session expired). Any other
  // failure with no user is 'unavailable', not logged out.
  const status: AuthStatus = isLoading
    ? 'loading'
    : isAuthError(error)
      ? 'unauthenticated'
      : user
        ? 'authenticated'
        : error
          ? 'unavailable'
          : 'unauthenticated'

  async function login(email: string, password: string) {
    startSession(queryClient, await loginRequest({ email, password }))
  }

  async function logout() {
    await logoutRequest()
    endSession(queryClient)
  }

  async function register(email: string, name: string, password: string) {
    startSession(queryClient, await registerRequest({ email, name, password }))
  }

  return (
    <AuthContext.Provider
      value={{
        user: status === 'authenticated' ? (user ?? null) : null,
        status,
        error: status === 'unavailable' ? error : null,
        retry: () => void refetch(),
        login,
        logout,
        register,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
