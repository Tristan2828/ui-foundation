import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { deltaE, DEUTERANOPIA, linearRgb, type Oklch, PROTANOPIA, type Rgb, simulate } from './colour-measure'

// The categorical slots (theme.css "Categorical slots") are only worth
// having while each looks different from every other. Contrast is measured
// in Storybook (the glyph check); this measures distinctness, which nothing
// in a browser does: the perceived difference (CIEDE2000 ΔE) between every
// pair of slots, in each theme, from the values theme.css declares.
const css = readFileSync(new URL('../styles/theme.css', import.meta.url), 'utf-8')
const tailwind = readFileSync(new URL('../styles/index.css', import.meta.url), 'utf-8')

// The closest pair is 17.9 (#108). The hue-spaced slots before them got to
// 8.8, two blues 25° apart, which users couldn't tell apart in a table: a
// slot closer than 15 to another is a second name for a colour already there.
const MIN_DELTA_E = 15
// The first few slots are what a small set uses, so they also stay apart
// for readers with deuteranopia or protanopia (simulated). Past six, twelve
// colours can't all stay apart for them; the glyph carries the meaning.
const CVD_FIRST = 6
const MIN_CVD_DELTA_E = 10

function primitives(shade: '700' | '400'): Map<number, Oklch> {
  const slots = new Map<number, Oklch>()
  for (const m of css.matchAll(/--category-(\d+)-(\d+):\s*oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/g)) {
    if (m[2] !== shade) continue
    slots.set(Number(m[1]), { l: Number(m[3]), c: Number(m[4]), h: Number(m[5]) })
  }
  return slots
}

function closerThan(slots: Map<number, Rgb>, min: number) {
  const tooClose: string[] = []
  for (const [a, x] of slots)
    for (const [b, y] of slots) {
      if (a >= b) continue
      const d = deltaE(x, y)
      if (d < min) tooClose.push(`${a} and ${b}: ${d.toFixed(1)}`)
    }
  return tooClose
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
    const rgb = new Map([...slots].map(([n, c]) => [n, linearRgb(c)]))

    it(`declares every slot inside sRGB (${theme})`, () => {
      const outside = [...rgb].filter(([, c]) => c.some((v) => v < -0.001 || v > 1.001)).map(([n]) => n)
      expect(outside).toEqual([])
    })

    it(`keeps every pair of slots at least ΔE ${MIN_DELTA_E} apart (${theme})`, () => {
      expect(closerThan(rgb, MIN_DELTA_E)).toEqual([])
    })

    for (const [name, matrix] of Object.entries({ deuteranopia: DEUTERANOPIA, protanopia: PROTANOPIA })) {
      it(`keeps the first ${CVD_FIRST} slots at least ΔE ${MIN_CVD_DELTA_E} apart with ${name} (${theme})`, () => {
        const first = new Map([...rgb].filter(([n]) => n <= CVD_FIRST).map(([n, c]) => [n, simulate(c, matrix)]))
        expect(closerThan(first, MIN_CVD_DELTA_E)).toEqual([])
      })
    }
  }
})
