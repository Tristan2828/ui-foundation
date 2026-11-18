// A list's date filter (src/lib/date-filter.ts, 4.110): one string a URL
// and a saved view can hold, read against today for the query.
import { describe, expect, it } from 'vitest'
import { activeViewOf, viewToUrlChanges } from '../src/hooks/table-url-changes'
import {
  dateFilterKeeps,
  dateFilterText,
  dateRangeValue,
  parseDateFilter,
  resolveDateFilter,
} from '../src/lib/date-filter'

const TODAY = '2026-11-13'

describe('parseDateFilter', () => {
  it('reads the presets, a range and open ranges', () => {
    expect(parseDateFilter('before-today')).toEqual({ preset: 'before-today' })
    expect(parseDateFilter('from-today')).toEqual({ preset: 'from-today' })
    expect(parseDateFilter('2026-11-01..2026-11-30')).toEqual({ range: { from: '2026-11-01', to: '2026-11-30' } })
    expect(parseDateFilter('2026-11-01..')).toEqual({ range: { from: '2026-11-01' } })
    expect(parseDateFilter('..2026-11-30')).toEqual({ range: { to: '2026-11-30' } })
  })

  it("is null for no filter and for what isn't one", () => {
    for (const value of ['', '..', 'soon', '2026-11-01', '2026-02-30..', 'yesterday..']) expect(parseDateFilter(value)).toBeNull()
  })
})

describe('dateRangeValue', () => {
  it('writes both ends, an open one left out, and nothing for neither', () => {
    expect(dateRangeValue({ from: '2026-11-01', to: '2026-11-30' })).toBe('2026-11-01..2026-11-30')
    expect(dateRangeValue({ to: '2026-11-30' })).toBe('..2026-11-30')
    expect(dateRangeValue({})).toBe('')
  })
})

describe('resolveDateFilter', () => {
  it('reads the presets against today, as inclusive days', () => {
    expect(resolveDateFilter('before-today', TODAY)).toEqual({ to: '2026-11-12' })
    expect(resolveDateFilter('today', TODAY)).toEqual({ from: TODAY, to: TODAY })
    expect(resolveDateFilter('from-today', TODAY)).toEqual({ from: TODAY })
    // Across a month and a year.
    expect(resolveDateFilter('before-today', '2027-01-01')).toEqual({ to: '2026-12-31' })
  })

  it("gives a range as written, and null for none", () => {
    expect(resolveDateFilter('2026-11-01..2026-11-30', TODAY)).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(resolveDateFilter('', TODAY)).toBeNull()
  })
})

describe('dateFilterKeeps', () => {
  it('keeps the days inside, both ends included', () => {
    expect(dateFilterKeeps('before-today', '2026-11-12', TODAY)).toBe(true)
    expect(dateFilterKeeps('before-today', TODAY, TODAY)).toBe(false)
    expect(dateFilterKeeps('from-today', TODAY, TODAY)).toBe(true)
    expect(dateFilterKeeps('from-today', '2026-11-12', TODAY)).toBe(false)
    expect(dateFilterKeeps('2026-11-01..2026-11-30', '2026-11-30', TODAY)).toBe(true)
    expect(dateFilterKeeps('2026-11-01..2026-11-30', '2026-12-01', TODAY)).toBe(false)
  })

  it('keeps everything with no filter, and no day once there is one', () => {
    expect(dateFilterKeeps('', '', TODAY)).toBe(true)
    expect(dateFilterKeeps('from-today', '', TODAY)).toBe(false)
  })
})

describe('dateFilterText', () => {
  it("is the chip's words", () => {
    expect(dateFilterText('before-today')).toBe('Before today')
    expect(dateFilterText('2026-11-01..2026-11-30', undefined, 'en-US')).toBe('Nov 1, 2026 – Nov 30, 2026')
    expect(dateFilterText('2026-11-01..', undefined, 'en-US')).toBe('From Nov 1, 2026')
    expect(dateFilterText('..2026-11-30', undefined, 'en-US')).toBe('Until Nov 30, 2026')
    expect(dateFilterText('')).toBe('')
  })
})

describe('a view that sets a date filter', () => {
  const views = {
    overdue: { filters: { due: 'before-today' } },
    upcoming: { filters: { due: 'from-today' } },
  }
  it('writes the preset to the URL, and is on while the filter holds it', () => {
    expect(viewToUrlChanges(['due'], [], views.overdue)).toMatchObject({ due: 'before-today' })
    expect(activeViewOf(views, { due: 'before-today' }, {})).toBe('overdue')
    expect(activeViewOf(views, { due: '2026-11-01..' }, {})).toBeNull()
  })
})
