import { useContext } from 'react'
import { AuthContext } from './auth-context'

// Re-exported so the app root can mount the provider without importing
// auth-provider.tsx directly — this file is the one boundary everything
// else, including main.tsx, is allowed to import auth from.
export { AuthProvider } from './auth-provider'

export function useAuth() {
  return useContext(AuthContext)
}
