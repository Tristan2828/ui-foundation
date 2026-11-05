// The theme, palette and density a page was opened with
// (`?theme=dark&palette=violet&density=large`),
// set on <html> before anything renders, as an app sets them for the whole
// screen so popups portaled to <body> get them too (styles/theme.css
// "Large"). Mirrors next-themes' attribute="class" without its providers.
// A palette is dark only, as FoundationProviders' `palette` forces it.
import { PALETTES } from '@/lib/palettes'

export const THEMES = ['light', 'dark'] as const
export const PALETTE_OPTIONS = ['none', ...PALETTES] as const
export const DENSITIES = ['default', 'compact', 'comfortable', 'large'] as const

export function setGlobals(params: URLSearchParams) {
  const root = document.documentElement
  const palette = params.get('palette')
  const inPalette = Boolean(palette && palette !== 'none')
  root.classList.toggle('dark', inPalette || params.get('theme') === 'dark')
  if (inPalette) root.dataset.palette = palette!
  else delete root.dataset.palette
  const density = params.get('density')
  if (density && density !== 'default') root.dataset.density = density
  else delete root.dataset.density
}
