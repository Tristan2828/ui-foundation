import { useCallback, useLayoutEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { PaletteContext, type PaletteState } from '@/hooks/use-palette'
import { browserPaletteStore, subscribeToBrowserPaletteStore, type PaletteName, type PaletteStore } from '@/lib/palettes'

/**
 * Puts the palette on <html>. FoundationProviders renders it; an app
 * doesn't. Without `palette` it does nothing, and the app keeps light and
 * dark.
 */
export function PaletteProvider({
  palette: defaultPalette,
  picker = false,
  store = browserPaletteStore,
  children,
}: {
  palette?: PaletteName
  picker?: boolean
  /** For tests; the browser's localStorage by default. */
  store?: PaletteStore
  children: ReactNode
}) {
  const subscribe = useCallback(
    (listener: () => void) => (store === browserPaletteStore ? subscribeToBrowserPaletteStore(listener) : store.subscribe(listener)),
    [store],
  )
  const saved = useSyncExternalStore(subscribe, store.get, () => null)
  const palette = defaultPalette ? ((picker && saved) || defaultPalette) : null

  // Before paint, so the first frame is already in the palette.
  useLayoutEffect(() => {
    const root = document.documentElement
    if (palette) root.dataset.palette = palette
    else delete root.dataset.palette
    return () => {
      delete root.dataset.palette
    }
  }, [palette])

  const value = useMemo<PaletteState>(
    () => ({
      palette,
      defaultPalette: defaultPalette ?? null,
      picker: Boolean(defaultPalette && picker),
      setPalette: (next) => {
        if (defaultPalette && picker) store.set(next)
      },
    }),
    [palette, defaultPalette, picker, store],
  )
  return <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>
}
