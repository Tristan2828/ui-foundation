import { createContext, useContext } from 'react'
import { useMatches } from 'react-router'
import { routePattern, type ErrorReporter } from './reporter'

// Null unless FoundationProviders' errorReporting is on
// (./error-reporting-provider.tsx), so every use of it does nothing then.
export const ErrorReportingContext = createContext<ErrorReporter | null>(null)

/** The reporter, or null when the app hasn't turned reporting on. */
export function useErrorReporter(): ErrorReporter | null {
  return useContext(ErrorReportingContext)
}

/** The current route's pattern (`/widgets/:id`), from a data router's matches. */
export function useRoutePattern(): string | null {
  const matches = useMatches()
  const last = matches[matches.length - 1]
  return last ? routePattern(last.pathname, last.params) : null
}
