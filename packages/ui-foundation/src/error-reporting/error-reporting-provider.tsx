// The React side of error reporting (./reporter.ts): FoundationProviders
// mounts this inside AuthProvider when `errorReporting` is on. Off, there's
// no provider, the context is null, and nothing here runs.
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { reportClientError } from '@/api/gateway/client-errors'
import { useAuth } from '@/auth/use-auth'
import { ErrorReportingContext, useRoutePattern } from './error-reporting-context'
import { createErrorReporter, type ErrorReporter, type ErrorReportingOptions } from './reporter'

export function ErrorReportingProvider({ options, children }: { options: ErrorReportingOptions; children: ReactNode }) {
  const queryClient = useQueryClient()
  const { status } = useAuth()
  const [reporter] = useState(() => createErrorReporter({ options, send: (report) => void reportClientError(report) }))
  useEffect(() => reporter.setSignedIn(status === 'authenticated'), [reporter, status])
  useEffect(() => reporter.install(queryClient, window), [reporter, queryClient])
  return <ErrorReportingContext.Provider value={reporter}>{children}</ErrorReportingContext.Provider>
}

/**
 * Keeps the reporter's route current, for reports that don't know theirs.
 * AppShell renders it only while reporting is on: the router's matches
 * need a data router (createBrowserRouter), which reporting then needs too.
 */
export function ReportRoutePattern({ reporter }: { reporter: ErrorReporter }): null {
  const pattern = useRoutePattern()
  useEffect(() => reporter.setRoute(pattern), [reporter, pattern])
  return null
}
