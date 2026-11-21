// A month of days holding the app's items: events,
// visits, anything with a day. On a laptop each day shows its items by
// title, two to a day and the rest folded to a count; on a phone each day
// shows a dot per item in its tone. The picked day's items are listed
// under the month, each a link, with the app's own actions for that day
// beside its heading (Add, say). Not a date picker: that's `Calendar`.
//
// The month is a grid (role="grid", a table): one tab stop on the picked
// day, the arrows move it a day or a week, Home and End to the week's
// ends, Page Up and Page Down a month, Enter or a click picks it. Moving
// past the month's edge turns the page. Every day is a plain day
// (`'YYYY-MM-DD'`), never an instant, so no zone shifts one.
//
// Four states: loading (the month's frame with placeholders), error
// (ErrorState in place of the days, the arrows still there), empty
// ("Nothing this month" over the days) and success.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Link, type To } from 'react-router'
import { cn } from 'cn'
import type { AppError } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPlainDate, localToPlainDate, type PlainDate } from '@/lib/plain-date'
import { ErrorState } from './error-state'

export type MonthCalendarTone = 'neutral' | 'info' | 'success' | 'warning' | 'destructive'

/** One thing on a day. */
export type MonthCalendarItem = {
  id: string | number
  /** Its day, `'YYYY-MM-DD'`. */
  day: PlainDate
  title: string
  /** `'HH:MM'`, or none for all day. */
  time?: string | null
  /** Its dot and mark (design-language.md "Semantic tones"). Defaults to `info`. */
  tone?: MonthCalendarTone
  /** Where its row in the day's list goes. */
  to?: To
  /** A word after the time in the day's list ("Visit"). */
  detail?: string
}

export type MonthCalendarProps = {
  /** The month's name for a screen reader is added to this ("Events"). */
  label: string
  items?: MonthCalendarItem[]
  /** Today, `'YYYY-MM-DD'` in the app's zone (todayIn). */
  today: PlainDate
  /** The picked day, when the app holds it. */
  selected?: PlainDate
  /** A day picked by click, Enter or the arrows; the app says what that does. */
  onSelect?: (day: PlainDate) => void
  /** The month shown, `'YYYY-MM'`, when the app holds it. Defaults to the picked day's. */
  month?: string
  onMonthChange?: (month: string) => void
  /** The app's actions for the picked day, beside its heading (an Add button). */
  dayActions?: (day: PlainDate) => ReactNode
  /** The first day of the week. Defaults to Monday. */
  weekStart?: 'MO' | 'SU'
  isLoading?: boolean
  error?: AppError | null
  onRetry?: () => void
  /** Over the days when the month has nothing. Defaults to "Nothing this month". */
  emptyText?: ReactNode
  locale?: string
  className?: string
}

const TONE_DOT: Record<MonthCalendarTone, string> = {
  neutral: 'bg-muted-foreground',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
}

const pad = (value: number) => String(value).padStart(2, '0')
const monthOf = (day: PlainDate) => day.slice(0, 7)

function parts(day: PlainDate): [number, number, number] {
  const [year, month, date] = day.split('-').map(Number)
  return [year, month, date]
}

function shift(day: PlainDate, days: number): PlainDate {
  const [year, month, date] = parts(day)
  return localToPlainDate(new Date(year, month - 1, date + days))
}

