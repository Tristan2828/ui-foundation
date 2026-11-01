// The theme and density a page was opened with (`?theme=dark&density=large`),
// set on <html> before anything renders, as an app sets them for the whole
// screen so popups portaled to <body> get them too (styles/theme.css
// "Large"). Mirrors next-themes' attribute="class" without its providers.
export const THEMES = ['light', 'dark'] as const
export const DENSITIES = ['default', 'compact', 'comfortable', 'large'] as const

export function setGlobals(params: URLSearchParams) {
  const root = document.documentElement
  root.classList.toggle('dark', params.get('theme') === 'dark')
  const density = params.get('density')
  if (density && density !== 'default') root.dataset.density = density
  else delete root.dataset.density
}
