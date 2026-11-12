// Repeating schedules (#326): one rule, stored RRULE-shaped (RFC 5545), and
// when it falls next. The backend's `foundation_backend.recurrence` is the
// same rules in Python; both read tests/fixtures/recurrence-cases.json, so
// a screen and the server agree on every next occurrence.
//
// A `Recurrence` (the contract's schema) is a rule (`FREQ=MONTHLY;BYDAY=2TU`,
// no DTSTART), the first day it can fall on (`start`), its times of day,
// its IANA zone, and whether it repeats from completion (`every!`).
//
// The days come from the rule; the times are put on them in the zone. npm's
// rrule walks the days as UTC midnights, with no time and no zone, so its
// maths never meets a DST change; each day's times then become instants in
// the zone. A time a DST change skips (02:30 the night clocks spring
// forward) is read an hour on; one it repeats (01:30 the night they fall
// back) is the first of the two, as Python's zoneinfo reads them. A day a
// month doesn't have is skipped: the 31st falls only in months with 31
// days, Feb 29 only in leap years, and -1 is every month's last day. COUNT
// counts occurrences, each time of each day.
import * as rruleModule from 'rrule'
import type { components } from '@/api/schema'

/** A repeating schedule, as the contract writes it. */
export type Recurrence = components['schemas']['Recurrence']

type RRuleModule = typeof rruleModule
// rrule ships an ES module build without `"type": "module"`: a bundler reads
// its named exports, Node its UMD build, whose exports sit on `default`.
// Read through Reflect so a bundler doesn't warn about a `default` it lacks.
const rrule: RRuleModule = (Reflect.get(rruleModule, 'default') as RRuleModule | undefined) ?? rruleModule

export const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const
export type Frequency = (typeof FREQUENCIES)[number]
/** RFC 5545's weekday codes, Monday first (Monday is 0 everywhere here). */
export const WEEKDAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const

export type ByDay = { nth: number | null; day: number }

/** A rule's parts, read and checked. `until` is `'YYYY-MM-DD'`. */
export type RuleParts = {
  freq: Frequency
  interval: number
  byDay: ByDay[]
  byMonthDay: number[]
  byMonth: number[]
  until: string | null
  count: number | null
}

/** What's wrong with a rule or a recurrence, in words a person can act on. */
export class RecurrenceError extends Error {}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const BYDAY = /^([+-]?[1-5])?(MO|TU|WE|TH|FR|SA|SU)$/
const UNTIL = /^(\d{4})(\d{2})(\d{2})$/
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const PARTS = new Set(['FREQ', 'INTERVAL', 'BYDAY', 'BYMONTHDAY', 'BYMONTH', 'UNTIL', 'COUNT'])
// How far ahead a rule must fall at least once (a 31st of February never does).
const HORIZON_YEARS = 28
const DAY_MS = 86_400_000

function integers(name: string, value: string, low: number, high: number): number[] {
  const found: number[] = []
  for (const part of value.split(',')) {
    if (!/^[+-]?\d{1,4}$/.test(part)) throw new RecurrenceError(`${name} must be numbers; got ${value}.`)
    const number = Number(part)
    if (number < low || number > high || number === 0) throw new RecurrenceError(`${name} ${number} is out of range.`)
    if (!found.includes(number)) found.push(number)
  }
  return found
}

