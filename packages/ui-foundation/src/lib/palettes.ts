// The four palettes (design-language.md "Palettes"): an app's own dark
// look, one of those the shared style guide chose. FoundationProviders'
// `palette` names the app's default; with `palettePicker` the app shell
// offers all four and the choice is remembered on this device
// (localStorage, this store). A new device starts on the default. The
// palette rides on <html> as data-palette, so popups portaled to <body>
// wear it too, and styles/theme.css's `.dark[data-palette]` blocks do the
// rest (components/app/palette-provider.tsx, hooks/use-palette.ts).

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

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export type PaletteStore = {
  /** The saved choice, or null when there is none (or storage is blocked, or it names no palette). */
  get: () => PaletteName | null
  set: (palette: PaletteName) => void
  subscribe: (listener: () => void) => () => void
  /** Another tab saved a choice: forget the in-memory one and re-read. */
  changedElsewhere: () => void
}

/** The store under usePalette, taking the storage so its rules are unit tested (tests/palettes.test.ts). */
export function createPaletteStore(getStorage: () => StorageLike | undefined): PaletteStore {
  // What this page chose, for when storage refuses it.
  let memory: PaletteName | null = null
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const listener of listeners) listener()
  }
  return {
    get() {
      if (memory) return memory
      try {
        const stored = getStorage()?.getItem(PALETTE_STORAGE_KEY)
        return isPaletteName(stored) ? stored : null
      } catch {
        return null
      }
    },
    set(palette) {
      memory = palette
      try {
        getStorage()?.setItem(PALETTE_STORAGE_KEY, palette)
      } catch {
        // Storage blocked or full: kept for this page only.
      }
      notify()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    changedElsewhere() {
      memory = null
      notify()
    },
  }
}

export const browserPaletteStore = createPaletteStore(() => (typeof window === 'undefined' ? undefined : window.localStorage))
let listeningForOtherTabs = false

export function subscribeToBrowserPaletteStore(listener: () => void) {
  if (!listeningForOtherTabs && typeof window !== 'undefined') {
    listeningForOtherTabs = true
    window.addEventListener('storage', (event) => {
      if (event.key === PALETTE_STORAGE_KEY || event.key === null) browserPaletteStore.changedElsewhere()
    })
  }
  return browserPaletteStore.subscribe(listener)
}
