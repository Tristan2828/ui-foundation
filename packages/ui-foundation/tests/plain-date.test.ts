// formatPlainDate (src/lib/plain-date.ts): a calendar day shown
// as itself, whatever zone the code runs in.
import { describe, expect, it } from 'vitest'
import { formatPlainDate } from '../src/lib/plain-date'

describe('formatPlainDate', () => {
  it('shows the day as written, never shifted by the zone', () => {
    expect(formatPlainDate('2026-09-02', undefined, 'en-US')).toBe('Sep 2, 2026')
    expect(formatPlainDate('2026-01-01', undefined, 'en-US')).toBe('Jan 1, 2026')
    expect(formatPlainDate('2026-12-31', { day: 'numeric', month: 'long' }, 'en-GB')).toBe('31 December')
  })

  it('gives an empty string for not set and for anything that is not a real day', () => {
    expect(formatPlainDate('')).toBe('')
    expect(formatPlainDate('2026-02-30')).toBe('')
    expect(formatPlainDate('2026-9-2')).toBe('')
    expect(formatPlainDate('2026-09-02T00:00:00Z')).toBe('')
  })
})
