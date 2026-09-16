// The composite AGENTS.md's "Correct Patterns" section names directly:
// `if (error) return <ErrorState error={error} />`. Renders an AppError —
// never a raw response, see docs/BUILD-PLAN.md "Anti-Corruption Layer" —
// using the same <Empty> primitive the "no rows" state uses, so a screen's
// error and empty states read as one family instead of two unrelated
// widgets.
import { AlertCircleIcon } from 'lucide-react'
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
  validation: 'Check the form',
}

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: AppError
  onRetry?: () => void
  className?: string
}) {
  return (
    <Empty className={className} data-state="error">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertCircleIcon className="text-destructive" />
        </EmptyMedia>
        <EmptyTitle>{TITLE_BY_KIND[error.kind]}</EmptyTitle>
        <EmptyDescription>{error.message}</EmptyDescription>
      </EmptyHeader>
      {onRetry && (
        <EmptyContent>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </EmptyContent>
      )}
    </Empty>
  )
}
