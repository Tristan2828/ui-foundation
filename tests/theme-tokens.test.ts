import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Phase 5 exit criteria (docs/BUILD-PLAN.md): every semantic (layer 2) token
// in theme.css must be defined in both the light (:root) and dark (.dark)
// blocks, so a token added to one and forgotten in the other — the exact
// way a component silently loses its dark-mode value — fails verify instead
// of waiting for someone to notice a screenshot.
const THEME_CSS_PATH = new URL('../src/styles/theme.css', import.meta.url)

// --radius is layer 2 (component-facing) but not color-valued, so it has no
// dark counterpart to remap — the only intentional asymmetry between the
// two blocks. Layer 1 primitives (--gray-500, --red-400, ...) are excluded
// by only scanning tokens declared after the "Layer 2 — semantic" marker.
const NON_COLOR_SEMANTIC_TOKENS = new Set(['--radius'])

function extractBlock(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`theme.css has no "${selector} {" block`)
  const end = css.indexOf('\n}', start)
  return css.slice(start, end)
}

function semanticTokenNames(block: string): Set<string> {
  const layer2Start = block.indexOf('Layer 2')
  const scanned = layer2Start === -1 ? block : block.slice(layer2Start)
  const names = [...scanned.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1])
  return new Set(names)
}

describe('theme.css semantic token parity', () => {
  const css = readFileSync(THEME_CSS_PATH, 'utf-8')
  const light = semanticTokenNames(extractBlock(css, ':root'))
  const dark = semanticTokenNames(extractBlock(css, '.dark'))

  it('defines at least one semantic token in each block', () => {
    expect(light.size).toBeGreaterThan(0)
    expect(dark.size).toBeGreaterThan(0)
  })

  it('defines every color semantic token in both :root and .dark', () => {
    const lightColor = [...light].filter((t) => !NON_COLOR_SEMANTIC_TOKENS.has(t))
    const missingFromDark = lightColor.filter((t) => !dark.has(t))
    const missingFromLight = [...dark].filter((t) => !lightColor.includes(t))

    expect(missingFromDark, 'tokens in :root but missing from .dark').toEqual([])
    expect(missingFromLight, 'tokens in .dark but missing from :root').toEqual([])
  })
})