/** `FREQ=…;…` → its parts; throws a RecurrenceError saying what's wrong. */
export function parseRule(text: string): RuleParts {
  const fields = new Map<string, string>()
  for (const part of text.trim().toUpperCase().split(';')) {
    if (!part) continue
    const at = part.indexOf('=')
    if (at <= 0 || at === part.length - 1) throw new RecurrenceError(`Rule part ${part} isn't NAME=value.`)
    const name = part.slice(0, at)
    if (fields.has(name)) throw new RecurrenceError(`${name} appears twice.`)
    fields.set(name, part.slice(at + 1))
  }
  const unknown = [...fields.keys()].filter((name) => !PARTS.has(name)).sort()
  if (unknown.length) throw new RecurrenceError(`Rule part ${unknown[0]} isn't supported.`)
  const freq = fields.get('FREQ') as Frequency | undefined
  if (!freq || !FREQUENCIES.includes(freq)) throw new RecurrenceError(`FREQ must be one of ${FREQUENCIES.join(', ')}.`)
  const interval = fields.has('INTERVAL') ? integers('INTERVAL', fields.get('INTERVAL')!, 1, 999)[0] : 1
  const byDay: ByDay[] = []
  for (const part of fields.get('BYDAY')?.split(',') ?? []) {
    const match = BYDAY.exec(part)
    if (!match) throw new RecurrenceError(`BYDAY ${part} isn't a weekday (MO to SU, with an nth of 1 to 5 or -1 to -5).`)
    const nth = match[1] ? Number(match[1]) : null
    if (nth !== null && freq !== 'MONTHLY' && freq !== 'YEARLY') {
      throw new RecurrenceError('An nth weekday (2TU, -1FR) needs FREQ=MONTHLY or YEARLY.')
    }
    const day = WEEKDAY_CODES.indexOf(match[2] as (typeof WEEKDAY_CODES)[number])
    if (!byDay.some((each) => each.nth === nth && each.day === day)) byDay.push({ nth, day })
  }
  const byMonthDay = fields.has('BYMONTHDAY') ? integers('BYMONTHDAY', fields.get('BYMONTHDAY')!, -31, 31) : []
  if (byMonthDay.length && freq === 'WEEKLY') throw new RecurrenceError("BYMONTHDAY can't go with FREQ=WEEKLY.")
  const byMonth = fields.has('BYMONTH') ? integers('BYMONTH', fields.get('BYMONTH')!, 1, 12) : []
  let until: string | null = null
  if (fields.has('UNTIL')) {
    const match = UNTIL.exec(fields.get('UNTIL')!)
    if (!match || !isRealDay(`${match[1]}-${match[2]}-${match[3]}`)) throw new RecurrenceError('UNTIL must be a date, YYYYMMDD.')
    until = `${match[1]}-${match[2]}-${match[3]}`
  }
  const count = fields.has('COUNT') ? integers('COUNT', fields.get('COUNT')!, 1, 9999)[0] : null
  if (until !== null && count !== null) throw new RecurrenceError('A rule has UNTIL or COUNT, not both.')
  return {
    freq,
    interval,
    byDay: byDay.sort((a, b) => a.day - b.day || (a.nth ?? 0) - (b.nth ?? 0)),
    byMonthDay: byMonthDay.sort((a, b) => Number(a < 0) - Number(b < 0) || a - b),
    byMonth: byMonth.sort((a, b) => a - b),
    until,
    count,
  }
}

/**
 * The stored form, its parts always in one order (so two rules that mean
 * the same are the same text): FREQ, INTERVAL (left out at 1), BYMONTH,
 * BYMONTHDAY, BYDAY, UNTIL, COUNT.
 */
export function formatRule(parts: RuleParts): string {
  const out = [`FREQ=${parts.freq}`]
  if (parts.interval !== 1) out.push(`INTERVAL=${parts.interval}`)
  if (parts.byMonth.length) out.push(`BYMONTH=${parts.byMonth.join(',')}`)
  if (parts.byMonthDay.length) out.push(`BYMONTHDAY=${parts.byMonthDay.join(',')}`)
  if (parts.byDay.length) out.push(`BYDAY=${parts.byDay.map(({ nth, day }) => `${nth ?? ''}${WEEKDAY_CODES[day]}`).join(',')}`)
  if (parts.until) out.push(`UNTIL=${parts.until.replaceAll('-', '')}`)
  if (parts.count !== null) out.push(`COUNT=${parts.count}`)
  return out.join(';')
}

function isRealDay(value: string): boolean {
  const match = DATE.exec(value)
  if (!match) return false
  const moment = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return moment.toISOString().slice(0, 10) === value
}

/** Whether `name` is an IANA zone this browser knows. */
export function isTimeZone(name: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name })
    return true
  } catch {
    return false
  }
}

/**
 * The recurrence in its stored form (the rule's parts in order, the times
 * sorted, each once), or a RecurrenceError saying what's wrong with it: the
 * same checks the backend's `Recurrence` makes.
 */