function shiftMonth(month: string, by: number): string {
  const [year, number] = month.split('-').map(Number)
  const next = new Date(year, number - 1 + by, 1)
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}`
}

/** The same day in another month, or that month's last day. */
function sameDayIn(day: PlainDate, month: string): PlainDate {
  const [year, number] = month.split('-').map(Number)
  const last = new Date(year, number, 0).getDate()
  return `${month}-${pad(Math.min(parts(day)[2], last))}`
}

function clock(time: string, locale: string | undefined): string {
  const [hour, minute] = time.split(':').map(Number)
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(
    Date.UTC(2001, 0, 1, hour, minute),
  )
}

/** Monday 0 … Sunday 6. */
function weekdayIndex(day: PlainDate): number {
  const [year, month, date] = parts(day)
  return (new Date(Date.UTC(year, month - 1, date)).getUTCDay() + 6) % 7
}

const byTime = (a: MonthCalendarItem, b: MonthCalendarItem) => (a.time ?? '').localeCompare(b.time ?? '')

export function MonthCalendar({
  label,
  items = [],
  today,
  selected,
  onSelect,
  month,
  onMonthChange,
  dayActions,
  weekStart = 'MO',
  isLoading,
  error,
  onRetry,
  emptyText = 'Nothing this month',
  locale,
  className,
}: MonthCalendarProps) {
  const [ownSelected, setOwnSelected] = useState<PlainDate>(selected ?? today)
  const picked = selected ?? ownSelected
  const [ownMonth, setOwnMonth] = useState<string>(month ?? monthOf(picked))
  const shown = month ?? ownMonth
  const gridRef = useRef<HTMLTableElement>(null)
  const focusAfter = useRef(false)

  const byDay = useMemo(() => {
    const map = new Map<PlainDate, MonthCalendarItem[]>()
    for (const item of items) map.set(item.day, [...(map.get(item.day) ?? []), item])
    for (const list of map.values()) list.sort(byTime)
    return map
  }, [items])

  function showMonth(next: string) {
    if (month === undefined) setOwnMonth(next)
    onMonthChange?.(next)
  }

  function pick(day: PlainDate, focus = false) {
    if (selected === undefined) setOwnSelected(day)
    onSelect?.(day)
    if (monthOf(day) !== shown) showMonth(monthOf(day))
    focusAfter.current = focus
  }

  // After a key moves the pick, the focus follows it (into the new month too).
  useEffect(() => {
    if (!focusAfter.current) return
    focusAfter.current = false
    gridRef.current?.querySelector<HTMLElement>(`[data-day="${picked}"]`)?.focus()
  })

  const firstDay = `${shown}-01`
  const [year, monthNumber] = shown.split('-').map(Number)
  const daysIn = new Date(year, monthNumber, 0).getDate()
  const startIndex = weekStart === 'SU' ? 6 : 0
  const lead = (weekdayIndex(firstDay) - startIndex + 7) % 7
  const weeks: (PlainDate | null)[][] = []
  for (let cell = 0; cell < Math.ceil((lead + daysIn) / 7) * 7; cell++) {
    const date = cell - lead + 1
    if (cell % 7 === 0) weeks.push([])
    weeks[weeks.length - 1].push(date >= 1 && date <= daysIn ? `${shown}-${pad(date)}` : null)
  }
  const weekdayNames = Array.from({ length: 7 }, (_, i) => {
    // 2024-01-01 was a Monday.
    const at = Date.UTC(2024, 0, 1 + ((i + startIndex) % 7))
    return {
      short: new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(at),
      narrow: new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' }).format(at),
      long: new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(at),
    }
  })
  const monthName = formatPlainDate(firstDay, { month: 'long', year: 'numeric' }, locale)
  const monthHasItems = items.some((item) => monthOf(item.day) === shown)
  // The pick the grid's tab stop sits on: in this month, or its first day.
  const stop = monthOf(picked) === shown ? picked : firstDay

  function onKeyDown(event: KeyboardEvent<HTMLElement>, day: PlainDate) {
    const index = (weekdayIndex(day) - startIndex + 7) % 7
    const moves: Record<string, () => PlainDate> = {
      ArrowLeft: () => shift(day, -1),
      ArrowRight: () => shift(day, 1),
      ArrowUp: () => shift(day, -7),
      ArrowDown: () => shift(day, 7),
      Home: () => shift(day, -index),
      End: () => shift(day, 6 - index),
      PageUp: () => sameDayIn(day, shiftMonth(monthOf(day), -1)),
      PageDown: () => sameDayIn(day, shiftMonth(monthOf(day), 1)),
    }
    if (moves[event.key]) {
      event.preventDefault()
      pick(moves[event.key](), true)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      pick(day, true)
    }
  }

  const dayLabel = (day: PlainDate) => formatPlainDate(day, { weekday: 'long', month: 'long', day: 'numeric' }, locale)
  const pickedItems = byDay.get(picked) ?? []

  return (
    <div data-slot="month-calendar" className={cn('flex min-w-0 flex-col gap-3', className)}>
      <div className="flex items-center gap-2">
        <h2 className="mr-auto type-body font-semibold text-foreground" aria-live="polite">
          {monthName}
        </h2>
        <Button variant="outline" size="icon-sm" aria-label="Previous month" onClick={() => showMonth(shiftMonth(shown, -1))}>
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => pick(today)}>
          Today
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Next month" onClick={() => showMonth(shiftMonth(shown, 1))}>
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : (
        <>
          {!isLoading && !monthHasItems && (
            <p data-slot="month-calendar-empty" className="text-sm text-muted-foreground">
              {emptyText}
            </p>
          )}
          <table
            ref={gridRef}
            role="grid"
            aria-label={`${label}, ${monthName}`}
            aria-busy={isLoading || undefined}
            className="w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-md border-t border-l border-border"
          >
            <thead>
              <tr>
                {weekdayNames.map((name) => (
                  <th
                    key={name.long}
                    scope="col"
                    abbr={name.long}
                    className="border-r border-b border-border bg-muted/40 px-1 py-1 text-left text-xs font-medium text-muted-foreground uppercase max-md:text-center"
                  >
                    <span className="sr-only">{name.long}</span>
                    <span className="max-md:hidden" aria-hidden="true">
                      {name.short}
                    </span>
                    <span className="md:hidden" aria-hidden="true">
                      {name.narrow}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, row) => (
                <tr key={row}>
                  {week.map((day, column) => {
                    if (!day) return <td key={column} className="border-r border-b border-border bg-muted/20" />
                    const list = byDay.get(day) ?? []
                    const isToday = day === today
                    const isPicked = day === picked
                    const count = list.length
                    return (
                      <td
                        key={day}
                        data-day={day}
                        aria-selected={isPicked}
                        aria-current={isToday ? 'date' : undefined}
                        tabIndex={day === stop ? 0 : -1}
                        onClick={() => pick(day)}
                        onKeyDown={(event) => onKeyDown(event, day)}
                        className={cn(
                          'h-11 cursor-pointer border-r border-b border-border bg-card p-1 align-top outline-none md:h-20',
                          'hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset',
                          isPicked && 'shadow-[inset_0_0_0_2px_var(--color-ring)]',
                        )}
                      >
                        {/* Named by this, not an aria-label: a label would leave out the titles shown. */}
                        <span className="sr-only">
                          {`${dayLabel(day)}${isToday ? ', today' : ''}, ${count === 0 ? 'nothing' : count === 1 ? '1 item' : `${count} items`}`}
                          {count > 0 && `: ${list.map((item) => item.title).join(', ')}`}
                        </span>
                        <div className="flex flex-col max-md:items-center" aria-hidden="true">
                          <span
                            className={cn(
                              'w-fit rounded px-1 text-xs tabular-nums',
                              isToday ? 'bg-primary font-semibold text-primary-foreground' : 'text-muted-foreground',
                            )}
                          >
                            {Number(day.slice(8))}
                          </span>
                          {isLoading ? (
                            <Skeleton className="mt-1 h-3 w-3/4 max-md:hidden" />
                          ) : (
                            <>
                              <ul className="mt-0.5 flex min-w-0 flex-col gap-0.5 max-md:hidden">
                                {list.slice(0, 2).map((item) => (
                                  <li key={item.id} className="flex min-w-0 items-center gap-1 text-xs text-foreground">
                                    <span className={cn('size-1.5 shrink-0 rounded-full', TONE_DOT[item.tone ?? 'info'])} />
                                    <span className="truncate">{item.title}</span>
                                  </li>
                                ))}
                                {count > 2 && <li className="pl-2.5 text-xs text-muted-foreground">+{count - 2} more</li>}
                              </ul>
                              {count > 0 && (
                                <span className="mt-1 flex justify-center gap-0.5 md:hidden">
                                  {list.slice(0, 4).map((item) => (
                                    <span key={item.id} className={cn('size-1.5 rounded-full', TONE_DOT[item.tone ?? 'info'])} />
                                  ))}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div
            role="group"
            aria-label={`${dayLabel(picked)}${picked === today ? ', today' : ''}`}
            data-slot="month-calendar-day"
            className="flex flex-col gap-1"
          >
            <div className="flex items-center gap-2">
              <h3 className={cn('mr-auto text-sm font-semibold', picked === today ? 'text-link' : 'text-foreground')}>
                {dayLabel(picked)}
                {picked === today && ' · Today'}
              </h3>
              {dayActions?.(picked)}
            </div>
            {isLoading ? (
              <div className="flex flex-col gap-2 py-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : pickedItems.length === 0 ? (
              <p className="border-t border-border py-1.5 text-sm text-muted-foreground">Nothing that day.</p>
            ) : (
              <ul className="flex flex-col">
                {pickedItems.map((item) => {
                  const when = [item.time ? clock(item.time, locale) : 'All day', item.detail].filter(Boolean).join(' · ')
                  const body = (
                    <>
                      <span className={cn('size-2 shrink-0 rounded-full', TONE_DOT[item.tone ?? 'info'])} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{when}</span>
                    </>
                  )
                  return (
                    <li key={item.id} className="border-t border-border">
                      {item.to ? (
                        <Link
                          to={item.to}
                          className="flex min-h-10 items-center gap-2 py-1.5 text-sm text-foreground outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {body}
                        </Link>
                      ) : (
                        <div className="flex min-h-10 items-center gap-2 py-1.5 text-sm text-foreground">{body}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
