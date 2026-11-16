// The value handling behind ColorField: which of a set of named colours a
// stored value is, and what the browser's own colour picker can show. Its
// own file so it's tested without a browser (tests/color-field.test.tsx).
import { storedColor } from './stored-color'

/** One named colour a ColorField offers: its name is shown and is its accessible label. */
export type ColorChoice = { name: string; color: string }

/**
 * ColorField's default set: twelve hues at a middle lightness, so each fill
 * clears 3:1 against `card` in light, dark and every dark palette, and 2.3:1
 * on Palm LCD's mid-light panel (measured in e2e/fixtures-visual.spec.ts).
 * The swatch's ring shows its edge on any surface either way. An app with
 * its own names or colours passes its own `colors`.
 */
export const COLOR_CHOICES: readonly ColorChoice[] = [
  { name: 'Red', color: '#dc2626' },
  { name: 'Orange', color: '#dd5208' },
  { name: 'Amber', color: '#c27006' },
  { name: 'Olive', color: '#5f8a12' },
  { name: 'Green', color: '#16883f' },
  { name: 'Teal', color: '#0d8a80' },
  { name: 'Cyan', color: '#0b86a8' },
  { name: 'Blue', color: '#2563eb' },
  { name: 'Indigo', color: '#5b5ee8' },
  { name: 'Purple', color: '#9b3fec' },
  { name: 'Pink', color: '#d62a74' },
  { name: 'Grey', color: '#737373' },
]

/**
 * A stored colour in full: `storedColor`'s form with a 3- or 4-digit hex
 * spelt out (`#fff` → `#ffffff`, `#fff8` → `#ffffff88`), so two spellings of
 * one colour compare equal. `null` when it isn't a colour.
 */
export function fullHex(value: string | null | undefined): string | null {
  const hex = storedColor(value)
  if (!hex) return null
  if (hex.length > 5) return hex
  return `#${[...hex.slice(1)].map((digit) => digit + digit).join('')}`
}

/**
 * The index of the choice a stored value is, or `-1` when it's none of them
 * (Custom), compared in full so `#FFF`, `fff` and `#ffffff` are one colour.
 * A value that isn't a colour (missing, empty, a typo) is `-1` too.
 */
export function choiceIndex(value: string | null | undefined, colors: readonly ColorChoice[]): number {
  const hex = fullHex(value)
  if (!hex) return -1
  return colors.findIndex((choice) => fullHex(choice.color) === hex)
}

/**
 * What `<input type="color">` can show for a stored value: `#rrggbb` only,
 * so a short hex is spelt out and an alpha dropped. Black when there's no
 * colour, the input's own default.
 */
export function pickerHex(value: string | null | undefined): string {
  return fullHex(value)?.slice(0, 7) ?? '#000000'
}
