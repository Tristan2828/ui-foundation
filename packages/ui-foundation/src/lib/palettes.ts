// The four palettes (design-language.md "Palettes"): an app's own dark
// look, one of those the shared style guide chose. FoundationProviders'
// `palette` names the app's default; with `palettePicker` the app shell
// offers all four and the choice is remembered on this device
// (localStorage, this store). A new device starts on the default. The
// palette rides on <html> as data-palette, so popups portaled to <body>
// wear it too, and styles/theme.css's `.dark[data-palette]` blocks do the
// rest (components/app/palette-provider.tsx, hooks/use-palette.ts).

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

export type PaletteStore = DeviceChoiceStore<PaletteName>

/** The store under usePalette, taking the storage so its rules are unit tested (tests/palettes.test.ts). */
export function createPaletteStore(getStorage: () => StorageLike | undefined): PaletteStore {
  return createDeviceChoiceStore(PALETTE_STORAGE_KEY, isPaletteName, getStorage)
}

export const browserPaletteStore = createPaletteStore(browserStorage)
export const subscribeToBrowserPaletteStore = otherTabsSubscriber(browserPaletteStore, PALETTE_STORAGE_KEY)
