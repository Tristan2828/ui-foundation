// Whether a colour stored as data can be painted (ColorSwatch's fill), and
// as what. Its own file so a form can validate a colour with it too.

// #rgb, #rgba, #rrggbb or #rrggbbaa, the leading # optional (some APIs
// store labels' colours without it).
const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

/**
 * A stored colour as CSS, or `null` when it isn't one: a hex value, with or
 * without its `#`, in 3, 4, 6 or 8 digits, trimmed and lower-cased
 * (`'C0392B'` → `'#c0392b'`). Use it to validate a colour on a form too.
 */
export function storedColor(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const match = HEX.exec(value.trim())
  return match ? `#${match[1].toLowerCase()}` : null
}
