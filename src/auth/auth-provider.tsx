import type { ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppError } from '@/api/contracts'
import { getCurrentUser, login as loginRequest, logout as logoutRequest } from '@/api/gateway/auth'
import { AuthContext, type AuthStatus, type AuthUser } from './auth-context'

// TanStack Query, not useEffect — AGENTS.md's "NEVER fetch in useEffect"
// rule applies here too. A 401 here just means "not logged in", which the
// global QueryClient retry policy (api/query-client.ts) already treats as
// final rather than retrying.
const AUTH_QUERY_KEY = ['auth', 'me'] as const

// This is the only file that knows how auth works — everything else
// consumes useAuth() from ./use-auth. See docs/BUILD-PLAN.md "Auth
// Boundary" and its Phase 10 (session cookies against the real backend).
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const {
    data: user,
    isLoading,
    isError,
  } = useQuery<AuthUser, AppError>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: getCurrentUser,
  })

  const status: AuthStatus = isLoading ? 'loading' : isError || !user ? 'unauthenticated' : 'authenticated'

  async function login(email: string, password: string) {
    const loggedInUser = await loginRequest({ email, password })
    queryClient.setQueryData(AUTH_QUERY_KEY, loggedInUser)
  }

  async function logout() {
    await logoutRequest()
    queryClient.setQueryData(AUTH_QUERY_KEY, null)
  }

  return (
    <AuthContext.Provider value={{ user: user ?? null, status, login, logout }}>{children}</AuthContext.Provider>
  )
}
