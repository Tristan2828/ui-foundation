import { TriangleAlertIcon } from 'lucide-react'
import { useEffect } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router'
import { useErrorReporter, useRoutePattern } from '@/error-reporting/error-reporting-context'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

export function RouteErrorBoundary() {
  const error = useRouteError()
  const reporter = useErrorReporter()
  const route = useRoutePattern()
  useEffect(() => {
    // A crash, or a loader's 5xx; never a 404 (no such page) or other 4xx.
    if (!reporter || (isRouteErrorResponse(error) && error.status < 500)) return
    reporter.setRoute(route)
    reporter.report('route', error, isRouteErrorResponse(error) ? { status: error.status } : undefined)
  }, [reporter, error, route])
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Something went wrong.'

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>This page hit an error</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
