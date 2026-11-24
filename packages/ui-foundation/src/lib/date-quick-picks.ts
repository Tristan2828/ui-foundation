// The days DateField's quick picks set: Today, Tomorrow, This Weekend and
// Next Week, counted from today's plain day and the calendar's week start.
// Plain days in, plain days out: the sums run on a local Date at midnight
// (`new Date(y, m, d + n)` rolls over months and years and never lands
// on another day across a clock change), so no time zone moves the day.
import { localToPlainDate, plainDateToLocal, type PlainDate } from '@/lib/plain-date'
import type { WeekdayCode } from '@/lib/recurrence'

/** One quick pick: its button's words, and the day it sets from today's. */
export type DateQuickPick = {
  /** The button's words, in Title Case ("This Weekend"). */
  label: string
  /** The day it sets, from today (`'YYYY-MM-DD'`) and the calendar's week start. */
  day: (today: PlainDate, weekStart: WeekdayCode) => PlainDate
}

// Date's getDay() by weekday code: Sunday is 0.
const DAY_NUMBER = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 } as const satisfies Record<WeekdayCode, number>

/** The day `days` after a plain day (before it, for a negative count). */
export function addPlainDays(day: PlainDate, days: number): PlainDate {
  const local = plainDateToLocal(day)
  if (!local) return ''
  return localToPlainDate(new Date(local.getFullYear(), local.getMonth(), local.getDate() + days))
}

/**
 * The next `weekday` on or after a plain day (`sameDay: true`, the
 * default), or strictly after it (`sameDay: false`).
 */
export function comingWeekday(day: PlainDate, weekday: WeekdayCode, { sameDay = true }: { sameDay?: boolean } = {}): PlainDate {
  const local = plainDateToLocal(day)
  if (!local) return ''
  let ahead = (DAY_NUMBER[weekday] - local.getDay() + 7) % 7
  if (ahead === 0 && !sameDay) ahead = 7
  return addPlainDays(day, ahead)
}

/** Today. */
export const TODAY_PICK: DateQuickPick = { label: 'Today', day: (today) => today }

/** The day after today. */
export const TOMORROW_PICK: DateQuickPick = { label: 'Tomorrow', day: (today) => addPlainDays(today, 1) }

/** The coming Saturday: today when it's Saturday, the next one from Sunday on. */
export const THIS_WEEKEND_PICK: DateQuickPick = { label: 'This Weekend', day: (today) => comingWeekday(today, 'SA') }

/** The first day of next week: the coming week start, a week on when today is one. */
export const NEXT_WEEK_PICK: DateQuickPick = {
  label: 'Next Week',
  day: (today, weekStart) => comingWeekday(today, weekStart, { sameDay: false }),
}

/** DateField's `quickPicks` when it's given `true`: Today, Tomorrow, This Weekend and Next Week. */
export const DATE_QUICK_PICKS: readonly DateQuickPick[] = [TODAY_PICK, TOMORROW_PICK, THIS_WEEKEND_PICK, NEXT_WEEK_PICK]
