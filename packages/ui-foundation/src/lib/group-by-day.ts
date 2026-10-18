// `byDay`: DataTable's `groupBy` for a feed, a log or a timeline, newest
// first. A row goes under Today, Yesterday, Earlier this week, then the
// week it fell in ("Week of 6 Oct") for the four weeks before this one,
// then its month ("September", with the year once it isn't this year's).
// A date after today is Upcoming; a row with no date is No date.
//
// Days are calendar days in `timeZone` (the browser's by default), worked
// out with Intl and counted as whole days from then on, so a daylight
// saving change or a time near midnight never moves a row to the wrong
// day. Weeks start on Monday unless `weekStartsOn: 0` (Sunday).
import type { RowGroup } from '@/components/app/table-groups'

export type ByDayOptions = {
  /** What "today" is. Defaults to when byDay is called: pass it to pin a test. */
  now?: Date
  /** The IANA zone whose calendar days count, e.g. "Europe/London". Defaults to the browser's. */
  timeZone?: string
  /** 1 (Monday, the default) or 0 (Sunday). */
  weekStartsOn?: 0 | 1
  /** The locale week and month names are written in. Defaults to "en-GB": "Week of 6 Oct". */
  locale?: string
}

type DateValue = string | number | Date | null | undefined

const DAY_MS = 86_400_000
const WEEKS_BY_WEEK = 4

export function byDay<TData>(
  field: keyof TData | ((row: TData) => DateValue),
  { now = new Date(), timeZone, weekStartsOn = 1, locale = 'en-GB' }: ByDayOptions = {},
): (row: TData) => RowGroup {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
  // The calendar day `date` falls on in the zone, as days since 1970-01-01.
  const dayOf = (date: Date) => {
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.formatToParts(date).find((p) => p.type === type)?.value)
    return Date.UTC(part('year'), part('month') - 1, part('day')) / DAY_MS
  }
  // Day numbers are UTC midnights, so they're formatted in UTC.
  const dayMonth = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const month = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' })
  const monthYear = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const weekStart = (day: number) => day - ((new Date(day * DAY_MS).getUTCDay() - weekStartsOn + 7) % 7)
  const isoDay = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10)

  const today = dayOf(now)
  const thisWeek = weekStart(today)
  const thisYear = new Date(today * DAY_MS).getUTCFullYear()
  const read = typeof field === 'function' ? field : (row: TData) => row[field] as DateValue

  return (row) => {
    const value = read(row)
    const date = value === null || value === undefined || value === '' ? null : new Date(value)
    if (date === null || Number.isNaN(date.getTime())) return { key: 'none', label: 'No date' }
    const day = dayOf(date)
    if (day > today) return { key: 'upcoming', label: 'Upcoming' }
    if (day === today) return { key: 'today', label: 'Today' }
    if (day === today - 1) return { key: 'yesterday', label: 'Yesterday' }
    if (day >= thisWeek) return { key: 'this-week', label: 'Earlier this week' }
    const week = weekStart(day)
    if (week >= thisWeek - WEEKS_BY_WEEK * 7) {
      return { key: `week:${isoDay(week)}`, label: `Week of ${dayMonth.format(new Date(week * DAY_MS))}` }
    }
    const first = new Date(day * DAY_MS)
    const label = (first.getUTCFullYear() === thisYear ? month : monthYear).format(first)
    return { key: `month:${isoDay(day).slice(0, 7)}`, label }
  }
}
