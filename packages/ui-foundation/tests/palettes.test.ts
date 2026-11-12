// The device's saved palette (src/lib/palettes.ts) against fake
// storage: read back only when it names a palette, kept in memory when
// storage throws, and a change from another tab replaces what this page
// held. The shell's picker in a browser is e2e/palettes.spec.ts.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  createPaletteStore,
  isLightPaletteName,
  isPaletteName,
  LIGHT_PALETTE_LABELS,
  LIGHT_PALETTES,
  PALETTE_LABELS,
  PALETTE_STORAGE_KEY,
  paletteColorScheme,
  PALETTES,
} from '../src/lib/palettes'

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

  it('ignores a saved light palette: the picker never offers one', () => {
    const storage = fakeStorage({ [PALETTE_STORAGE_KEY]: 'palm-lcd' })
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

  it('the light palettes are their own list, with labels, and force light', () => {
    expect(Object.keys(LIGHT_PALETTE_LABELS)).toEqual([...LIGHT_PALETTES])
    expect(LIGHT_PALETTES).toEqual(['palm-lcd'])
    for (const name of LIGHT_PALETTES) {
      expect(isLightPaletteName(name)).toBe(true)
      expect(isPaletteName(name)).toBe(false)
      expect(paletteColorScheme(name)).toBe('light')
    }
    for (const name of PALETTES) {
      expect(isLightPaletteName(name)).toBe(false)
      expect(paletteColorScheme(name)).toBe('dark')
    }
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

// Palm LCD (theme.css's `[data-palette="palm-lcd"]`), the light palette:
// its block sits on :root, sets every token a dark palette's block sets
// (so nothing falls back to white or grey), plus its own glyphs and fills,
// and reads only its own primitives.
describe('the light palette', () => {
  const css = readFileSync(new URL('../styles/theme.css', import.meta.url), 'utf-8').replaceAll('\r\n', '\n')
  const tokens = (text: string) => [...text.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1])
  const block = (selector: string) => {
    const start = css.indexOf(`${selector} {`)
    if (start === -1) throw new Error(`theme.css has no ${selector} block`)
    return css.slice(start, css.indexOf('\n}', start))
  }
  const palm = block('[data-palette="palm-lcd"]')

  it('sets every token a dark palette sets, and its own slots, heat and depth steps', () => {
    const own = tokens(palm)
    expect(tokens(block(`.dark[data-palette="${PALETTES[0]}"]`)).filter((token) => !own.includes(token))).toEqual([])
    for (let n = 1; n <= 12; n++) {
      expect(own).toContain(`--category-${n}`)
      for (let d = 1; d <= 5; d++) expect(own).toContain(`--category-${n}-depth-${d}-foreground`)
    }
    for (let n = 1; n <= 5; n++) expect(own).toContain(`--heat-${n}-foreground`)
  })

  it('reads only declared primitives, and only its own', () => {
    const declared = new Set(tokens(css))
    const used = [...palm.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1])
    expect(used.filter((token) => !declared.has(token))).toEqual([])
    expect(used.filter((token) => token.startsWith('--palette-') && !token.startsWith('--palette-palm-lcd-'))).toEqual([])
  })

  it('has the parts pwa() reads', () => {
    for (const part of ['background', 'accent', 'on-accent']) expect(css).toMatch(new RegExp(`--palette-palm-lcd-${part}: #[0-9a-f]{6};`))
  })
})
