// A table's scroll box in written text (src/components/app/prose-table-scroll.ts):
// a tab stop and a named region only while the table overflows it, its
// name from the header row. No ResizeObserver here, so each check is
// called by hand; e2e/rich-text-editor.spec.ts "table scroll" checks the
// real thing, the observers included.
import { describe, expect, it } from 'vitest'
import { tableScrollName, watchTableScroll } from '../src/components/app/prose-table-scroll'

// As much of an element as the box uses: its widths and its attributes.
function fakeBox(scrollWidth: number, clientWidth: number) {
  const attributes = new Map<string, string>()
  let writes = 0
  return {
    scrollWidth,
    clientWidth,
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => {
      writes++
      attributes.set(name, value)
    },
    removeAttribute: (name: string) => {
      writes++
      attributes.delete(name)
    },
    attributes,
    writes: () => writes,
  }
}

describe('tableScrollName', () => {
  it('says what it is and which table: its first columns', () => {
    expect(tableScrollName(['Item', 'Count'])).toBe('Table, scrolls sideways: Item, Count')
    expect(tableScrollName(['Item', 'Size', 'Colour', 'Material'])).toBe('Table, scrolls sideways: Item, Size, Colour, …')
  })

  it('skips empty headers and tidies spaces; with none, the phrase alone', () => {
    expect(tableScrollName([' Item ', '', 'Two\n words'])).toBe('Table, scrolls sideways: Item, Two words')
    expect(tableScrollName(['', ' '])).toBe('Table, scrolls sideways')
    expect(tableScrollName([])).toBe('Table, scrolls sideways')
  })
})

describe('watchTableScroll', () => {
  it('makes an overflowing box a named region and a tab stop', () => {
    const box = fakeBox(800, 500)
    watchTableScroll(box, null, ['Item', 'Count'])
    expect(Object.fromEntries(box.attributes)).toEqual({
      tabindex: '0',
      role: 'region',
      'aria-label': 'Table, scrolls sideways: Item, Count',
    })
  })

  it('leaves a box whose table fits alone, and takes it all off once the table fits again', () => {
    const box = fakeBox(500, 500)
    const region = watchTableScroll(box, null, ['Item'])
    expect(box.attributes.size).toBe(0)
    box.scrollWidth = 900
    region.check()
    expect(box.attributes.get('role')).toBe('region')
    box.scrollWidth = 500
    region.check()
    expect(box.attributes.size).toBe(0)
  })

  it('renames it when the columns change, and writes nothing when nothing did', () => {
    const box = fakeBox(800, 500)
    const region = watchTableScroll(box, null, ['Item'])
    const writes = box.writes()
    region.check()
    expect(box.writes()).toBe(writes)
    region.setColumns(['Part', 'Count'])
    expect(box.attributes.get('aria-label')).toBe('Table, scrolls sideways: Part, Count')
    region.destroy()
  })
})
