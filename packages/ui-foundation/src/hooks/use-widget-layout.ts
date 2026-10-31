import { useCallback, useMemo, useSyncExternalStore } from 'react'

// The order of a hub page's cards, and which are hidden (#263): what
// WidgetLayoutSheet edits and the page renders by. The app names its cards
// in their default order; the person's own order is kept under the page's
// key, and merged with the app's ids every time it's read:
//
// - an id the app no longer has drops out;
// - an id the app added since falls in at its default place: after the
//   card that comes before it in the default order (first if none does);
// - nothing saved, or a reset, is the default order with nothing hidden.
//
// The default store is this device's localStorage (`<pageKey>:widgets`,
// JSON), kept in memory where storage is blocked. An app that wants the
// order to follow the person between devices passes its own `store`, one
// over its backend: `get` answers from what it holds (null until loaded),
// returning the same object until it changes, and `subscribe`'s listener
// is called when it does.
//
// mergeWidgetLayout, moveWidget and createWidgetLayoutStore are unit
// tested (tests/use-widget-layout.test.ts).

/** What's kept for a page: the ids in the person's order, and the hidden ones. */
export type SavedWidgetLayout = { order: readonly string[]; hidden: readonly string[] }

export type WidgetLayoutStore = {
  /** What's saved under `key`, or null. The same object until it changes. */
  get: (key: string) => SavedWidgetLayout | null
  /** Saves `layout` under `key`; null forgets it (a reset). */
  set: (key: string, layout: SavedWidgetLayout | null) => void
  subscribe: (key: string, listener: () => void) => () => void
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function parse(raw: string | null): SavedWidgetLayout | null {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { order, hidden } = value as Record<string, unknown>
    const strings = (list: unknown) => (Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string') : [])
    return { order: strings(order), hidden: strings(hidden) }
  } catch {
    return null
  }
}

export function createWidgetLayoutStore(getStorage: () => StorageLike | undefined): WidgetLayoutStore {
  // Layouts this page set, for when storage refuses them (null: a reset).
  const memory = new Map<string, SavedWidgetLayout | null>()
  // The last string read per key and what it parsed to, so `get` hands
  // back the same object until the stored string changes.
  const parsed = new Map<string, { raw: string | null; layout: SavedWidgetLayout | null }>()
  const listeners = new Map<string, Set<() => void>>()

  return {
    get(key) {
      if (memory.has(key)) return memory.get(key) ?? null
      let raw: string | null = null
      try {
        raw = getStorage()?.getItem(key) ?? null
      } catch {
        // Storage blocked: nothing saved.
      }
      const cached = parsed.get(key)
      if (cached && cached.raw === raw) return cached.layout
      const layout = parse(raw)
      parsed.set(key, { raw, layout })
      return layout
    },
    set(key, layout) {
      memory.set(key, layout)
      try {
        const storage = getStorage()
        if (layout === null) storage?.removeItem(key)
        else storage?.setItem(key, JSON.stringify(layout))
      } catch {
        // Storage blocked or full: kept in memory for this page only.
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

/** The order and hidden ids to show: `saved` merged with the app's `defaultIds`. */
export function mergeWidgetLayout(defaultIds: readonly string[], saved: SavedWidgetLayout | null): SavedWidgetLayout {
  if (saved === null) return { order: [...defaultIds], hidden: [] }
  const known = new Set(defaultIds)
  const order: string[] = []
  for (const id of saved.order) if (known.has(id) && !order.includes(id)) order.push(id)
  defaultIds.forEach((id, index) => {
    if (order.includes(id)) return
    // After the nearest card before it in the default order.
    let at = 0
    for (let before = index - 1; before >= 0; before--) {
      const placed = order.indexOf(defaultIds[before])
      if (placed !== -1) {
        at = placed + 1
        break
      }
    }
    order.splice(at, 0, id)
  })
  const hidden = order.filter((id) => saved.hidden.includes(id))
  return { order, hidden }
}

/** `order` with `id` one place earlier (`-1`) or later (`1`); unchanged at either end. */
export function moveWidget(order: readonly string[], id: string, by: -1 | 1): string[] {
  const next = [...order]
  const from = next.indexOf(id)
  const to = from + by
  if (from === -1 || to < 0 || to >= next.length) return next
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

const browserStore = createWidgetLayoutStore(() => (typeof window === 'undefined' ? undefined : window.localStorage))

export type WidgetLayoutOptions = {
  /** Where the layout is kept; this device's localStorage when left out. */
  store?: WidgetLayoutStore
}

export type WidgetLayout = {
  /** Every card's id, in the person's order. */
  order: readonly string[]
  /** The ids the person hid. */
  hidden: readonly string[]
  /** `order` without the hidden ones: the cards to render. */
  visible: readonly string[]
  /** Moves a card one place up (`-1`) or down (`1`). */
  move: (id: string, by: -1 | 1) => void
  /** Hides a shown card, or shows a hidden one. */
  toggle: (id: string) => void
  /** Back to the default order, everything shown. */
  reset: () => void
  /** True while the layout is the default one. */
  isDefault: boolean
}

/**
 * The order of a page's cards and which are hidden, remembered under
 * `pageKey` (name it for the app and the page: `"my-app:hub"`).
 * `defaultIds` is every card the page has, in its default order.
 */
export function useWidgetLayout(
  pageKey: string,
  defaultIds: readonly string[],
  { store = browserStore }: WidgetLayoutOptions = {},
): WidgetLayout {
  const key = `${pageKey}:widgets`
  const subscribe = useCallback((listener: () => void) => store.subscribe(key, listener), [store, key])
  const saved = useSyncExternalStore(
    subscribe,
    () => store.get(key),
    () => null,
  )
  // The ids as a string, so a new array with the same ids each render doesn't re-merge.
  const idsKey = defaultIds.join('\u0000')
  // eslint-disable-next-line react-hooks/exhaustive-deps -- idsKey stands for defaultIds
  const { order, hidden } = useMemo(() => mergeWidgetLayout(defaultIds, saved), [idsKey, saved])

  const move = useCallback(
    (id: string, by: -1 | 1) => store.set(key, { order: moveWidget(order, id, by), hidden }),
    [store, key, order, hidden],
  )
  const toggle = useCallback(
    (id: string) =>
      store.set(key, { order, hidden: hidden.includes(id) ? hidden.filter((other) => other !== id) : [...hidden, id] }),
    [store, key, order, hidden],
  )
  const reset = useCallback(() => store.set(key, null), [store, key])

  return {
    order,
    hidden,
    visible: order.filter((id) => !hidden.includes(id)),
    move,
    toggle,
    reset,
    isDefault: hidden.length === 0 && order.every((id, index) => id === defaultIds[index]),
  }
}
