// The composite AGENTS.md's "Correct Patterns" section names directly:
// `if (error) return <ErrorState error={error} />`. Renders an AppError —
// never a raw response (the gateway translates every failure) —
// using the same <Empty> primitive the "no rows" state uses, so a screen's
// error and empty states read as one family instead of two unrelated
// widgets.
//
// `compact` is the same state for a small container (a WidgetCard): less
// padding and the icon beside the title instead of in a box above it, so
// one failing widget reads as that widget's problem, not the page's.
//
// Kind `proxy_auth` (a lapsed sign-in at a proxy in front of the app, such
// as Cloudflare Access) offers "Sign In Again" in place of any retry: a
// full page load, so the proxy's own sign-in runs. Retrying the request
// would only get the proxy's page again.
import { AlertCircleIcon, LogInIcon } from 'lucide-react'
import { cn } from 'cn'
import type { AppError } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

const TITLE_BY_KIND: Record<AppError['kind'], string> = {
  network: 'Connection problem',
  server: 'Something went wrong',
  notfound: 'Not found',
  auth: 'Not authorized',
  rate_limited: 'Too many attempts',
  validation: 'Check the form',
  proxy_auth: 'Sign-in expired',
}

function reloadPage() {
  window.location.reload()
}

export function ErrorState({
  error,
  onRetry,
  size = 'default',
  className,
}: {
  error: AppError
  onRetry?: () => void
  /** `compact` inside a small container such as a WidgetCard. */
  size?: 'default' | 'compact'
  className?: string
}) {
  const compact = size === 'compact'
  const signInAgain = error.kind === 'proxy_auth'
  return (
    <Empty className={cn(compact && 'gap-3 p-4', className)} data-state="error" data-size={size}>
      <EmptyHeader className={cn(compact && 'gap-1')}>
        {compact ? (
          <EmptyTitle className="flex items-center gap-1.5">
            <AlertCircleIcon aria-hidden="true" className="size-4 shrink-0 text-destructive-text" />
            {TITLE_BY_KIND[error.kind]}
          </EmptyTitle>
        ) : (
          <>
            <EmptyMedia variant="icon">
              <AlertCircleIcon className="text-destructive-text" />
            </EmptyMedia>
            <EmptyTitle>{TITLE_BY_KIND[error.kind]}</EmptyTitle>
          </>
        )}
        <EmptyDescription>{error.message}</EmptyDescription>
      </EmptyHeader>
      {signInAgain ? (
        <EmptyContent>
          <Button size="sm" onClick={reloadPage}>
            <LogInIcon aria-hidden="true" />
            Sign In Again
          </Button>
        </EmptyContent>
      ) : (
        onRetry && (
          <EmptyContent>
            <Button size="sm" variant="outline" onClick={onRetry}>
              Try Again
            </Button>
          </EmptyContent>
        )
      )}
    </Empty>
  )
}
