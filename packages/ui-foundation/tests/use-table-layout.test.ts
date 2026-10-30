// useTableLayout's rules (issue #252): the URL's layout, then the one
// remembered for the table, then its default, skipping any id the table
// doesn't have; and the store keeping a pick where storage refuses it.
import { describe, expect, it } from 'vitest'
import { createLayoutStore, resolveLayout } from '../src/hooks/use-table-layout'

const LAYOUTS = ['table', 'covers'] as const

describe('resolveLayout', () => {
  it("takes the URL's layout first", () => {
    expect(resolveLayout(LAYOUTS, 'table', 'covers', 'covers')).toBe('table')
  })

  it('then the remembered one, then the default', () => {
    expect(resolveLayout(LAYOUTS, null, 'covers', 'table')).toBe('covers')
    expect(resolveLayout(LAYOUTS, null, null, 'covers')).toBe('covers')
  })

  it("skips a layout the table doesn't have, in the URL or remembered", () => {
    expect(resolveLayout(LAYOUTS, 'big', 'grid', 'covers')).toBe('covers')
    expect(resolveLayout(LAYOUTS, 'big', 'table', 'covers')).toBe('table')
  })
})

describe('createLayoutStore', () => {
  it('reads and writes the storage under the key, and tells its listeners', () => {
    const held = new Map<string, string>()
    const store = createLayoutStore(() => ({ getItem: (key) => held.get(key) ?? null, setItem: (key, value) => void held.set(key, value) }))
    let told = 0
    store.subscribe('app:books:layout', () => told++)
    expect(store.get('app:books:layout')).toBeNull()
    store.set('app:books:layout', 'covers')
    expect(held.get('app:books:layout')).toBe('covers')
    expect(store.get('app:books:layout')).toBe('covers')
    expect(told).toBe(1)
  })

  it('keeps the pick for the page where storage throws', () => {
    const store = createLayoutStore(() => ({
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }))
    expect(store.get('k')).toBeNull()
    store.set('k', 'covers')
    expect(store.get('k')).toBe('covers')
  })
})
