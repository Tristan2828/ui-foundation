// This device's table rows (src/lib/rows.ts) against fake storage, and the
// regular rows' tokens in theme.css. The store's other rules (blocked
// storage, another tab) are the palette's, in tests/palettes.test.ts. The
// shell's menu in a browser is e2e/palettes.spec.ts.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createRowsStore, isRowsName, ROWS, ROWS_LABELS, ROWS_STORAGE_KEY } from '../src/lib/rows'

function fakeStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial))
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  }
}

describe('createRowsStore', () => {
  it('has no choice until one is saved, and reads back a saved one under its own key', () => {
    expect(createRowsStore(() => fakeStorage()).get()).toBeNull()
    const storage = fakeStorage({ [ROWS_STORAGE_KEY]: 'regular', 'ui-foundation:palette': 'violet' })
    expect(createRowsStore(() => storage).get()).toBe('regular')
  })

  it('ignores a saved value that names no rows', () => {
    expect(createRowsStore(() => fakeStorage({ [ROWS_STORAGE_KEY]: 'comfortable' })).get()).toBeNull()
  })

  it('saves the choice', () => {
    const storage = fakeStorage()
    const store = createRowsStore(() => storage)
    store.set('regular')
    expect(storage.items.get(ROWS_STORAGE_KEY)).toBe('regular')
    expect(store.get()).toBe('regular')
  })
})

describe('the rows', () => {
  it('are compact and regular, each with a label', () => {
    expect([...ROWS]).toEqual(['compact', 'regular'])
    expect(Object.keys(ROWS_LABELS)).toEqual([...ROWS])
    expect(isRowsName('large')).toBe(false)
  })

  // 8px around the line and a 40px header, the size before 4.63; declared
  // before the data-density blocks, so a density on the same element wins.
  it('regular sets the table tokens, ahead of data-density', () => {
    const css = readFileSync(new URL('../styles/theme.css', import.meta.url), 'utf-8')
    const start = css.indexOf('[data-rows="regular"] {')
    expect(start).toBeGreaterThan(-1)
    const block = css.slice(start, css.indexOf('}', start))
    expect(block).toContain('--table-cell-py: 0.5rem')
    expect(block).toContain('--table-head-height: 2.5rem')
    expect(start).toBeLessThan(css.indexOf('[data-density="compact"] {'))
  })
})
