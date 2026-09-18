import { createContext } from 'react'
import type { AppError } from '@/api/contracts'

export type AuthUser = {
  id: number
  name: string
  email: string
}

// 'unavailable' means the session check itself failed (network/server
// error on /auth/me) — not "logged out". Showing /login for a backend
// outage would send a logged-in user to a form that can't work either.
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'unavailable'

export type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  /** Why the session check failed; set only when status is 'unavailable'. */
  error: AppError | null
  /** Re-runs the session check (the 'unavailable' state's retry). */
  retry: () => void
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (email: string, name: string, password: string) => Promise<void>
}

// Real session-cookie auth as of Phase 10 (docs/BUILD-PLAN.md) — the
// previous hardcoded FAKE_USER stub is gone. auth-provider.tsx is still the
// only file that knows how any of this works; see AGENTS.md's hard rule.
// register() added in Phase 11 (self-service registration).
export const AuthContext = createContext<AuthContextValue>({
  user: null,
  status: 'loading',
  error: null,
  retry: () => {},
  login: async () => {},
  logout: async () => {},
  register: async () => {},
})
