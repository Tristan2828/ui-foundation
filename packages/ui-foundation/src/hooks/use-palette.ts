import { createContext, useContext } from 'react'
import type { PaletteName } from '@/lib/palettes'

// What PaletteProvider (components/app/palette-provider.tsx, rendered by
// FoundationProviders) knows about the app's palette.

export type PaletteState = {
  /** The palette on screen, or null for an app without one (light and dark as the system says). */
  palette: PaletteName | null
  /** The app's own default. */
  defaultPalette: PaletteName | null
  /** Whether this app lets a device pick (FoundationProviders' `palettePicker`). */
  picker: boolean
  /** Saves `palette` as this device's choice. Does nothing without the picker. */
  setPalette: (palette: PaletteName) => void
}

const NO_PALETTE: PaletteState = { palette: null, defaultPalette: null, picker: false, setPalette: () => {} }

export const PaletteContext = createContext<PaletteState>(NO_PALETTE)

/** The palette on screen and, with the picker on, a way to change it on this device. */
export function usePalette(): PaletteState {
  return useContext(PaletteContext)
}
