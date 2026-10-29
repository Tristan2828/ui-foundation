// A remembered flag's fallback (src/hooks/use-remembered-flag.ts), which
// WidgetCard's `defaultCollapsed` is: used until the flag is set, and
// where storage is blocked. The rest of the store's rules are
// tests/use-muted.test.ts's.
import { describe, expect, it } from 'vitest'
import { createFlagStore } from '../src/hooks/use-remembered-flag'

const blocked = {
  getItem(): string | null {
    throw new DOMException('Blocked', 'SecurityError')
  },
  setItem() {
    throw new DOMException('Blocked', 'SecurityError')
  },
}

describe('createFlagStore fallback', () => {
  it('is the fallback until set, then what was set, either way', () => {
    const items = new Map<string, string>()
    const store = createFlagStore(() => ({ getItem: (key) => items.get(key) ?? null, setItem: (key, value) => void items.set(key, value) }))
    expect(store.get('hub.waiting:collapsed', true)).toBe(true)
    store.set('hub.waiting:collapsed', false)
    expect(store.get('hub.waiting:collapsed', true)).toBe(false)
    expect(items.get('hub.waiting:collapsed')).toBe('false')
  })

  it('is the fallback where storage is blocked, until the page sets it', () => {
    const store = createFlagStore(() => blocked)
    expect(store.get('k', true)).toBe(true)
    store.set('k', false)
    expect(store.get('k', true)).toBe(false)
  })
})
