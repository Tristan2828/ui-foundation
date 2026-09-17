import { createContext } from 'react'

export type AuthUser = {
  id: number
  name: string
  email: string
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

// Real session-cookie auth as of Phase 10 (docs/BUILD-PLAN.md) — the
// previous hardcoded FAKE_USER stub is gone. auth-provider.tsx is still the
// only file that knows how any of this works; see AGENTS.md's hard rule.
export const AuthContext = createContext<AuthContextValue>({
  user: null,
  status: 'loading',
  login: async () => {},
  logout: async () => {},
})
