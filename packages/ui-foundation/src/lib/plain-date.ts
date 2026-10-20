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
