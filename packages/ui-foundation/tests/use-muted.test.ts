// The remembered mute (src/hooks/use-muted.ts) against fake storage:
// read back per key, kept in memory when storage throws, and a change from
// another tab replaces what this page held.
import { describe, expect, it } from 'vitest'
import { createMutedStore } from '../src/hooks/use-muted'

function fakeStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial))
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  }
}

const blocked = {
  getItem(): string | null {
    throw new DOMException('Blocked', 'SecurityError')
  },
  setItem() {
    throw new DOMException('Blocked', 'SecurityError')
  },
}

describe('createMutedStore', () => {
  it('is unmuted until set, and reads back what storage holds per key', () => {
    const storage = fakeStorage({ 'app:timer:muted': 'true' })
    const store = createMutedStore(() => storage)
    expect(store.get('app:timer:muted')).toBe(true)
    expect(store.get('app:player:muted')).toBe(false)
  })

  it('writes the choice to storage and tells that key’s subscribers only', () => {
    const storage = fakeStorage()
    const store = createMutedStore(() => storage)
    const heard: string[] = []
    store.subscribe('a', () => heard.push('a'))
    store.subscribe('b', () => heard.push('b'))
    store.set('a', true)
    expect(storage.items.get('a')).toBe('true')
    expect(heard).toEqual(['a'])
  })

  it('keeps working in memory where storage throws', () => {
    const store = createMutedStore(() => blocked)
    expect(store.get('k')).toBe(false)
    store.set('k', true)
    expect(store.get('k')).toBe(true)
  })

  it('keeps working where there is no storage at all', () => {
    const store = createMutedStore(() => undefined)
    store.set('k', true)
    expect(store.get('k')).toBe(true)
  })

  it("ignores a value it didn't write", () => {
    const store = createMutedStore(() => fakeStorage({ k: 'yes' }))
    expect(store.get('k')).toBe(false)
  })

  it('a change from another tab replaces what this page held', () => {
    const storage = fakeStorage()
    const store = createMutedStore(() => storage)
    store.set('k', true)
    let heard = 0
    store.subscribe('k', () => heard++)
    storage.items.set('k', 'false')
    store.changedElsewhere('k')
    expect(store.get('k')).toBe(false)
    expect(heard).toBe(1)
  })
})
