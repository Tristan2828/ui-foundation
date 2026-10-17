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

/**
 * Where a sign-in stands after `login` or `submitTotp`:
 * - `signed-in`: the session started.
 * - `totp`: the password was right; the account wants a code next
 *   (`submitTotp`), and no session exists yet.
 * - `restart`: the sign-in waiting for its code is gone (it expired, or
 *   ran out of tries); start again from the password. `message` says why.
 * Anything else (a wrong password or code, too many attempts, the server
 * down) rejects with an AppError.
 */
export type SignInResult = { status: 'signed-in' } | { status: 'totp' } | { status: 'restart'; message: string }

export type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  /** Why the session check failed; set only when status is 'unavailable'. */
  error: AppError | null
  /** Re-runs the session check (the 'unavailable' state's retry). */
  retry: () => void
  login: (email: string, password: string) => Promise<SignInResult>
  /** The second step, after `login` answered `totp`: an authenticator code or a recovery code. */
  submitTotp: (code: string) => Promise<SignInResult>
  logout: () => Promise<void>
  register: (email: string, name: string, password: string) => Promise<void>
}

// Session-cookie auth against the backend. auth-provider.tsx is the only
// file that knows how any of this works; see AGENTS.md's hard rule.
export const AuthContext = createContext<AuthContextValue>({
  user: null,
  status: 'loading',
  error: null,
  retry: () => {},
  login: async () => ({ status: 'signed-in' }),
  submitTotp: async () => ({ status: 'signed-in' }),
  logout: async () => {},
  register: async () => {},
})
