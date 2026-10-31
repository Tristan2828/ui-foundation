// The fold store (src/hooks/fold-store.ts): what's folded under a key,
// kept in storage as a list of ids, the same set object until it changes,
// and kept in memory where storage is blocked.
import { describe, expect, it } from 'vitest'
import { createFoldStore } from '../src/hooks/fold-store'

function storage(items = new Map<string, string>()) {
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

describe('createFoldStore', () => {
  it('reads and writes a JSON list of ids, and forgets the key once nothing is folded', () => {
    const fake = storage(new Map([['notes', '["2:Beds"]']]))
    const store = createFoldStore(() => fake)
    expect([...store.get('notes')]).toEqual(['2:Beds'])
    store.set('notes', new Set(['2:Beds', '1:Plan']))
    expect(fake.items.get('notes')).toBe('["2:Beds","1:Plan"]')
    store.set('notes', new Set())
    expect(fake.items.has('notes')).toBe(false)
  })

  it('returns the same set until it changes, and tells its listeners when it does', () => {
    const store = createFoldStore(() => storage())
    const first = store.get('notes')
    expect(store.get('notes')).toBe(first)
    let heard = 0
    const stop = store.subscribe('notes', () => heard++)
    store.set('notes', new Set(['a']))
    expect(store.get('notes')).not.toBe(first)
    expect(heard).toBe(1)
    stop()
    store.set('notes', new Set())
    expect(heard).toBe(1)
  })

  it('ignores what it cannot read', () => {
    const store = createFoldStore(() =>
      storage(
        new Map([
          ['a', 'not json'],
          ['b', '{"x":1}'],
          ['c', '["ok",3]'],
        ]),
      ),
    )
    expect(store.get('a').size).toBe(0)
    expect(store.get('b').size).toBe(0)
    expect([...store.get('c')]).toEqual(['ok'])
  })

  it('keeps the set in memory where storage is blocked', () => {
    const blocked = () => {
      throw new DOMException('Blocked', 'SecurityError')
    }
    const store = createFoldStore(() => ({ getItem: blocked, setItem: blocked, removeItem: blocked }))
    expect(store.get('k').size).toBe(0)
    store.set('k', new Set(['x']))
    expect([...store.get('k')]).toEqual(['x'])
  })

  it('re-reads a key another tab changed', () => {
    const fake = storage()
    const store = createFoldStore(() => fake)
    expect(store.get('k').size).toBe(0)
    fake.items.set('k', '["y"]')
    let heard = 0
    store.subscribe('k', () => heard++)
    store.changedElsewhere('k')
    expect(heard).toBe(1)
    expect([...store.get('k')]).toEqual(['y'])
  })
})
