import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrast, deltaE, DEUTERANOPIA, hexToLinear, linearRgb, type Oklch, PROTANOPIA, type Rgb, simulate } from './colour-measure'

// The depth ramps (theme.css, design-language.md "Depth ramps"), measured from
// the values theme.css declares, as tests/heat-scale.test.ts measures the heat
// scale: how far apart neighbouring steps look, with and without colour
// blindness, and every step against every card. fixtures-visual.spec.ts
// re-measures the rendered fills and runs axe over the text on them.
//
// The light floor is near the heat scale's measured 17.8; dark's is lower,
// since five steps that each clear 3:1 on the dark cards have only the
// lightness band from about oklch 0.58 to 1 (theme.css says why).
const css = readFileSync(new URL('../styles/theme.css', import.meta.url), 'utf-8')
const tailwind = readFileSync(new URL('../styles/index.css', import.meta.url), 'utf-8')

const SLOTS = Array.from({ length: 12 }, (_, i) => i + 1)
const STEPS = [1, 2, 3, 4, 5]
const MIN_DELTA_E = { light: 17, dark: 13.5, 'palm-lcd': 17 }
const MIN_CVD_DELTA_E = 10
const MIN_CONTRAST = 3
const MIN_TEXT_CONTRAST = 4.5

// Light's -700 and dark's -400; Palm LCD's are its own (--palette-palm-lcd-category-N-depth-M).
function primitives(slot: number, shade: '700' | '400' | 'lcd'): Map<number, Oklch> {
  const steps = new Map<number, Oklch>()
  if (shade === 'lcd') {
    for (const m of css.matchAll(/--palette-palm-lcd-category-(\d+)-depth-(\d+):\s*oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/g))
      if (Number(m[1]) === slot) steps.set(Number(m[2]), { l: Number(m[3]), c: Number(m[4]), h: Number(m[5]) })
    return steps
  }
  for (const m of css.matchAll(/--category-(\d+)-depth-(\d+)-(\d+):\s*oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/g)) {
    if (Number(m[1]) !== slot || m[3] !== shade) continue
    steps.set(Number(m[2]), { l: Number(m[4]), c: Number(m[5]), h: Number(m[6]) })
  }
  return steps
}

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
  // Palm LCD, the light palette: its own steps on its green, at light's floor.
  'palm-lcd': {
    shade: 'lcd',
    selector: '[data-palette="palm-lcd"]',
    cards: { 'palm-lcd card': palettePanel('palm-lcd', 'panel'), 'palm-lcd raised': palettePanel('palm-lcd', 'raised') } as Record<string, Rgb>,
  },
} as const

const name = (slot: number, step: number) => `--category-${slot}-depth-${step}`
const primitiveName = (slot: number, step: number, shade: string) =>
  shade === 'lcd' ? `--palette-palm-lcd-category-${slot}-depth-${step}` : `${name(slot, step)}-${shade}`

describe('depth ramps', () => {
  it('has five steps for every slot in both themes, each a Tailwind colour with its foreground', () => {
    for (const { shade, selector } of Object.values(THEMES)) {
      for (const slot of SLOTS) {
        expect([...primitives(slot, shade).keys()].sort((a, b) => a - b)).toEqual(STEPS)
        for (const n of STEPS) {
          expect(block(selector)).toContain(`${name(slot, n)}: var(${primitiveName(slot, n, shade)});`)
          expect(block(selector)).toMatch(new RegExp(`${name(slot, n)}-foreground: var\\(--(white|black)\\);`))
        }
      }
    }
    for (const slot of SLOTS)
      for (const n of STEPS) {
        expect(tailwind).toContain(`--color-category-${slot}-depth-${n}: var(${name(slot, n)});`)
        expect(tailwind).toContain(`--color-category-${slot}-depth-${n}-foreground: var(${name(slot, n)}-foreground);`)
      }
  })

  for (const [theme, { shade, selector, cards }] of Object.entries(THEMES)) {
    const ramps = SLOTS.map((slot) => {
      const steps = primitives(slot, shade)
      const rgb = STEPS.map((n) => linearRgb(steps.get(n)!))
      const neighbours = STEPS.slice(0, -1).map((n, i) => ({ name: `slot ${slot}: ${n} and ${n + 1}`, a: rgb[i], b: rgb[i + 1] }))
      return { slot, steps, rgb, neighbours }
    })
    const allNeighbours = ramps.flatMap((ramp) => ramp.neighbours)

    it(`declares every step inside sRGB (${theme})`, () => {
      expect(ramps.flatMap(({ slot, rgb }) => STEPS.filter((_, i) => rgb[i].some((v) => v < -0.001 || v > 1.001)).map((n) => `${slot}.${n}`))).toEqual([])
    })

    it(`gets darker at every step, so the order survives without hue (${theme})`, () => {
      for (const { steps } of ramps) {
        const lightness = STEPS.map((n) => steps.get(n)!.l)
        expect(lightness).toEqual([...lightness].sort((a, b) => b - a))
        expect(new Set(lightness).size).toBe(STEPS.length)
      }
    })

    const floor = MIN_DELTA_E[theme as keyof typeof MIN_DELTA_E]
    it(`keeps neighbouring steps at least ΔE ${floor} apart (${theme})`, () => {
      expect(allNeighbours.filter(({ a, b }) => deltaE(a, b) < floor).map(({ name }) => name)).toEqual([])
    })

    for (const [vision, matrix] of Object.entries({ deuteranopia: DEUTERANOPIA, protanopia: PROTANOPIA })) {
      it(`keeps neighbouring steps at least ΔE ${MIN_CVD_DELTA_E} apart with ${vision} (${theme})`, () => {
        const close = allNeighbours.filter(({ a, b }) => deltaE(simulate(a, matrix), simulate(b, matrix)) < MIN_CVD_DELTA_E)
        expect(close.map(({ name }) => name)).toEqual([])
      })
    }

    it(`clears ${MIN_CONTRAST}:1 on every card (${theme})`, () => {
      const low = ramps.flatMap(({ slot, rgb }) =>
        Object.entries(cards).flatMap(([surface, colour]) =>
          STEPS.filter((_, i) => contrast(rgb[i], colour) < MIN_CONTRAST).map((n) => `${slot}.${n} on ${surface}`),
        ),
      )
      expect(low).toEqual([])
    })

    it(`keeps its text at ${MIN_TEXT_CONTRAST}:1 on each fill (${theme})`, () => {
      const low = ramps.flatMap(({ slot, rgb }) =>
        STEPS.filter((n, i) => {
          const foreground = block(selector).match(new RegExp(`${name(slot, n)}-foreground: var\\(--(white|black)\\);`))![1]
          return contrast(rgb[i], foreground === 'white' ? WHITE : BLACK) < MIN_TEXT_CONTRAST
        }).map((n) => `${slot}.${n}`),
      )
      expect(low).toEqual([])
    })
  }
})
