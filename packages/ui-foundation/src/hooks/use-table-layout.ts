import { useCallback, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router'

// Which of a DataTable's layouts is showing (`layouts`: the table, then the
// app's card layouts), the way useTableUrlState keeps its page and sort:
// in the URL (`?layout=covers`), so a link or a refresh opens the same one,
// and remembered on this device per table (localStorage under the table's
// `storageKey`), so coming back to the screen without one in the URL opens
// the last one picked. Then `defaultLayout`. A `?layout=` naming no layout
// the table has is ignored.
//
// createLayoutStore takes the storage, so the rules are unit tested against
// a fake one (tests/use-table-layout.test.ts). Where storage is blocked (a
// private window, cleared site data) the choice lasts the page's life.

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export type LayoutStore = {
  get: (key: string) => string | null
  set: (key: string, value: string) => void
  subscribe: (key: string, listener: () => void) => () => void
}

export function createLayoutStore(getStorage: () => StorageLike | undefined): LayoutStore {
  const memory = new Map<string, string>()
  const listeners = new Map<string, Set<() => void>>()
  return {
    get(key) {
      const kept = memory.get(key)
      if (kept !== undefined) return kept
      try {
        return getStorage()?.getItem(key) ?? null
      } catch {
        return null
      }
    },
    set(key, value) {
      memory.set(key, value)
      try {
        getStorage()?.setItem(key, value)
      } catch {
        // Storage blocked or full: remembered in memory for this page only.
      }
      for (const listener of listeners.get(key) ?? []) listener()
    },
    subscribe(key, listener) {
      let set = listeners.get(key)
      if (!set) listeners.set(key, (set = new Set()))
      set.add(listener)
      return () => set.delete(listener)
    },
  }
}

/** The layout to show: the URL's if the table has it, then the remembered one, then the default. */
export function resolveLayout(
  layouts: readonly string[],
  fromUrl: string | null,
  remembered: string | null,
  defaultLayout: string,
): string {
  if (fromUrl !== null && layouts.includes(fromUrl)) return fromUrl
  if (remembered !== null && layouts.includes(remembered)) return remembered
  return defaultLayout
}

const browserStore = createLayoutStore(() => (typeof window === 'undefined' ? undefined : window.localStorage))

export type TableLayoutOptions = {
  /** Every layout id the table has, the table's own `'table'` among them. */
  layouts: readonly string[]
  /** The one shown until another is picked; `'table'` when left out. */
  defaultLayout?: string
  /**
   * Where the pick is remembered on this device, one key per table: name it
   * for the app and the list (`"my-app:comics:layout"`). Without one the
   * pick lives only in the URL.
   */
  storageKey?: string
}

/**
 * `{ layout, setLayout }` for DataTable's `layout` and `onLayoutChange`.
 * Setting one writes `?layout=` (replacing the history entry, as a filter
 * does) and remembers it under `storageKey`.
 */
export function useTableLayout({ layouts, defaultLayout = 'table', storageKey }: TableLayoutOptions) {
  const [params, setParams] = useSearchParams()
  const subscribe = useCallback(
    (listener: () => void) => (storageKey === undefined ? () => {} : browserStore.subscribe(storageKey, listener)),
    [storageKey],
  )
  const remembered = useSyncExternalStore(
    subscribe,
    () => (storageKey === undefined ? null : browserStore.get(storageKey)),
    () => null,
  )
  const layout = resolveLayout(layouts, params.get('layout'), remembered, defaultLayout)
  const setLayout = useCallback(
    (next: string) => {
      if (storageKey !== undefined) browserStore.set(storageKey, next)
      setParams(
        (previous) => {
          const updated = new URLSearchParams(previous)
          updated.set('layout', next)
          return updated
        },
        { replace: true },
      )
    },
    [setParams, storageKey],
  )
  return { layout, setLayout }
}
