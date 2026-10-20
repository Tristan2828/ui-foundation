// Done out of total (cell pattern 13's compact form): a small ring that
// fills clockwise from twelve o'clock, with the count beside it ("4/6").
// Narrow enough for a table column, readable on a view: a checklist, how
// far through an ordered list someone is, the steps of a process.
//
// The arc is the ink (currentColor: `foreground` while under way,
// `success-text` once complete), so it clears 3:1 on the page in both
// themes; the track is `border`, decoration only, the same ring empty.
// The count carries the value exactly, the ring roughly, and the whole is
// one image to a screen reader, named in words.
import { cn } from 'cn'

export type ProgressRingProps = {
  /** How many are done. Clamped to 0…total. */
  done: number
  /** How many there are. Zero of zero reads as not started. */
  total: number
  /** What a screen reader hears. Defaults to "4 of 6 done", or "Not started" for zero of zero. */
  label?: string
  /** Hide the count beside the ring (the ring's name still says it). */
  hideCount?: boolean
  className?: string
}

// 16×16, the stage circle's grid: a thick ring of radius 6 so the arc
// reads at 16px.
const R = 6
const CIRCUMFERENCE = 2 * Math.PI * R
const STROKE = 2.5

export function ProgressRing({ done, total, label, hideCount = false, className }: ProgressRingProps) {
  const safeTotal = Math.max(0, total)
  const safeDone = Math.min(Math.max(0, done), safeTotal)
  const complete = safeTotal > 0 && safeDone === safeTotal
  const fraction = safeTotal === 0 ? 0 : safeDone / safeTotal
  const name = label ?? (safeTotal === 0 ? 'Not started' : `${safeDone} of ${safeTotal} done`)
  return (
    <span
      role="img"
      aria-label={name}
      data-slot="progress-ring"
      data-complete={complete || undefined}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 tabular-nums',
        complete ? 'text-success-text' : 'text-foreground',
        className,
      )}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 shrink-0 -rotate-90">
        <circle cx="8" cy="8" r={R} strokeWidth={STROKE} className="fill-none stroke-border" />
        {fraction > 0 && (
          <circle
            cx="8"
            cy="8"
            r={R}
            strokeWidth={STROKE}
            strokeDasharray={`${fraction * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            // A full ring with a round cap would show a seam; butt it then.
            strokeLinecap={complete ? 'butt' : 'round'}
            className="fill-none stroke-current"
          />
        )}
      </svg>
      {!hideCount && safeTotal > 0 && (
        <span aria-hidden="true" className="type-caption">
          {safeDone}/{safeTotal}
        </span>
      )}
    </span>
  )
}
