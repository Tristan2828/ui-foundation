import { describe, expect, it } from 'vitest'
import { availableFromToDate, dateToAvailableFrom } from '../src/routes/widgets/widget-schema'

describe('availableFrom date conversion', () => {
  it('serializes a picked calendar day at UTC midnight, not local midnight', () => {
    const picked = new Date(2026, 8, 15) // September 15, 2026, local midnight
    expect(dateToAvailableFrom(picked)).toBe('2026-09-15T00:00:00.000Z')
  })

  it('round-trips a wire datetime back to the same calendar day regardless of time-of-day', () => {
    const roundTripped = availableFromToDate(dateToAvailableFrom(new Date(2026, 0, 1)))
    expect(roundTripped.getFullYear()).toBe(2026)
    expect(roundTripped.getMonth()).toBe(0)
    expect(roundTripped.getDate()).toBe(1)
  })

  it('reads the UTC calendar day out of a non-midnight wire value', () => {
    const date = availableFromToDate('2025-06-01T23:30:00Z')
    expect(date.getFullYear()).toBe(2025)
    expect(date.getMonth()).toBe(5)
    expect(date.getDate()).toBe(1)
  })
})
