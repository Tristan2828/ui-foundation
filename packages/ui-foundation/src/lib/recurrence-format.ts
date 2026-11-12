// A repeat in words (#326): its label for a list's Repeats cell and the
// field's preview ("Every 2nd Tue at 9:00 AM"), and an occurrence's
// date and time for a Next cell ("Tue, Dec 8, 9:00 AM"), both read in the
// rule's own zone. Day and month names and times come from Intl, in the
// locale given (the browser's when left out); the words around them are
// English, like the rest of the package.
import { listWords, ordinalWord } from '@/lib/recurrence-phrase'
import { parseRule, wallClock, type Recurrence, type RuleParts } from '@/lib/recurrence'

export type RecurrenceFormatOptions = {
  locale?: string
  /** Leave the times out ("Every 2nd Tue"), for a cell beside a separate time. */
  times?: boolean
}

const WEEKDAYS_MO_FR = [0, 1, 2, 3, 4]

function dayName(day: number, locale: string | undefined, width: 'short' | 'long' = 'short'): string {
  // 2024-01-01 was a Monday.
  return new Intl.DateTimeFormat(locale, { weekday: width, timeZone: 'UTC' }).format(Date.UTC(2024, 0, 1 + day))
}

function monthDay(month: number, day: number, locale: string | undefined): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(Date.UTC(2024, month - 1, day))
}

function plainDay(value: string, locale: string | undefined): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(Date.parse(`${value}T00:00:00Z`))
}

function clock(time: string, locale: string | undefined): string {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(
    Date.parse(`2024-01-01T${time}:00Z`),
  )
}

function every(parts: RuleParts, unit: string): string {
  if (parts.interval === 1) return `Every ${unit}`
  if (parts.interval === 2) return `Every other ${unit}`
  return `Every ${parts.interval} ${unit}s`
}

function nthDay(nth: number, day: number, locale: string | undefined): string {
  return `${nth === -1 ? 'last' : nth < -1 ? `${ordinalWord(-nth)} to last` : ordinalWord(nth)} ${dayName(day, locale)}`
}

function monthDayWord(day: number): string {
  return day === -1 ? 'last day' : day < -1 ? `${ordinalWord(-day)} to last day` : ordinalWord(day)
}

/** The days part: "Every 2nd Tue", "Every weekday", "Every 3 months on the 15th". */
function days(parts: RuleParts, start: string, locale: string | undefined): string {
  const [, startMonth, startDay] = start.split('-').map(Number)
  const startWeekday = (new Date(`${start}T00:00:00Z`).getUTCDay() + 6) % 7
  const weekdays = parts.byDay.filter(({ nth }) => nth === null).map(({ day }) => day)
  const nths = parts.byDay.filter(({ nth }) => nth !== null)
  const inMonths = parts.byMonth.length && parts.freq !== 'YEARLY' ? ` in ${listWords(parts.byMonth.map((month) => monthName(month, locale)))}` : ''
  switch (parts.freq) {
    case 'DAILY':
      return `${every(parts, 'day')}${inMonths}`
    case 'WEEKLY': {
      const chosen = weekdays.length ? weekdays : [startWeekday]
      const names = listWords(chosen.map((day) => dayName(day, locale)))
      if (parts.interval === 1) {
        if (chosen.join() === WEEKDAYS_MO_FR.join()) return `Every weekday${inMonths}`
        if (chosen.join() === '5,6') return `Every weekend${inMonths}`
        return `Every ${names}${inMonths}`
      }
      return `${every(parts, 'week')} on ${names}${inMonths}`
    }
    case 'MONTHLY': {
      const on = nths.length
        ? listWords(nths.map(({ nth, day }) => nthDay(nth!, day, locale)))
        : parts.byMonthDay.length
          ? listWords(parts.byMonthDay.map(monthDayWord))
          : weekdays.length
            ? `every ${listWords(weekdays.map((day) => dayName(day, locale)))}`
            : ordinalWord(startDay)
      if (parts.interval === 1) {
        if (parts.byMonthDay.length === 1 && parts.byMonthDay[0] === -1 && !nths.length) return `Every last day of the month${inMonths}`
        if (weekdays.length && !nths.length && !parts.byMonthDay.length) return `Every ${listWords(weekdays.map((day) => dayName(day, locale)))}${inMonths}`
        return `Every ${on}${inMonths}`
      }
      return `${every(parts, 'month')} on the ${on}${inMonths}`
    }
    case 'YEARLY': {
      const months = parts.byMonth.length ? parts.byMonth : [startMonth]
      if (nths.length) {
        const on = listWords(nths.map(({ nth, day }) => nthDay(nth!, day, locale)))
        const of = listWords(months.map((month) => monthName(month, locale)))
        return parts.interval === 1 ? `Every ${on} of ${of}` : `${every(parts, 'year')} on the ${on} of ${of}`
      }
      const monthDays = parts.byMonthDay.length ? parts.byMonthDay : [startDay]
      const dates = months.flatMap((month) =>
        monthDays.map((day) => (day > 0 ? monthDay(month, day, locale) : `the ${monthDayWord(day)} of ${monthName(month, locale)}`)),
      )
      return parts.interval === 1 ? `Every ${listWords(dates)}` : `${every(parts, 'year')} on ${listWords(dates)}`
    }
  }
}

function monthName(month: number, locale: string | undefined): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(Date.UTC(2024, month - 1, 1))
}

/**
 * The repeat's label: its days, "after done" when it repeats from
 * completion, its times, and how it ends. "Every 2nd Tue at 9:00 AM",
 * "Every 3 days after done, at 9:00 AM", "Every weekday at 8:00 AM and
 * 5:30 PM, until Mar 1, 2027", "Every day at 9:00 AM, 10 times". A rule
 * it can't read shows as stored.
 */
export function formatRecurrence(value: Recurrence, options: RecurrenceFormatOptions = {}): string {
  let parts: RuleParts
  try {
    parts = parseRule(value.rule)
  } catch {
    return value.rule
  }
  const { locale } = options
  let label = days(parts, value.start, locale)
  if (value.fromCompletion) label += ' after done'
  if (options.times !== false && value.times.length) {
    label += `${value.fromCompletion ? ',' : ''} at ${listWords(value.times.map((time) => clock(time, locale)))}`
  }
  if (parts.until) label += `, until ${plainDay(parts.until, locale)}`
  if (parts.count !== null) label += `, ${parts.count} ${parts.count === 1 ? 'time' : 'times'}`
  return label
}

export type OccurrenceFormatOptions = {
  locale?: string
  /** What "now" is, for leaving out this year. Defaults to the clock. */
  now?: Date
}

/**
 * One occurrence's day and time in the rule's zone: "Tue, Dec 8, 9:00 AM",
 * with the year when it isn't this year's.
 */
export function formatOccurrence(moment: Date, timeZone: string, options: OccurrenceFormatOptions = {}): string {
  const thisYear = wallClock(options.now ?? new Date(), timeZone).day.slice(0, 4)
  const year = wallClock(moment, timeZone).day.slice(0, 4)
  return new Intl.DateTimeFormat(options.locale, {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: year === thisYear ? undefined : 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(moment)
}

/** Today's date in `timeZone`, `'YYYY-MM-DD'`: where a phrase's days count from. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return wallClock(now, timeZone).day
}
