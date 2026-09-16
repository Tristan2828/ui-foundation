import type { ReactNode } from 'react'
import { AuthContext, FAKE_USER } from './auth-context'

// This is the only file that knows how auth works — everything else
// consumes useAuth() from ./use-auth. See docs/BUILD-PLAN.md "Auth Boundary".
export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={{ user: FAKE_USER }}>{children}</AuthContext.Provider>
}