export function normalizeRecurrence(value: Recurrence): Recurrence {
  const parts = parseRule(value.rule)
  if (!isRealDay(value.start)) throw new RecurrenceError('The start must be a date, YYYY-MM-DD.')
  if (!value.times.length) throw new RecurrenceError('It needs at least one time of day.')
  for (const each of value.times) {
    if (!TIME.test(each)) throw new RecurrenceError(`A time is HH:MM, 00:00 to 23:59; got ${each}.`)
  }
  if (!value.timeZone || !isTimeZone(value.timeZone)) throw new RecurrenceError(`Unknown time zone ${value.timeZone}.`)
  const fromCompletion = value.fromCompletion ?? false
  if (parts.count !== null && fromCompletion) {
    throw new RecurrenceError("“For N times” can't go with repeating from completion: each next one counts from when it's done.")
  }
  if (parts.until !== null && parts.until < value.start) throw new RecurrenceError('It ends before it starts.')
  const horizon = `${Math.min(Number(value.start.slice(0, 4)) + HORIZON_YEARS, 9999)}-12-31`
  if (days(parts, value.start, horizon).next().done) throw new RecurrenceError('The rule never falls on a day (no month has that day).')
  return { ...value, rule: formatRule(parts), times: [...new Set(value.times)].sort(), fromCompletion }
}

/** What's wrong with a recurrence, or null when nothing is. */
export function recurrenceProblem(value: Recurrence): string | null {
  try {
    normalizeRecurrence(value)
    return null
  } catch (error) {
    if (error instanceof RecurrenceError) return error.message
    throw error
  }
}

// ------------------------------------------------------------ the days

const toUtcDay = (value: string) => new Date(`${value}T00:00:00Z`)
const dayOf = (moment: Date) => moment.toISOString().slice(0, 10)

const FREQ_OF: Record<Frequency, number> = {
  DAILY: rrule.Frequency.DAILY,
  WEEKLY: rrule.Frequency.WEEKLY,
  MONTHLY: rrule.Frequency.MONTHLY,
  YEARLY: rrule.Frequency.YEARLY,
}

const MONTH_LENGTHS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/**
 * Whether no month the rule allows has any of its month days (the 30th of
 * February): such a rule never falls, and rrule would walk to the year
 * 9999 looking, since it checks UNTIL only on a day it finds.
 */
export function monthDaysNeverFall(parts: RuleParts): boolean {
  if (!parts.byMonthDay.length) return false
  const months = parts.byMonth.length ? parts.byMonth : MONTH_LENGTHS.map((_, at) => at + 1)
  return !months.some((month) => parts.byMonthDay.some((day) => Math.abs(day) <= MONTH_LENGTHS[month - 1]))
}

/**
 * The days the rule falls on from `start`, through UNTIL (and `stop`),
 * as `'YYYY-MM-DD'`: rrule does the walking, from the start each time it's
 * asked for more, four times as many as before.
 */
function* days(parts: RuleParts, start: string, stop?: string): Generator<string> {
  if (monthDaysNeverFall(parts)) return
  const last = [parts.until, stop].filter((each): each is string => !!each).sort()[0]
  const weekdays = parts.byDay.map(({ nth, day }) => {
    const weekday = rrule.Weekday.fromStr(WEEKDAY_CODES[day])
    return nth === null ? weekday : weekday.nth(nth)
  })
  const rule = new rrule.RRule({
    freq: FREQ_OF[parts.freq],
    interval: parts.interval,
    dtstart: toUtcDay(start),
    byweekday: weekdays.length ? weekdays : null,
    bymonthday: parts.byMonthDay.length ? parts.byMonthDay : null,
    bymonth: parts.byMonth.length ? parts.byMonth : null,
    until: last ? toUtcDay(last) : null,
  })
  let given = 0
  for (let limit = 64; ; limit *= 4) {
    const found = rule.all((_, count) => count < limit)
    for (const moment of found.slice(given)) yield dayOf(moment)
    given = found.length
    if (found.length < limit) return
  }
}

// ------------------------------------------------------ times in a zone

const zoneFormats = new Map<string, Intl.DateTimeFormat>()

function zoneFormat(timeZone: string): Intl.DateTimeFormat {
  let format = zoneFormats.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    zoneFormats.set(timeZone, format)
  }
  return format
}

/** The wall clock in `timeZone` at an instant: `'YYYY-MM-DD'` and minutes past midnight. */
export function wallClock(moment: Date | number, timeZone: string): { day: string; minutes: number; ms: number } {
  const ms = typeof moment === 'number' ? moment : moment.getTime()
  const parts: Record<string, string> = {}
  for (const part of zoneFormat(timeZone).formatToParts(ms)) parts[part.type] = part.value
  const day = `${parts.year}-${parts.month}-${parts.day}`
  const [hour, minute, second] = [Number(parts.hour), Number(parts.minute), Number(parts.second)]
  return { day, minutes: hour * 60 + minute, ms: Date.parse(`${day}T00:00:00Z`) + ((hour * 60 + minute) * 60 + second) * 1000 }
}

