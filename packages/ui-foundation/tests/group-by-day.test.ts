// byDay: which heading a row goes under, in the zone's calendar days. The
// rendered headings are checked in a browser: e2e/data-table.spec.ts, on
// the app/DataTable Grouped story.
import { describe, expect, it } from 'vitest'
import { groupRuns } from '../src/components/app/table-groups'
import { byDay } from '../src/lib/group-by-day'

type Item = { at: string | null }

function labels(group: (row: Item) => { label: string }, ...ats: (string | null)[]) {
  return ats.map((at) => group({ at }).label)
}

describe('byDay', () => {
  // Thursday 15 Oct 2026, 11:00 in London (BST, UTC+1). Its week began Monday the 12th.
  const london = byDay<Item>('at', { now: new Date('2026-10-15T10:00:00Z'), timeZone: 'Europe/London' })

  it('names the recent days, then the week, then the month', () => {
    expect(
      labels(
        london,
        '2026-10-15T08:00:00Z',
        '2026-10-14T12:00:00Z',
        '2026-10-12T09:00:00Z',
        '2026-10-11T12:00:00Z',
        '2026-09-14T12:00:00Z',
        '2026-09-13T12:00:00Z',
        '2026-01-05T12:00:00Z',
        '2025-12-10T12:00:00Z',
      ),
    ).toEqual([
      'Today',
      'Yesterday',
      'Earlier this week',
      'Week of 5 Oct',
      // Four weeks before this one are weeks; earlier is a month.
      `Week of ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date('2026-09-14T00:00:00Z'))}`,
      'September',
      'January',
      'December 2025',
    ])
  })

  it("counts days in the zone, not in UTC", () => {
    // 23:30 UTC on the 14th is 00:30 on the 15th in London.
    expect(labels(london, '2026-10-14T23:30:00Z', '2026-10-14T22:59:00Z')).toEqual(['Today', 'Yesterday'])
  })

  it('puts a later date under Upcoming and a missing or broken one under No date', () => {
    expect(labels(london, '2026-10-16T12:00:00Z', null, '', 'not a date')).toEqual([
      'Upcoming',
      'No date',
      'No date',
      'No date',
    ])
  })

  it('gives each group a stable key', () => {
    expect(london({ at: '2026-10-11T12:00:00Z' }).key).toBe('week:2026-10-05')
    expect(london({ at: '2026-09-13T12:00:00Z' }).key).toBe('month:2026-09')
    expect(london({ at: '2026-10-15T08:00:00Z' }).key).toBe('today')
  })

  it('keeps days whole across a daylight saving change', () => {
    // Monday 2 Nov 2026, 10:00 in Los Angeles; summer time ended at 02:00 on Sunday the 1st.
    const la = byDay<Item>('at', { now: new Date('2026-11-02T18:00:00Z'), timeZone: 'America/Los_Angeles' })
    expect(
      labels(
        la,
        '2026-11-02T08:00:00Z', // 00:00 PST Monday
        '2026-11-02T07:59:00Z', // 23:59 PST Sunday
        '2026-11-01T08:30:00Z', // 01:30 PDT Sunday
        '2026-11-01T06:30:00Z', // 23:30 PDT Saturday the 31st
      ),
    ).toEqual(['Today', 'Yesterday', 'Yesterday', 'Week of 26 Oct'])
  })

  it('crosses the year by weeks, then names the year with the month', () => {
    // Tuesday 5 Jan 2027, UTC.
    const january = byDay<Item>('at', { now: new Date('2027-01-05T12:00:00Z'), timeZone: 'UTC' })
    expect(labels(january, '2027-01-03T12:00:00Z', '2026-12-08T12:00:00Z', '2026-12-01T12:00:00Z')).toEqual([
      'Week of 28 Dec',
      'Week of 7 Dec',
      'December 2026',
    ])
  })

  it('starts weeks on Sunday when asked', () => {
    const sunday = byDay<Item>('at', { now: new Date('2026-10-15T12:00:00Z'), timeZone: 'UTC', weekStartsOn: 0 })
    expect(labels(sunday, '2026-10-11T12:00:00Z', '2026-10-10T12:00:00Z')).toEqual(['Earlier this week', 'Week of 4 Oct'])
  })

  it('reads the date through a function', () => {
    const group = byDay((row: { meta: { published: Date } }) => row.meta.published, {
      now: new Date('2026-10-15T12:00:00Z'),
      timeZone: 'UTC',
    })
    expect(group({ meta: { published: new Date('2026-10-15T01:00:00Z') } }).label).toBe('Today')
  })
})

describe('groupRuns', () => {
  const byLetter = (word: string) => ({ key: word[0], label: word[0].toUpperCase() })

  it('starts a group wherever the key changes, keeping the order', () => {
    expect(groupRuns(['apple', 'avocado', 'banana', 'blueberry', 'cherry'], byLetter)).toEqual([
      { key: 'a', label: 'A', rows: ['apple', 'avocado'] },
      { key: 'b', label: 'B', rows: ['banana', 'blueberry'] },
      { key: 'c', label: 'C', rows: ['cherry'] },
    ])
  })

  it('heads a key that comes back again rather than moving its rows', () => {
    expect(groupRuns(['apple', 'banana', 'apricot'], byLetter).map((run) => run.rows)).toEqual([
      ['apple'],
      ['banana'],
      ['apricot'],
    ])
  })

  it('has no groups without rows', () => {
    expect(groupRuns([], byLetter)).toEqual([])
  })
})
