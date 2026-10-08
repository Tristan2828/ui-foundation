import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The categorical slots (theme.css "Categorical slots") are only worth
// having while each looks different from every other. Contrast is measured
// in Storybook (the glyph check); this measures distinctness, which nothing
// in a browser does: the OKLab distance between every pair of slots, in
// each theme, from the values theme.css declares.
const css = readFileSync(new URL('../styles/theme.css', import.meta.url), 'utf-8')
const tailwind = readFileSync(new URL('../styles/index.css', import.meta.url), 'utf-8')

// The closest pair the first eight slots had when slots 9-12 were added
// (1 and 8 in dark, 0.052). A new slot may not sit closer than that to any
// other: a slot that does is a second name for a colour already there.
const MIN_DISTANCE = 0.05

type Oklch = { l: number; c: number; h: number }

function primitives(shade: '700' | '400'): Map<number, Oklch> {
  const slots = new Map<number, Oklch>()
  for (const m of css.matchAll(/--category-(\d+)-(\d+):\s*oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/g)) {
    if (m[2] !== shade) continue
    slots.set(Number(m[1]), { l: Number(m[3]), c: Number(m[4]), h: Number(m[5]) })
  }
  return slots
}

function distance(a: Oklch, b: Oklch) {
  const lab = ({ l, c, h }: Oklch) => [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)]
  const [p, q] = [lab(a), lab(b)]
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

describe('categorical slots', () => {
  // Light mode uses each slot's -700, dark its -400.
  const themes = { light: primitives('700'), dark: primitives('400') }

  it('has twelve slots, numbered 1-12, in both themes and as Tailwind colours', () => {
    const numbers = Array.from({ length: 12 }, (_, i) => i + 1)
    for (const slots of Object.values(themes)) expect([...slots.keys()].sort((a, b) => a - b)).toEqual(numbers)
    for (const n of numbers) {
      expect(css).toContain(`--category-${n}: var(--category-${n}-700);`)
      expect(css).toContain(`--category-${n}: var(--category-${n}-400);`)
      expect(tailwind).toContain(`--color-category-${n}: var(--category-${n});`)
    }
  })

  for (const [theme, slots] of Object.entries(themes)) {
    it(`keeps every pair of slots at least ${MIN_DISTANCE} apart (${theme})`, () => {
      const tooClose: string[] = []
      for (const [a, x] of slots)
        for (const [b, y] of slots) {
          if (a >= b) continue
          const d = distance(x, y)
          if (d < MIN_DISTANCE) tooClose.push(`${a} and ${b}: ${d.toFixed(3)}`)
        }
      expect(tooClose).toEqual([])
    })
  }
})
