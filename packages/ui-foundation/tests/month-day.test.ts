// A month and day with no year (src/lib/month-day.ts): which values are
// days of the year (February 29 is; February 30 isn't), how they read in
// a locale's order, and what a value that isn't one is refused with.
import { describe, expect, it } from 'vitest'
import { daysInMonth, formatMonthDay, isMonthDay, monthDayProblem, toMonthDay } from '../src/lib/month-day'

describe('isMonthDay', () => {
  it('takes every real day of the year, February 29 included', () => {
    expect(isMonthDay('01-01')).toBe(true)
    expect(isMonthDay('02-29')).toBe(true)
    expect(isMonthDay('04-30')).toBe(true)
    expect(isMonthDay('12-31')).toBe(true)
  })

  it('refuses impossible days and anything not MM-DD', () => {
    for (const value of ['02-30', '04-31', '06-31', '13-01', '00-10', '03-00', '3-14', '03-14-2026', '2026-03-14', '', 'Mar 14'])
      expect(isMonthDay(value), value).toBe(false)
  })

  it('counts every month the days it can have', () => {
    expect(Array.from({ length: 12 }, (_, i) => daysInMonth(i + 1))).toEqual([31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])
    expect(toMonthDay(3, 4)).toBe('03-04')
  })
})

describe('formatMonthDay', () => {
  it('reads in the locale’s order, never with a year', () => {
    expect(formatMonthDay('03-14', undefined, 'en-US')).toBe('Mar 14')
    expect(formatMonthDay('02-29', undefined, 'en-US')).toBe('Feb 29')
    expect(formatMonthDay('12-31', { month: 'long', day: 'numeric' }, 'en-GB')).toBe('31 December')
  })

  it('gives nothing for a value that isn’t a day', () => {
    expect(formatMonthDay('')).toBe('')
    expect(formatMonthDay('02-30')).toBe('')
  })
})

describe('monthDayProblem', () => {
  it('says why, or null for a day and for not set', () => {
    expect(monthDayProblem('02-29')).toBeNull()
    expect(monthDayProblem('')).toBeNull()
    expect(monthDayProblem('02-30', 'en-US')).toBe('February has 29 days')
    expect(monthDayProblem('04-31', 'en-US')).toBe('April has 30 days')
    expect(monthDayProblem('13-01')).toBe('Pick a month and day')
    expect(monthDayProblem('spring')).toBe('Pick a month and day')
  })
})
