// A plain date: a calendar day with no time, as the wire writes it
// (OpenAPI `format: date`, `'YYYY-MM-DD'`), or `''` for not set. It's a
// day, never an instant, so nothing here goes through the browser's time
// zone: Sep 2 is Sep 2 everywhere. DateField edits one.

/** A calendar day as the wire writes it, `'YYYY-MM-DD'`, or `''` for not set. */
export type PlainDate = string

const PLAIN_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function parts(value: PlainDate): [number, number, number] | null {
  const match = PLAIN_DATE.exec(value)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  // Reject what Date would roll over (Feb 30 → Mar 2).
  const check = new Date(Date.UTC(year, month - 1, day))
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null
  return [year, month, day]
}

/**
 * Shows a plain date ("Sep 2, 2026") without ever shifting it by the
 * time zone: the day is formatted as UTC midnight, in UTC. `''` and
 * anything that isn't a real `'YYYY-MM-DD'` day give `''`.
 */
export function formatPlainDate(
  value: PlainDate,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  locale?: string,
): string {
  const day = parts(value)
  if (!day) return ''
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(Date.UTC(day[0], day[1] - 1, day[2]))
}

/** The day as a local Date at midnight (what a date picker works in), or undefined when not set. */
export function plainDateToLocal(value: PlainDate): Date | undefined {
  const day = parts(value)
  return day ? new Date(day[0], day[1] - 1, day[2]) : undefined
}

/** A local Date's own calendar day, as `'YYYY-MM-DD'`. */
export function localToPlainDate(date: Date): PlainDate {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** Whether the locale writes the day before the month (3/14 in en-US, 14/3 in en-GB). */
export function dayFirst(locale?: string): boolean {
  const order = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'numeric', timeZone: 'UTC' })
    .formatToParts(Date.UTC(2026, 2, 14))
    .filter((part) => part.type === 'day' || part.type === 'month')
  return order[0]?.type === 'day'
}

function dayOf(year: number, month: number, day: number): PlainDate | null {
  const pad = (n: number) => String(n).padStart(2, '0')
  const value = `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`
  return parts(value) ? value : null
}

const fullYear = (typed: string | undefined, fallback: number) => {
  if (typed === undefined) return fallback
  return typed.length <= 2 ? 2000 + Number(typed) : Number(typed)
}

/** What `parsePlainDate` is told: today's day (for "today" and a day with no year) and the locale. */
export type ParsePlainDateOptions = {
  /** Today, `'YYYY-MM-DD'`. Defaults to the browser's own today. */
  today?: PlainDate
  /** Decides `3/4`'s order: month first in en-US, day first in en-GB. */
  locale?: string
}

/**
 * Reads a day typed by hand: `3/14`, `3/14/26`, `Mar 14`, `March 14 2026`,
 * `14 Mar`, `2026-03-14`, `today`, `yesterday`, `tomorrow`. A day with no
 * year is in today's year. Gives `'YYYY-MM-DD'`, `''` for blank, or
 * `null` for something that isn't a day (`Feb 30`, `soon`).
 */
export function parsePlainDate(text: string, options: ParsePlainDateOptions = {}): PlainDate | null {
  const typed = text.trim().toLowerCase().replace(/\s+/g, ' ')
  if (typed === '') return ''
  const today = options.today && parts(options.today) ? options.today : localToPlainDate(new Date())
  const [year, month, day] = parts(today)!
  const shift = (days: number) => localToPlainDate(new Date(year, month - 1, day + days))
  if (typed === 'today') return today
  if (typed === 'yesterday') return shift(-1)
  if (typed === 'tomorrow') return shift(1)

  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(typed)
  if (match) return dayOf(Number(match[1]), Number(match[2]), Number(match[3]))

  match = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/.exec(typed)
  if (match) {
    const [a, b] = [Number(match[1]), Number(match[2])]
    const [m, d] = dayFirst(options.locale) ? [b, a] : [a, b]
    return dayOf(fullYear(match[3], year), m, d)
  }

  const monthOf = (word: string) => {
    const at = MONTHS.indexOf(word.slice(0, 3))
    return at !== -1 && word.length >= 3 ? at + 1 : null
  }
  // Mar 14, March 14 2026, Mar 14, 2026
  match = /^([a-z]+)\.? (\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{4}))?$/.exec(typed)
  if (match) {
    const m = monthOf(match[1]!)
    return m ? dayOf(fullYear(match[3], year), m, Number(match[2])) : null
  }
  // 14 Mar, 14 March 2026
  match = /^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+)\.?(?:,? (\d{4}))?$/.exec(typed)
  if (match) {
    const m = monthOf(match[2]!)
    return m ? dayOf(fullYear(match[3], year), m, Number(match[1])) : null
  }
  return null
}

/** Two days typed the way the locale writes them, for an empty box: "3/14 or Mar 14" (en-US), "14/3 or 14 Mar" (en-GB). */
export function plainDateExamples(locale?: string): string {
  return dayFirst(locale) ? '14/3 or 14 Mar' : '3/14 or Mar 14'
}

/** What a typed day says when it can't be read: "Try a date like 3/14 or Mar 14". */
export function unreadableDateMessage(locale?: string): string {
  return `Try a date like ${plainDateExamples(locale)}`
}
