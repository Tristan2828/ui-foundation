// The large densities' tokens in theme.css. extra-large has to set every
// token large sets: one set in only one of them would leave that part of
// the screen at the wrong size, and nothing else checks it. What they do to
// a real layout is measured in a browser (e2e/density.spec.ts,
// e2e/fixtures-visual.spec.ts).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../styles/theme.css', import.meta.url), 'utf-8')

function tokens(density: string) {
  const start = css.indexOf(`[data-density="${density}"] {`)
  expect(start, density).toBeGreaterThan(-1)
  const block = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  return new Map([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name!, value!.trim()]))
}

const px = (value: string | undefined) => {
  expect(value, 'a literal in rem').toMatch(/^[\d.]+rem$/)
  return parseFloat(value!) * 16
}

const large = tokens('large')
const extraLarge = tokens('extra-large')

describe('the large densities', () => {
  it('set the same tokens', () => {
    expect(large.size).toBeGreaterThan(20)
    expect([...extraLarge.keys()]).toEqual([...large.keys()])
  })

  it('make each token larger at extra-large, by its own step of the scale', () => {
    for (const [name, value] of large) {
      const ratio = px(extraLarge.get(name)) / px(value)
      // Between 8% and 15%: the picked sizes are 11 to 13%, the rest is
      // rounding to a pixel.
      expect(ratio, name).toBeGreaterThan(1.08)
      expect(ratio, name).toBeLessThanOrEqual(1.15)
    }
  })

  it('keep the sizes the scale is set by', () => {
    const sizes = (of: Map<string, string>) =>
      ['--spacing', '--text-sm', '--type-body-size', '--text-xs', '--type-caption-size'].map((name) => px(of.get(name)))
    const [spacing, ...text] = sizes(extraLarge)
    expect(spacing).toBeCloseTo(5.6, 5)
    expect(text).toEqual([20, 20, 17, 17])
    expect(sizes(large)).toEqual([5, 18, 18, 15, 15])
  })

  // Equal specificity, so the order decides when one element matches two.
  it('come after the table-only densities', () => {
    const at = (density: string) => css.indexOf(`[data-density="${density}"] {`)
    expect(at('comfortable')).toBeLessThan(at('large'))
    expect(at('large')).toBeLessThan(at('extra-large'))
  })
})
