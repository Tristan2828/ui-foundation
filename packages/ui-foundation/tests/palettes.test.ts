// The device's saved palette (src/lib/palettes.ts) against fake
// storage: read back only when it names a palette, kept in memory when
// storage throws, and a change from another tab replaces what this page
// held. The shell's picker in a browser is e2e/palettes.spec.ts.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createPaletteStore, isPaletteName, PALETTE_LABELS, PALETTE_STORAGE_KEY, PALETTES } from '../src/lib/palettes'

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

describe('createPaletteStore', () => {
  it('has no choice until one is saved, and reads back a saved palette', () => {
    expect(createPaletteStore(() => fakeStorage()).get()).toBeNull()
    const storage = fakeStorage({ [PALETTE_STORAGE_KEY]: 'violet' })
    expect(createPaletteStore(() => storage).get()).toBe('violet')
  })

  it('ignores a saved value that names no palette', () => {
    const storage = fakeStorage({ [PALETTE_STORAGE_KEY]: 'tangerine' })
    expect(createPaletteStore(() => storage).get()).toBeNull()
  })

  it('saves the choice and tells its subscribers', () => {
    const storage = fakeStorage()
    const store = createPaletteStore(() => storage)
    let heard = 0
    store.subscribe(() => (heard += 1))
    store.set('indigo-rose')
    expect(storage.items.get(PALETTE_STORAGE_KEY)).toBe('indigo-rose')
    expect(store.get()).toBe('indigo-rose')
    expect(heard).toBe(1)
  })

  it('keeps the choice for the page when storage is blocked', () => {
    const store = createPaletteStore(() => blocked)
    expect(store.get()).toBeNull()
    store.set('graphite-periwinkle')
    expect(store.get()).toBe('graphite-periwinkle')
  })

  it('a change in another tab replaces what this page held', () => {
    const storage = fakeStorage()
    const store = createPaletteStore(() => storage)
    store.set('violet')
    storage.items.set(PALETTE_STORAGE_KEY, 'indigo-cyan')
    store.changedElsewhere()
    expect(store.get()).toBe('indigo-cyan')
  })
})

describe('the palettes', () => {
  it('each has a label, and isPaletteName knows exactly the four', () => {
    expect(Object.keys(PALETTE_LABELS)).toEqual([...PALETTES])
    for (const name of PALETTES) expect(isPaletteName(name)).toBe(true)
    expect(isPaletteName('light')).toBe(false)
    expect(isPaletteName(undefined)).toBe(false)
  })

  // Each palette's block in theme.css sets the same tokens, and each
  // primitive it reads exists: a palette missing one would show .dark's
  // grey in its place, and a misspelt primitive would paint nothing.
  const css = readFileSync(new URL('../styles/theme.css', import.meta.url), 'utf-8')
  const block = (name: string) => {
    const start = css.indexOf(`.dark[data-palette="${name}"] {`)
    if (start === -1) throw new Error(`theme.css has no block for ${name}`)
    return css.slice(start, css.indexOf('\n}', start))
  }
  const tokens = (text: string) => [...text.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1])

  it('every palette block sets the same tokens', () => {
    const first = tokens(block(PALETTES[0]))
    expect(first.length).toBeGreaterThan(20)
    for (const name of PALETTES) expect(tokens(block(name)), name).toEqual(first)
  })

  it('every primitive a block reads is declared', () => {
    const declared = new Set(tokens(css))
    for (const name of PALETTES) {
      const used = [...block(name).matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1])
      expect(used.filter((token) => !declared.has(token)), name).toEqual([])
      // And only its own palette's primitives, or the shared status ones.
      expect(used.filter((token) => token.startsWith('--palette-') && !token.startsWith(`--palette-${name}-`) && !/^--palette-(success|warning|danger)$/.test(token)), name).toEqual([])
    }
  })

  it('the swatches in the shell read primitives every palette has', () => {
    for (const name of PALETTES) {
      for (const part of ['background', 'accent', 'second']) expect(css).toContain(`--palette-${name}-${part}:`)
    }
  })
})
