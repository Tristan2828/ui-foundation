// A month and day with no year: something that comes round every year (a
// season's start, a yearly deadline). The value is `'MM-DD'` (`'03-14'`),
// or `''` for not set, so it sorts as text in calendar order. February 29
// is a day like any other (it comes round in leap years); February 30,
// April 31 and `13-01` are not days. MonthDayField edits one.

/** A day of the year with no year, `'MM-DD'`, or `''` for not set. */
export type MonthDay = string

const MONTH_DAY = /^(\d{2})-(\d{2})$/

// Days in each month of a leap year: February has its 29th.
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const

/** How many days the month (1–12) can have: February's 29 counted. */
export function daysInMonth(month: number): number {
  return DAYS_IN_MONTH[month - 1] ?? 0
}

/** The month (1–12) and day of a real `'MM-DD'`, or null for anything else (`''`, `'02-30'`, `'3-14'`). */
export function monthDayParts(value: MonthDay): { month: number; day: number } | null {
  const match = MONTH_DAY.exec(value)
  if (!match) return null
  const [month, day] = [Number(match[1]), Number(match[2])]
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(month)) return null
  return { month, day }
}

/** Whether the value is a real day of the year as `'MM-DD'`: `'02-29'` is, `'02-30'` isn't. */
export function isMonthDay(value: MonthDay): boolean {
  return monthDayParts(value) !== null
}

/** The month (1–12) and day as `'MM-DD'`. */
export function toMonthDay(month: number, day: number): MonthDay {
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// A leap year, so February 29 formats; the year is never shown.
const LEAP_YEAR = 2000

/**
 * Shows a month and day ("Mar 14", or "14 March" in `en-GB` with
 * `{ month: 'long', day: 'numeric' }`) in the locale's order, never a
 * year or a weekday. `''` and anything that isn't a real `'MM-DD'` give `''`.
 */
export function formatMonthDay(
  value: MonthDay,
  options: Pick<Intl.DateTimeFormatOptions, 'month' | 'day'> = { month: 'short', day: 'numeric' },
  locale?: string,
): string {
  const parts = monthDayParts(value)
  if (!parts) return ''
  const { month = 'short', day = 'numeric' } = options
  return new Intl.DateTimeFormat(locale, { month, day, timeZone: 'UTC' }).format(Date.UTC(LEAP_YEAR, parts.month - 1, parts.day))
}

/** A month's name ("March", or "Mar" with `'short'`), for a month 1–12. */
export function monthName(month: number, style: 'long' | 'short' = 'long', locale?: string): string {
  return new Intl.DateTimeFormat(locale, { month: style, timeZone: 'UTC' }).format(Date.UTC(LEAP_YEAR, month - 1, 1))
}

/**
 * Why a value isn't a day of the year, or null when it is (or is `''`):
 * "February has 29 days" for `'02-30'`, "Pick a month and day" for
 * anything not `'MM-DD'`.
 */
export function monthDayProblem(value: MonthDay, locale?: string): string | null {
  if (value === '' || isMonthDay(value)) return null
  const match = MONTH_DAY.exec(value)
  const [month, day] = match ? [Number(match[1]), Number(match[2])] : [0, 0]
  if (month >= 1 && month <= 12 && day > daysInMonth(month)) return `${monthName(month, 'long', locale)} has ${daysInMonth(month)} days`
  return 'Pick a month and day'
}
