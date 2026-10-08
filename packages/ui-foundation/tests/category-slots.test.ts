import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

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

type Oklch = { l: number; c: number; h: number }
type Rgb = [number, number, number] // linear sRGB

function primitives(shade: '700' | '400'): Map<number, Oklch> {
  const slots = new Map<number, Oklch>()
  for (const m of css.matchAll(/--category-(\d+)-(\d+):\s*oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/g)) {
    if (m[2] !== shade) continue
    slots.set(Number(m[1]), { l: Number(m[3]), c: Number(m[4]), h: Number(m[5]) })
  }
  return slots
}

function linearRgb({ l, c, h }: Oklch): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const lms = [l + 0.3963377774 * a + 0.2158037573 * b, l - 0.1055613458 * a - 0.0638541728 * b, l - 0.0894841775 * a - 1.291485548 * b].map((v) => v ** 3)
  return [
    4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
    -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
    -0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
  ]
}

const encode = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)
const decode = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const clamp = (v: number) => Math.min(1, Math.max(0, v))

// Machado, Oliveira & Fernandes (2009), full severity, on encoded sRGB.
const DEUTERANOPIA = [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]]
const PROTANOPIA = [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]]
function simulate(rgb: Rgb, m: number[][]): Rgb {
  const e = rgb.map((v) => encode(clamp(v)))
  return m.map((row) => decode(clamp(row[0] * e[0] + row[1] * e[1] + row[2] * e[2]))) as Rgb
}

function lab([r, g, b]: Rgb) {
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

// CIEDE2000 (Sharma, Wu & Dalal 2005).
function deltaE(p: Rgb, q: Rgb) {
  const [L1, a1, b1] = lab(p.map(clamp) as Rgb)
  const [L2, a2, b2] = lab(q.map(clamp) as Rgb)
  const rad = Math.PI / 180
  const Cbar = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)))
  const [ap1, ap2] = [(1 + G) * a1, (1 + G) * a2]
  const [C1, C2] = [Math.hypot(ap1, b1), Math.hypot(ap2, b2)]
  const hue = (b: number, a: number) => (a === 0 && b === 0 ? 0 : (Math.atan2(b, a) / rad + 360) % 360)
  const [h1, h2] = [hue(b1, ap1), hue(b2, ap2)]
  let dh = C1 * C2 === 0 ? 0 : h2 - h1
  if (dh > 180) dh -= 360
  else if (dh < -180) dh += 360
  const dL = L2 - L1
  const dC = C2 - C1
  const dH = 2 * Math.sqrt(C1 * C2) * Math.sin((dh / 2) * rad)
  const Lbar = (L1 + L2) / 2
  const Cpbar = (C1 + C2) / 2
  let hbar = h1 + h2
  if (C1 * C2 !== 0) hbar = (Math.abs(h1 - h2) > 180 ? hbar + (hbar < 360 ? 360 : -360) : hbar) / 2
  const T = 1 - 0.17 * Math.cos((hbar - 30) * rad) + 0.24 * Math.cos(2 * hbar * rad) + 0.32 * Math.cos((3 * hbar + 6) * rad) - 0.2 * Math.cos((4 * hbar - 63) * rad)
  const RC = 2 * Math.sqrt(Cpbar ** 7 / (Cpbar ** 7 + 25 ** 7))
  const RT = -Math.sin(2 * 30 * Math.exp(-(((hbar - 275) / 25) ** 2)) * rad) * RC
  const SL = 1 + (0.015 * (Lbar - 50) ** 2) / Math.sqrt(20 + (Lbar - 50) ** 2)
  const SC = 1 + 0.045 * Cpbar
  const SH = 1 + 0.015 * Cpbar * T
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH))
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
