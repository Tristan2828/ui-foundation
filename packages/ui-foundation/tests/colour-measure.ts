// Colour measurements the token tests share (category-slots, heat-scale):
// oklch to linear sRGB, simulated colour vision, CIEDE2000 ΔE and WCAG contrast.
export type Oklch = { l: number; c: number; h: number }
export type Rgb = [number, number, number] // linear sRGB

export function linearRgb({ l, c, h }: Oklch): Rgb {
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
export const DEUTERANOPIA = [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]]
export const PROTANOPIA = [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]]
export function simulate(rgb: Rgb, m: number[][]): Rgb {
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
export function deltaE(p: Rgb, q: Rgb) {
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

const luminance = (rgb: Rgb) => {
  const [r, g, b] = rgb.map(clamp)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// WCAG 2.x contrast ratio of two linear sRGB colours.
export function contrast(p: Rgb, q: Rgb) {
  const [a, b] = [luminance(p), luminance(q)]
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

// A #rrggbb value as linear sRGB.
export function hexToLinear(hex: string): Rgb {
  return [1, 3, 5].map((i) => decode(parseInt(hex.slice(i, i + 2), 16) / 255)) as Rgb
}
