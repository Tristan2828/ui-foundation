import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  atLocal,
  formatRule,
  nextAfterCompletion,
  nextOccurrence,
  nextOccurrences,
  normalizeRecurrence,
  parseRule,
  recurrenceFromWeekdays,
  recurrenceProblem,
  type Recurrence,
} from '@/lib/recurrence'

// src/lib/recurrence.ts (#326). The shared cases are the ones the backend's
// packages/backend-foundation/tests/test_recurrence.py checks, so a screen
// and the server agree on every next occurrence.
type Case = {
  name: string
  recurrence: Recurrence
  after: string
  count: number
  next: string[]
  doneAt?: string
  nextAfterDone?: string | null
}
const CASES = (
  JSON.parse(readFileSync(path.join(import.meta.dirname, 'fixtures/recurrence-cases.json'), 'utf8')) as { cases: Case[] }
).cases

const iso = (moment: Date | null) => (moment ? moment.toISOString().replace('.000Z', 'Z') : null)
const rule = (text: string, more: Partial<Recurrence> = {}): Recurrence => ({
  rule: text,
  start: '2026-11-01',
  times: ['09:00'],
  timeZone: 'America/Chicago',
  fromCompletion: false,
  ...more,
})

describe('the shared cases', () => {
  it.each(CASES.map((each) => [each.name, each] as const))('%s', (_, each) => {
    const value = normalizeRecurrence(each.recurrence)
    expect(value.rule).toBe(each.recurrence.rule)
    expect(nextOccurrences(value, new Date(each.after), each.count).map(iso)).toEqual(each.next)
    if (each.doneAt) expect(iso(nextAfterCompletion(value, new Date(each.doneAt)))).toBe(each.nextAfterDone)
  })
})

describe('rules', () => {
  it('stores a rule in one order whatever it was written in', () => {
    expect(formatRule(parseRule('byday=fr,mo;freq=weekly;interval=1'))).toBe('FREQ=WEEKLY;BYDAY=MO,FR')
    expect(formatRule(parseRule('FREQ=MONTHLY;BYMONTHDAY=-1,15,1;INTERVAL=2'))).toBe('FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=1,15,-1')
    expect(parseRule('FREQ=MONTHLY;BYDAY=-1FR').byDay).toEqual([{ nth: -1, day: 4 }])
    expect(normalizeRecurrence(rule('FREQ=DAILY', { times: ['17:00', '09:00', '17:00'] })).times).toEqual(['09:00', '17:00'])
  })

  it.each([
    ['FREQ=HOURLY', 'FREQ must be one of'],
    ['FREQ=DAILY;INTERVAL=0', 'INTERVAL 0 is out of range'],
    ['FREQ=WEEKLY;BYDAY=2TU', 'needs FREQ=MONTHLY or YEARLY'],
    ['FREQ=MONTHLY;BYDAY=6TU', "isn't a weekday"],
    ['FREQ=MONTHLY;BYMONTHDAY=32', 'out of range'],
    ['FREQ=WEEKLY;BYMONTHDAY=3', "can't go with FREQ=WEEKLY"],
    ['FREQ=DAILY;UNTIL=20270230', 'UNTIL must be a date'],
    ['FREQ=DAILY;UNTIL=20270301;COUNT=3', 'UNTIL or COUNT, not both'],
    ['FREQ=DAILY;BYHOUR=9', "BYHOUR isn't supported"],
    ['FREQ=DAILY;FREQ=WEEKLY', 'FREQ appears twice'],
  ])('refuses %s, saying why', (text, message) => {
    expect(() => parseRule(text)).toThrow(message)
  })

  it.each([
    [{ times: [] }, 'at least one time'],
    [{ times: ['9am'] }, 'A time is HH:MM'],
    [{ timeZone: 'Mars/Olympus_Mons' }, 'Unknown time zone'],
    [{ rule: 'FREQ=DAILY;COUNT=3', fromCompletion: true }, "can't go with repeating from completion"],
    [{ rule: 'FREQ=DAILY;UNTIL=20261001' }, 'ends before it starts'],
    [{ rule: 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30' }, 'never falls on a day'],
  ] as const)('refuses a recurrence that cannot be: %j', (change, message) => {
    expect(recurrenceProblem(rule('FREQ=DAILY', change as Partial<Recurrence>))).toContain(message)
  })
})

describe('times in a zone', () => {
  it('reads a skipped time an hour on and a repeated one as its first', () => {
    expect(iso(atLocal('2027-03-14', '02:30', 'America/Chicago'))).toBe('2027-03-14T08:30:00Z')
    expect(iso(atLocal('2026-11-01', '01:30', 'America/Chicago'))).toBe('2026-11-01T06:30:00Z')
    expect(iso(atLocal('2026-11-01', '09:00', 'America/Chicago'))).toBe('2026-11-01T15:00:00Z')
    expect(iso(atLocal('2026-10-04', '02:30', 'Australia/Sydney'))).toBe('2026-10-03T16:30:00Z')
    expect(iso(atLocal('2026-07-01', '00:00', 'UTC'))).toBe('2026-07-01T00:00:00Z')
  })

  it('is strictly after, and ends with COUNT and UNTIL', () => {
    const daily = normalizeRecurrence(rule('FREQ=DAILY', { timeZone: 'UTC' }))
    expect(iso(nextOccurrence(daily, new Date('2026-11-05T09:00:00Z')))).toBe('2026-11-06T09:00:00Z')
    expect(iso(nextOccurrence(daily, new Date('2020-01-01T00:00:00Z')))).toBe('2026-11-01T09:00:00Z')
    const three = rule('FREQ=DAILY;COUNT=3', { timeZone: 'UTC' })
    expect(nextOccurrences(three, new Date('2020-01-01T00:00:00Z'), 10)).toHaveLength(3)
    const until = rule('FREQ=WEEKLY;BYDAY=MO;UNTIL=20261207', { timeZone: 'UTC' })
    expect(nextOccurrence(until, new Date('2026-12-07T09:00:00Z'))).toBeNull()
  })

  it('finds a rule years after its start', () => {
    const leap = rule('FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29', { timeZone: 'UTC', start: '2026-01-01' })
    expect(nextOccurrences(leap, new Date('2041-01-01T00:00:00Z'), 2).map(iso)).toEqual([
      '2044-02-29T09:00:00Z',
      '2048-02-29T09:00:00Z',
    ])
  })
})

describe('a weekday set and one time', () => {
  it('converts with no loss', () => {
    expect(recurrenceFromWeekdays('mon,wed,fri', '07:30', 'America/Chicago', '2026-10-01')).toEqual({
      rule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
      start: '2026-10-01',
      times: ['07:30'],
      timeZone: 'America/Chicago',
      fromCompletion: false,
    })
    expect(recurrenceFromWeekdays([6, 5, 4, 3, 2, 1, 0], '06:00', 'UTC', '2026-10-01').rule).toBe('FREQ=DAILY')
    expect(() => recurrenceFromWeekdays('funday', '06:00', 'UTC', '2026-10-01')).toThrow('The days must be')
  })
})
