// How fresh a number is (overview standard O3): one quiet line under it,
// "Balances entered Aug 2", in the caption type and the muted tone. Once
// `staleAfter` has passed it turns to the warning tone and gains a
// warning icon, so an out-of-date balance never looks current; the line
// still says when, and a screen reader hears ", out of date".
//
// Used in a part's tile and detail and in a WidgetCard's body. The date is
// a plain day ('YYYY-MM-DD', as the wire writes it, shown without the
// time zone shifting it) or an instant (a Date, or an ISO timestamp).
// `staleAfter` is the moment it goes stale, so the app owns the rule
// (entered + 90 days): this only says whether it has passed. `now` is for
// stories and tests.
import { TriangleAlertIcon } from 'lucide-react'
import { cn } from 'cn'
import { isStale, showDate } from '@/lib/freshness'

export type FreshnessProps = {
  /** When it was entered or checked; null or '' when it never was. */
  at: Date | string | null | undefined
  /** The moment it goes stale. Left out, the line is never in the warning tone. */
  staleAfter?: Date | string
  /** What happened, before the date: "Balances entered", "Prices checked". */
  label: string
  /** What the line says when `at` is empty. Defaults to "<label>: never". */
  neverText?: string
  /** The clock, for stories and tests. Defaults to now. */
  now?: Date
  className?: string
}

export function Freshness({ at, staleAfter, label, neverText, now = new Date(), className }: FreshnessProps) {
  const entered = at ? showDate(at, now) : ''
  if (!entered) {
    return (
      <span data-slot="freshness" data-state="never" className={cn('type-caption text-muted-foreground', className)}>
        {neverText ?? `${label}: never`}
      </span>
    )
  }
  const stale = isStale(staleAfter, now)
  const iso = at instanceof Date ? at.toISOString() : String(at)
  return (
    <span
      data-slot="freshness"
      data-state={stale ? 'stale' : 'fresh'}
      className={cn(
        'inline-flex items-center gap-1 type-caption',
        stale ? 'text-warning-text' : 'text-muted-foreground',
        className,
      )}
    >
      {stale && <TriangleAlertIcon aria-hidden="true" className="size-3 shrink-0" />}
      <span>
        {label} <time dateTime={iso}>{entered}</time>
        {stale && <span className="sr-only">, out of date</span>}
      </span>
    </span>
  )
}
