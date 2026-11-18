// A save started as the page goes asks the browser to finish it
// (`keepalive`) when its body fits the budget (src/lib/page-leaving.ts, F13).
import { afterEach, describe, expect, it } from 'vitest'
import { KEEPALIVE_MAX_BYTES, clearPageLeaving, keepaliveFor, markPageLeaving } from '../src/lib/page-leaving'

describe('keepalive while the page is leaving', () => {
  afterEach(() => clearPageLeaving())

  it('a save started just after the page starts leaving is kept alive', () => {
    markPageLeaving(1_000)
    expect(keepaliveFor('{"notes":"One"}', 1_500)).toBe(true)
  })

  it('not before the page leaves, nor long after (negative control)', () => {
    expect(keepaliveFor('{"notes":"One"}', 1_500)).toBe(false)
    markPageLeaving(1_000)
    expect(keepaliveFor('{"notes":"One"}', 10_000)).toBe(false)
  })

  it('a long note over the budget goes as an ordinary request', () => {
    markPageLeaving(1_000)
    expect(keepaliveFor(JSON.stringify({ notes: 'x'.repeat(KEEPALIVE_MAX_BYTES) }), 1_100)).toBe(false)
    expect(keepaliveFor(undefined, 1_100)).toBe(false)
  })
})
