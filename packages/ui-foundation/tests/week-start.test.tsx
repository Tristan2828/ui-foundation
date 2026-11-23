// The day weeks start on: Monday in every part that has one, unless it's
// given another. The calendars that open in a popup, and their keyboard,
// are checked in a browser: e2e/week-start.spec.ts.
import { renderToStaticMarkup } from 'react-dom/server'
import { enUS } from 'react-day-picker/locale'
import { describe, expect, it } from 'vitest'
import { MonthCalendar } from '../src/components/app/month-calendar'
import { Calendar } from '../src/components/ui/calendar'
import { byDay } from '../src/lib/group-by-day'
import { parseRule, weekStartMatters } from '../src/lib/recurrence'
import { parseRecurrencePhrase } from '../src/lib/recurrence-phrase'

const MONDAY_FIRST = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const SUNDAY_FIRST = ['Sunday', ...MONDAY_FIRST.slice(0, 6)]

const heads = (html: string, attribute: string) =>
  [...html.matchAll(/<th\b[^>]*>/g)].map(([tag]) => new RegExp(`${attribute}="([^"]*)"`).exec(tag)?.[1])

const calendar = (props: Partial<React.ComponentProps<typeof Calendar>> = {}) =>
  heads(renderToStaticMarkup(<Calendar mode="single" defaultMonth={new Date(2026, 8, 16)} {...(props as object)} />), 'aria-label')

const month = (weekStart?: 'MO' | 'SU') =>
  heads(
    renderToStaticMarkup(<MonthCalendar label="Visits" items={[]} today="2026-09-16" weekStart={weekStart} locale="en-US" />),
    'abbr',
  )

describe('weeks start on Monday by default', () => {
  it('in Calendar, whatever its locale', () => {
    expect(calendar()).toEqual(MONDAY_FIRST)
    // What a caller passing `weekStart && …` gives when it was given none.
    expect(calendar({ weekStartsOn: undefined })).toEqual(MONDAY_FIRST)
    expect(calendar({ locale: enUS })).toEqual(MONDAY_FIRST)
  })

  it('in MonthCalendar', () => {
    expect(month()).toEqual(MONDAY_FIRST)
  })

  it('in byDay', () => {
    const group = byDay<{ at: string }>('at', { now: new Date('2026-09-16T12:00:00Z'), timeZone: 'UTC' })
    expect(group({ at: '2026-09-14T12:00:00Z' }).label).toBe('Earlier This Week')
    expect(group({ at: '2026-09-13T12:00:00Z' }).label).toBe('Week of 7 Sept')
  })

  it('in a repeat, which is why its rule stores no WKST', () => {
    const read = parseRecurrencePhrase('every other week on sun and wed', {
      today: '2026-09-16',
      timeZone: 'UTC',
    })
    if (!read.ok) throw new Error(read.error)
    const rule = parseRule(read.value.rule)
    expect(weekStartMatters(rule)).toBe(true)
    expect(rule.weekStart).toBeNull()
  })
})

describe('weeks start on the day given', () => {
  it('in Calendar', () => {
    expect(calendar({ weekStartsOn: 0 })).toEqual(SUNDAY_FIRST)
    expect(calendar({ weekStartsOn: 6 })[0]).toBe('Saturday')
  })

  it('in MonthCalendar', () => {
    expect(month('SU')).toEqual(SUNDAY_FIRST)
  })
})
