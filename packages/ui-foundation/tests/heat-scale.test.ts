import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrast, deltaE, DEUTERANOPIA, hexToLinear, linearRgb, type Oklch, PROTANOPIA, type Rgb, simulate } from './colour-measure'

// The heat scale (theme.css, design-language.md "Heat scale") is measured
// here from the values theme.css declares: what a browser check can't see
// (how far apart the steps look, with and without colour blindness) and every
// step against every card. fixtures-visual.spec.ts re-measures the rendered
// fills and runs axe over the text on them.
const css = readFileSync(new URL('../styles/theme.css', import.meta.url), 'utf-8')
const tailwind = readFileSync(new URL('../styles/index.css', import.meta.url), 'utf-8')

const STEPS = [1, 2, 3, 4, 5]
const MIN_DELTA_E = 15
const MIN_CVD_DELTA_E = 10
const MIN_CONTRAST = 3
const MIN_TEXT_CONTRAST = 4.5

// Light's -700 and dark's -400; Palm LCD's are its own (--palette-palm-lcd-heat-N).
function primitives(shade: '700' | '400' | 'lcd'): Map<number, Oklch> {
  const steps = new Map<number, Oklch>()
  if (shade === 'lcd') {
    for (const m of css.matchAll(/--palette-palm-lcd-heat-(\d+):\s*oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/g))
      steps.set(Number(m[1]), { l: Number(m[2]), c: Number(m[3]), h: Number(m[4]) })
    return steps
  }
  for (const m of css.matchAll(/--heat-(\d+)-(\d+):\s*oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/g)) {
    if (m[2] !== shade) continue
    steps.set(Number(m[1]), { l: Number(m[3]), c: Number(m[4]), h: Number(m[5]) })
  }
  return steps
}
const primitiveName = (n: number, shade: string) => (shade === 'lcd' ? `--palette-palm-lcd-heat-${n}` : `--heat-${n}-${shade}`)

// A semantic block of theme.css: light's is :root's, dark's is .dark's, Palm LCD's its own.
function block(selector: ':root' | '.dark' | '[data-palette="palm-lcd"]') {
  const body = [...css.replaceAll('\r\n', '\n').matchAll(/^(:root|\.dark|\[data-palette="palm-lcd"\]) \{\n([\s\S]*?)^\}/gm)].find((m) => m[1] === selector)
  if (!body) throw new Error(`no ${selector} block`)
  return body[2]
}

const grey = (l: number): Rgb => {
  const v = l ** 3
  return [v, v, v]
}
const WHITE: Rgb = [1, 1, 1]
const BLACK = grey(0.145)
const palettePanel = (name: string, part: 'panel' | 'raised') => {
  const hex = css.match(new RegExp(`--palette-${name}-${part}: (#[0-9a-f]{6});`))?.[1]
  if (!hex) throw new Error(`no ${part} for ${name}`)
  return hexToLinear(hex)
}
const PALETTES = ['indigo-cyan', 'indigo-rose', 'graphite-periwinkle', 'violet']

const THEMES = {
  light: { shade: '700', selector: ':root', cards: { card: WHITE, muted: grey(0.97) } as Record<string, Rgb> },
  dark: {
    shade: '400',
    selector: '.dark',
    cards: {
      card: grey(0.205),
      muted: grey(0.269),
      ...Object.fromEntries(
        PALETTES.flatMap((name) => [
          [`${name} card`, palettePanel(name, 'panel')],
          [`${name} raised`, palettePanel(name, 'raised')],
        ]),
      ),
    } as Record<string, Rgb>,
  },
  // Palm LCD, the light palette: its own steps on its green.
  'palm-lcd': {
    shade: 'lcd',
    selector: '[data-palette="palm-lcd"]',
    cards: { 'palm-lcd card': palettePanel('palm-lcd', 'panel'), 'palm-lcd raised': palettePanel('palm-lcd', 'raised') } as Record<string, Rgb>,
  },
} as const

describe('heat scale', () => {
  it('has five steps in both themes, each a Tailwind colour with its foreground', () => {
    for (const { shade, selector } of Object.values(THEMES)) {
      expect([...primitives(shade).keys()].sort((a, b) => a - b)).toEqual(STEPS)
      for (const n of STEPS) {
        expect(block(selector)).toContain(`--heat-${n}: var(${primitiveName(n, shade)});`)
        expect(block(selector)).toMatch(new RegExp(`--heat-${n}-foreground: var\\(--(white|black)\\);`))
      }
    }
    for (const n of STEPS) {
      expect(tailwind).toContain(`--color-heat-${n}: var(--heat-${n});`)
      expect(tailwind).toContain(`--color-heat-${n}-foreground: var(--heat-${n}-foreground);`)
    }
  })

  for (const [theme, { shade, selector, cards }] of Object.entries(THEMES)) {
    const steps = primitives(shade)
    const rgb = STEPS.map((n) => linearRgb(steps.get(n)!))
    const neighbours = STEPS.slice(0, -1).map((n, i) => ({ name: `${n} and ${n + 1}`, a: rgb[i], b: rgb[i + 1] }))

    it(`declares every step inside sRGB (${theme})`, () => {
      expect(STEPS.filter((_, i) => rgb[i].some((v) => v < -0.001 || v > 1.001))).toEqual([])
    })

    it(`gets darker at every step, so the order survives without hue (${theme})`, () => {
      const lightness = STEPS.map((n) => steps.get(n)!.l)
      expect(lightness).toEqual([...lightness].sort((a, b) => b - a))
      expect(new Set(lightness).size).toBe(STEPS.length)
    })

    it(`keeps neighbouring steps at least ΔE ${MIN_DELTA_E} apart (${theme})`, () => {
      expect(neighbours.filter(({ a, b }) => deltaE(a, b) < MIN_DELTA_E).map(({ name }) => name)).toEqual([])
    })

    for (const [vision, matrix] of Object.entries({ deuteranopia: DEUTERANOPIA, protanopia: PROTANOPIA })) {
      it(`keeps neighbouring steps at least ΔE ${MIN_CVD_DELTA_E} apart with ${vision} (${theme})`, () => {
        const close = neighbours.filter(({ a, b }) => deltaE(simulate(a, matrix), simulate(b, matrix)) < MIN_CVD_DELTA_E)
        expect(close.map(({ name }) => name)).toEqual([])
      })
    }

    it(`clears ${MIN_CONTRAST}:1 on every card (${theme})`, () => {
      const low = Object.entries(cards).flatMap(([surface, colour]) =>
        STEPS.filter((_, i) => contrast(rgb[i], colour) < MIN_CONTRAST).map((n) => `${n} on ${surface}`),
      )
      expect(low).toEqual([])
    })

    it(`keeps its text at ${MIN_TEXT_CONTRAST}:1 on each fill (${theme})`, () => {
      const low = STEPS.filter((n, i) => {
        const foreground = block(selector).match(new RegExp(`--heat-${n}-foreground: var\\(--(white|black)\\);`))![1]
        return contrast(rgb[i], foreground === 'white' ? WHITE : BLACK) < MIN_TEXT_CONTRAST
      })
      expect(low).toEqual([])
    })
  }
})
