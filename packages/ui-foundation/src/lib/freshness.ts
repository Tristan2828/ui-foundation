// The rules under <Freshness>: reading a date the way the wire writes it,
// showing it short, and saying whether a limit has passed. A plain day
// ('YYYY-MM-DD') is a calendar day, never shifted by the time zone; any
// other string is an instant (an ISO timestamp).
import { formatPlainDate } from '@/lib/plain-date'

const PLAIN_DAY = /^\d{4}-\d{2}-\d{2}$/

/** A plain day as local midnight, anything else as the instant it names; null when it isn't a date. */
export function toDate(value: Date | string): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (PLAIN_DAY.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** "Aug 2" this year, "Aug 2, 2025" before it; '' when it isn't a date. */
export function showDate(value: Date | string, now: Date): string {
  const date = toDate(value)
  if (!date) return ''
  const sameYear = date.getFullYear() === now.getFullYear()
  const options: Intl.DateTimeFormatOptions = sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' }
  if (typeof value === 'string' && PLAIN_DAY.test(value)) return formatPlainDate(value, options)
  return date.toLocaleDateString(undefined, options)
}

/** True once `staleAfter` is before `now`. Never for a missing or unreadable date. */
export function isStale(staleAfter: Date | string | undefined, now: Date = new Date()): boolean {
  if (staleAfter === undefined || staleAfter === '') return false
  const limit = toDate(staleAfter)
  return limit !== null && limit.getTime() < now.getTime()
}
