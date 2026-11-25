// DateField's quick picks (src/lib/date-quick-picks.ts): the day each
// sets from today, around a weekend, a week start and a month and year end.
import { describe, expect, it } from 'vitest'
import {
  addPlainDays,
  comingWeekday,
  DATE_QUICK_PICKS,
  NEXT_WEEK_PICK,
  THIS_WEEKEND_PICK,
  TODAY_PICK,
  TOMORROW_PICK,
} from '../src/lib/date-quick-picks'

// Nov 2026: Mon 23, Tue 24, ..., Fri 27, Sat 28, Sun 29, Mon 30.
describe('addPlainDays', () => {
  it('rolls over a month end, a year end and a leap day', () => {
    expect(addPlainDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addPlainDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addPlainDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addPlainDays('2027-02-28', 1)).toBe('2027-03-01')
    expect(addPlainDays('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('keeps the day across a clock change', () => {
    // US clocks go back on Nov 1, 2026 and forward on Mar 8, 2026.
    expect(addPlainDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addPlainDays('2026-11-01', 1)).toBe('2026-11-02')
    expect(addPlainDays('2026-03-07', 1)).toBe('2026-03-08')
    expect(addPlainDays('2026-03-08', 1)).toBe('2026-03-09')
  })

  it('gives an empty string for a day that is not set', () => {
    expect(addPlainDays('', 1)).toBe('')
  })
})

describe('comingWeekday', () => {
  it('is the day itself when it is that weekday, unless told otherwise', () => {
    expect(comingWeekday('2026-11-28', 'SA')).toBe('2026-11-28')
    expect(comingWeekday('2026-11-28', 'SA', { sameDay: false })).toBe('2026-12-05')
  })
})

describe('Today and Tomorrow', () => {
  it('are today and the day after, over a month and a year end', () => {
    expect(TODAY_PICK.day('2026-11-24', 'MO')).toBe('2026-11-24')
    expect(TOMORROW_PICK.day('2026-11-24', 'MO')).toBe('2026-11-25')
    expect(TOMORROW_PICK.day('2026-11-30', 'MO')).toBe('2026-12-01')
    expect(TOMORROW_PICK.day('2026-12-31', 'MO')).toBe('2027-01-01')
  })
})

describe('This Weekend', () => {
  it('is the coming Saturday through the week', () => {
    for (const today of ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27']) {
      expect(THIS_WEEKEND_PICK.day(today, 'MO')).toBe('2026-11-28')
    }
  })

  it('is today on a Saturday, and the next Saturday from Sunday', () => {
    expect(THIS_WEEKEND_PICK.day('2026-11-28', 'MO')).toBe('2026-11-28')
    expect(THIS_WEEKEND_PICK.day('2026-11-29', 'MO')).toBe('2026-12-05')
  })

  it('crosses a month end and a year end', () => {
    // Mon Nov 30 → Sat Dec 5; Thu Dec 31, 2026 → Sat Jan 2, 2027.
    expect(THIS_WEEKEND_PICK.day('2026-11-30', 'MO')).toBe('2026-12-05')
    expect(THIS_WEEKEND_PICK.day('2026-12-31', 'MO')).toBe('2027-01-02')
  })

  it("doesn't move with the week start", () => {
    expect(THIS_WEEKEND_PICK.day('2026-11-24', 'SU')).toBe('2026-11-28')
  })
})

describe('Next Week', () => {
  it('is the coming Monday, a week on from a Monday', () => {
    expect(NEXT_WEEK_PICK.day('2026-11-24', 'MO')).toBe('2026-11-30')
    expect(NEXT_WEEK_PICK.day('2026-11-28', 'MO')).toBe('2026-11-30')
    expect(NEXT_WEEK_PICK.day('2026-11-29', 'MO')).toBe('2026-11-30')
    expect(NEXT_WEEK_PICK.day('2026-11-23', 'MO')).toBe('2026-11-30')
  })

  it('is the coming Sunday for weeks that start on Sunday', () => {
    expect(NEXT_WEEK_PICK.day('2026-11-24', 'SU')).toBe('2026-11-29')
    expect(NEXT_WEEK_PICK.day('2026-11-28', 'SU')).toBe('2026-11-29')
    expect(NEXT_WEEK_PICK.day('2026-11-29', 'SU')).toBe('2026-12-06')
  })

  it('crosses a month end and a year end', () => {
    // Thu Dec 31, 2026 → Mon Jan 4, 2027; Wed Feb 25, 2026 → Mon Mar 2.
    expect(NEXT_WEEK_PICK.day('2026-12-31', 'MO')).toBe('2027-01-04')
    expect(NEXT_WEEK_PICK.day('2026-02-25', 'MO')).toBe('2026-03-02')
  })
})

describe('DATE_QUICK_PICKS', () => {
  it('is the four, in order', () => {
    expect(DATE_QUICK_PICKS.map((pick) => pick.label)).toEqual(['Today', 'Tomorrow', 'This Weekend', 'Next Week'])
  })
})
