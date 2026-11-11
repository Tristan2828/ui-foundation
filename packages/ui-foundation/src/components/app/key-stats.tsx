// A record's key numbers in a row (EntityView's `strip`): each a small
// muted label over its value in the section title's size, side by side
// and wrapping onto a second line when the page is narrow. A <dl>, so a
// screen reader reads each label with its value. The values are the
// screen's own markup, formatted as its cells are (a count, a date, a
// badge), and an empty one reads as `emptyLabel` (a dash), never a blank.
//
// `icon` (record page standard 5.2, #R4): the concept's icon at 13px
// before the label's word, in the label's muted tone, from the app's icon
// vocabulary (a `CalendarIcon` for a date, `HashIcon` for a count). The
// word stays: the icon is decorative.
import type { ReactNode } from 'react'
import { cn } from 'cn'
import { EmptyText } from './empty-value'
import { EMPTY_DASH } from '@/lib/empty-value'
import type { IconComponent } from './icon-component'

export type KeyStat = {
  label: string
  value: ReactNode
  /** A few words under the value ("of 12", "since May"), in caption type. */
  hint?: ReactNode
  /** The concept's icon, drawn at 13px before the label (decorative: the label still says it). */
  icon?: IconComponent
}

export type KeyStatsProps = {
  stats: readonly KeyStat[]
  /** What an empty value reads as. Defaults to a dash, read as "Not set". */
  emptyLabel?: string
  className?: string
}

const isEmpty = (value: ReactNode) => value === null || value === undefined || value === false || value === ''

export function KeyStats({ stats, emptyLabel = EMPTY_DASH, className }: KeyStatsProps) {
  return (
    <dl
      data-slot="key-stats"
      className={cn(
        'flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground',
        className,
      )}
    >
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <div key={stat.label} className="flex min-w-0 flex-col gap-0.5">
            <dt className={cn('type-caption text-muted-foreground', Icon && 'inline-flex items-center gap-1')}>
              {Icon && <Icon aria-hidden="true" className="size-3.25 shrink-0" />}
              {stat.label}
            </dt>
            <dd className="type-section-title tabular-nums break-words text-foreground">
              {isEmpty(stat.value) ? <EmptyText text={emptyLabel} className="type-body text-muted-foreground" /> : stat.value}
            </dd>
            {stat.hint && <dd className="type-caption text-muted-foreground">{stat.hint}</dd>}
          </div>
        )
      })}
    </dl>
  )
}
