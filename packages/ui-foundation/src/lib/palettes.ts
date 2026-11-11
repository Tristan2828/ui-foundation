// The four palettes (design-language.md "Palettes"): an app's own dark
// look, one of those the shared style guide chose. FoundationProviders'
// `palette` names the app's default; with `palettePicker` the app shell
// offers all four and the choice is remembered on this device
// (localStorage, this store). A new device starts on the default. The
// palette rides on <html> as data-palette, so popups portaled to <body>
// wear it too, and styles/theme.css's `.dark[data-palette]` blocks do the
// rest (components/app/palette-provider.tsx, hooks/use-palette.ts).
//
// The light palettes (LIGHT_PALETTES, so far one: Palm LCD) are opt-in: an
// app gets one only by naming it as `palette`. It forces the light theme,
// it is never in the picker, and it has no glow. Its block is
// `[data-palette="<name>"]` on top of :root.

import { browserStorage, createDeviceChoiceStore, otherTabsSubscriber, type DeviceChoiceStore, type StorageLike } from '@/lib/device-choice'

export const PALETTES = ['indigo-cyan', 'indigo-rose', 'graphite-periwinkle', 'violet'] as const

export type PaletteName = (typeof PALETTES)[number]

/** Each palette's name as a person reads it, in the guide's ranked order. */
export const PALETTE_LABELS: Record<PaletteName, string> = {
  'indigo-cyan': 'Indigo and Cyan',
  'indigo-rose': 'Indigo and Rose',
  'graphite-periwinkle': 'Graphite and Periwinkle',
  violet: 'Violet',
}

/** Where a device's chosen palette is kept. */
export const PALETTE_STORAGE_KEY = 'ui-foundation:palette'

export function isPaletteName(value: unknown): value is PaletteName {
  return typeof value === 'string' && (PALETTES as readonly string[]).includes(value)
}

/** The light palettes, which an app opts into by name: never in the picker (design-language.md "Palettes"). */
export const LIGHT_PALETTES = ['palm-lcd'] as const

export type LightPaletteName = (typeof LIGHT_PALETTES)[number]

/** Each light palette's name as a person reads it. */
export const LIGHT_PALETTE_LABELS: Record<LightPaletteName, string> = {
  'palm-lcd': 'Palm LCD',
}

/** Any palette an app can name: one of the four dark ones, or a light one. */
export type AppPaletteName = PaletteName | LightPaletteName

export function isLightPaletteName(value: unknown): value is LightPaletteName {
  return typeof value === 'string' && (LIGHT_PALETTES as readonly string[]).includes(value)
}

/** The theme a palette forces: light for a light palette, dark for the four. */
export function paletteColorScheme(palette: AppPaletteName): 'light' | 'dark' {
  return isLightPaletteName(palette) ? 'light' : 'dark'
}

export type PaletteStore = DeviceChoiceStore<PaletteName>

/** The store under usePalette, taking the storage so its rules are unit tested (tests/palettes.test.ts). */
export function createPaletteStore(getStorage: () => StorageLike | undefined): PaletteStore {
  return createDeviceChoiceStore(PALETTE_STORAGE_KEY, isPaletteName, getStorage)
}

export const browserPaletteStore = createPaletteStore(browserStorage)
export const subscribeToBrowserPaletteStore = otherTabsSubscriber(browserPaletteStore, PALETTE_STORAGE_KEY)
