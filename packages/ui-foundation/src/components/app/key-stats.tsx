// A record's key numbers in a row (EntityView's `strip`): each a small
// muted label over its value in the section title's size, side by side
// and wrapping onto a second line when the page is narrow. A <dl>, so a
// screen reader reads each label with its value. The values are the
// screen's own markup, formatted as its cells are (a count, a date, a
// badge), and an empty one reads as `emptyLabel`, never a blank.
import type { ReactNode } from 'react'
import { cn } from 'cn'

export type KeyStat = {
  label: string
  value: ReactNode
  /** A few words under the value ("of 12", "since May"), in caption type. */
  hint?: ReactNode
}

export type KeyStatsProps = {
  stats: readonly KeyStat[]
  /** What an empty value reads as. Defaults to "Not set". */
  emptyLabel?: string
  className?: string
}

const isEmpty = (value: ReactNode) => value === null || value === undefined || value === false || value === ''

export function KeyStats({ stats, emptyLabel = 'Not set', className }: KeyStatsProps) {
  return (
    <dl
      data-slot="key-stats"
      className={cn(
        'flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground',
        className,
      )}
    >
      {stats.map((stat) => (
        <div key={stat.label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="type-caption text-muted-foreground">{stat.label}</dt>
          <dd className="type-section-title tabular-nums break-words text-foreground">
            {isEmpty(stat.value) ? <span className="type-body text-muted-foreground">{emptyLabel}</span> : stat.value}
          </dd>
          {stat.hint && <dd className="type-caption text-muted-foreground">{stat.hint}</dd>}
        </div>
      ))}
    </dl>
  )
}
