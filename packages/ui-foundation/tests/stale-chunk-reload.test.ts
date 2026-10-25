// Reloading onto a new build when a lazy chunk is gone (src/lib/
// stale-chunk-reload.ts, #206): the first `vite:preloadError` reloads once
// and is handled, a second within the window is let through to the error
// boundary, and without storage to remember the reload nothing reloads.
import { describe, expect, it } from 'vitest'
import { createStaleChunkReload } from '../src/lib/stale-chunk-reload'

function fakeStorage() {
  const items = new Map<string, string>()
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) }
}

// `storage: null` is a browser with none (blocked, or a sandboxed frame).
function setUp({
  storage = fakeStorage(),
  at = { now: 1_000_000 },
}: { storage?: Pick<Storage, 'getItem' | 'setItem'> | null; at?: { now: number } } = {}) {
  let reloads = 0
  const target = new EventTarget()
  const make = () =>
    createStaleChunkReload({ storage: () => storage ?? undefined, reload: () => void reloads++, now: () => at.now })
  const page = make()
  const uninstall = page.install(target)
  const fail = () => {
    const event = new Event('vite:preloadError', { cancelable: true })
    target.dispatchEvent(event)
    return event.defaultPrevented
  }
  return { page, fail, uninstall, make, target, at, get reloads() { return reloads } }
}

describe('createStaleChunkReload', () => {
  it('reloads once on a missing chunk and handles the error, so the screen does not crash', () => {
    const t = setUp()
    expect(t.page.isReloading()).toBe(false)
    expect(t.fail()).toBe(true)
    expect(t.reloads).toBe(1)
    expect(t.page.isReloading()).toBe(true)
    // Another chunk failing before the page goes is part of the same reload.
    expect(t.fail()).toBe(true)
    expect(t.reloads).toBe(1)
  })

  it('lets a second failure soon after the reload through: the file is missing from the new build too', () => {
    const storage = fakeStorage()
    const at = { now: 1_000_000 }
    const before = setUp({ storage, at })
    before.fail()
    // The page after the reload: a fresh instance over the same session storage.
    at.now += 5_000
    const after = setUp({ storage, at })
    expect(after.fail()).toBe(false)
    expect(after.reloads).toBe(0)
    expect(after.page.isReloading()).toBe(false)
  })

  it('reloads again once the last reload is outside the window (a later deploy)', () => {
    const storage = fakeStorage()
    const at = { now: 1_000_000 }
    setUp({ storage, at }).fail()
    at.now += 60_000
    const later = setUp({ storage, at })
    expect(later.fail()).toBe(true)
    expect(later.reloads).toBe(1)
  })

  it('never reloads where it cannot remember the reload, so it cannot loop', () => {
    const blocked = setUp({ storage: null })
    expect(blocked.fail()).toBe(false)
    const throwing = setUp({
      storage: { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError') } },
    })
    expect(throwing.fail()).toBe(false)
    expect(blocked.reloads + throwing.reloads).toBe(0)
  })

  it('stops listening once uninstalled', () => {
    const t = setUp()
    t.uninstall()
    expect(t.fail()).toBe(false)
    expect(t.reloads).toBe(0)
  })
})
