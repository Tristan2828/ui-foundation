import { useCallback, useState, useSyncExternalStore } from 'react'

// The headings folded in a text (src/lib/markdown-fold.ts), remembered on
// this device under the text's `foldKey` (localStorage, a JSON list of
// heading ids). <Markdown>, the rich-text editor and NotesOutline given
// the same key share it: fold a section in one and it folds in the
// others, in another tab too. Where storage is blocked (a private window,
// a sandboxed iframe) it still works for the page's life, kept in memory.
//
// createFoldStore takes the storage, so the rules are unit tested against
// a fake one (tests/fold-store.test.ts).

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type FoldStore = {
  /** The ids folded under `key`: the same set until it changes. */
  get: (key: string) => ReadonlySet<string>
  set: (key: string, folded: ReadonlySet<string>) => void
  subscribe: (key: string, listener: () => void) => () => void
  /** Another tab changed `key` (a `storage` event): re-read it. */
  changedElsewhere: (key: string) => void
}

const NONE: ReadonlySet<string> = new Set()

function parse(stored: string | null | undefined): ReadonlySet<string> {
  if (!stored) return NONE
  try {
    const ids: unknown = JSON.parse(stored)
    return Array.isArray(ids) ? new Set(ids.filter((id): id is string => typeof id === 'string')) : NONE
  } catch {
    return NONE
  }
}

export function createFoldStore(getStorage: () => StorageLike | undefined): FoldStore {
  // Each key's set as last read or set: one object per state, so React
  // sees a change only when there is one.
  const current = new Map<string, ReadonlySet<string>>()
  const listeners = new Map<string, Set<() => void>>()

  const notify = (key: string) => {
    for (const listener of listeners.get(key) ?? []) listener()
  }

  return {
    get(key) {
      let folded = current.get(key)
      if (!folded) {
        try {
          folded = parse(getStorage()?.getItem(key))
        } catch {
          folded = NONE
        }
        current.set(key, folded)
      }
      return folded
    },
    set(key, folded) {
      const next = new Set(folded)
      current.set(key, next)
      try {
        if (next.size === 0) getStorage()?.removeItem(key)
        else getStorage()?.setItem(key, JSON.stringify([...next]))
      } catch {
        // Storage blocked or full: remembered in memory for this page only.
      }
      notify(key)
    },
    subscribe(key, listener) {
      let set = listeners.get(key)
      if (!set) listeners.set(key, (set = new Set()))
      set.add(listener)
      return () => set.delete(listener)
    },
    changedElsewhere(key) {
      if (!current.has(key)) return
      current.delete(key)
      notify(key)
    },
  }
}

export const foldStore = createFoldStore(() => (typeof window === 'undefined' ? undefined : window.localStorage))
let listeningForOtherTabs = false

export function listenForOtherTabs() {
  if (listeningForOtherTabs || typeof window === 'undefined') return
  listeningForOtherTabs = true
  window.addEventListener('storage', (event) => {
    if (event.key !== null) foldStore.changedElsewhere(event.key)
  })
}

/**
 * `[folded, setFolded]`: the heading ids folded under `foldKey`, shared
 * with everything else given that key. Without a key it's plain state,
 * forgotten with the page.
 */
export function useFolds(foldKey: string | undefined): readonly [ReadonlySet<string>, (folded: ReadonlySet<string>) => void] {
  const [local, setLocal] = useState<ReadonlySet<string>>(NONE)
  const subscribe = useCallback(
    (listener: () => void) => {
      if (foldKey === undefined) return () => {}
      listenForOtherTabs()
      return foldStore.subscribe(foldKey, listener)
    },
    [foldKey],
  )
  const stored = useSyncExternalStore(
    subscribe,
    () => (foldKey === undefined ? NONE : foldStore.get(foldKey)),
    () => NONE,
  )
  const set = useCallback(
    (folded: ReadonlySet<string>) => (foldKey === undefined ? setLocal(folded) : foldStore.set(foldKey, folded)),
    [foldKey],
  )
  return [foldKey === undefined ? local : stored, set] as const
}