/** The zone's offset from UTC at an instant, in milliseconds. */
function offsetAt(ms: number, timeZone: string): number {
  const whole = Math.floor(ms / 1000) * 1000
  return wallClock(whole, timeZone).ms - whole
}

/**
 * `day` at `time` (`'HH:MM'`) in `timeZone`, as an instant. A time a DST
 * change skips is read an hour on (the offset before the change); one it
 * repeats is the first of the two, as Python's zoneinfo reads them.
 */
export function atLocal(day: string, time: string, timeZone: string): Date {
  const wall = Date.parse(`${day}T${time}:00Z`)
  const before = offsetAt(wall - DAY_MS, timeZone)
  const after = offsetAt(wall + DAY_MS, timeZone)
  const fits = (offset: number) => offsetAt(wall - offset, timeZone) === offset
  if (fits(before)) return new Date(wall - before)
  if (fits(after)) return new Date(wall - after)
  return new Date(wall - before)
}

/** Every occurrence from `start` on, in order, COUNT applied. */
function* instants(value: Recurrence, start: string, parts = parseRule(value.rule)): Generator<Date> {
  const times = [...new Set(value.times)].sort()
  let left = parts.count
  for (const day of days(parts, start)) {
    // Sorted per day: across a DST change a later time can be the earlier instant.
    const moments = [...new Set(times.map((time) => atLocal(day, time, value.timeZone).getTime()))].sort((a, b) => a - b)
    for (const ms of moments) {
      if (left !== null) {
        if (left === 0) return
        left -= 1
      }
      yield new Date(ms)
    }
    if (left === 0) return
  }
}

/** The next `count` occurrences strictly after `after`. */
export function nextOccurrences(value: Recurrence, after: Date, count: number): Date[] {
  const found: Date[] = []
  if (count <= 0) return found
  for (const moment of instants(value, value.start)) {
    if (moment.getTime() > after.getTime()) {
      found.push(moment)
      if (found.length === count) break
    }
  }
  return found
}

/** The first occurrence strictly after `after`, or null once the rule has ended. */
export function nextOccurrence(value: Recurrence, after: Date): Date | null {
  return nextOccurrences(value, after, 1)[0] ?? null
}

/**
 * For a `fromCompletion` rule, the next occurrence once it's done at
 * `doneAt`: the rule's days counted from the local day it was done, the
 * first one after that day. A schedule rule's is just its next.
 */
export function nextAfterCompletion(value: Recurrence, doneAt: Date): Date | null {
  if (!value.fromCompletion) return nextOccurrence(value, doneAt)
  const doneDay = wallClock(doneAt, value.timeZone).day
  for (const moment of instants(value, doneDay)) {
    if (wallClock(moment, value.timeZone).day > doneDay) return moment
  }
  return null
}

// ------------------------------------------ a weekday set and one time

const DAY_NAMES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

/**
 * The rule for a weekday set and one time (Monday 0, or `'mon,wed,fri'`
 * as the reminders table stores it), exactly: due on the same days at the
 * same time, from `start` on. Every day of the week is FREQ=DAILY.
 */
export function recurrenceFromWeekdays(
  weekdays: readonly number[] | string,
  time: string,
  timeZone: string,
  start: string,
): Recurrence {
  const chosen =
    typeof weekdays === 'string'
      ? weekdays
          .split(',')
          .map((part) => part.trim().toLowerCase())
          .filter(Boolean)
          .map((name) => DAY_NAMES.indexOf(name as (typeof DAY_NAMES)[number]))
      : [...weekdays]
  if (!chosen.length || chosen.some((day) => day < 0 || day > 6)) {
    throw new RecurrenceError('The days must be some of mon, tue, wed, thu, fri, sat, sun.')
  }
  const unique = [...new Set(chosen)].sort()
  const rule = unique.length === 7 ? 'FREQ=DAILY' : `FREQ=WEEKLY;BYDAY=${unique.map((day) => WEEKDAY_CODES[day]).join(',')}`
  return normalizeRecurrence({ rule, start, times: [time], timeZone, fromCompletion: false })
}
