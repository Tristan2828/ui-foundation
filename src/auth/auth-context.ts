import { createContext } from 'react'

export type AuthUser = {
  id: string
  name: string
  email: string
}

export type AuthContextValue = {
  user: AuthUser
}

// Hardcoded fake user (see docs/BUILD-PLAN.md "Auth Boundary"). A real
// mechanism (session cookies, JWT, or a managed provider) is chosen once
// the backend is, in Phase 8.
export const FAKE_USER: AuthUser = {
  id: 'user_1',
  name: 'Alex Rivera',
  email: 'alex@example.com',
}

export const AuthContext = createContext<AuthContextValue>({ user: FAKE_USER })
