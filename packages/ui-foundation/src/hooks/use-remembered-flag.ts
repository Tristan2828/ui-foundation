import { useCallback, useState, useSyncExternalStore } from 'react'

// A yes/no remembered on this device (localStorage under the app's own
// key): a screen's mute (useMuted), a hub widget folded away (WidgetCard's
// `storageKey`). Where storage is blocked (a private window, cleared site
// data, a sandboxed iframe) it still works for the page's life, kept in
// memory. A change in another tab of the same app shows here too.
//
// createFlagStore takes the storage, so the rules are unit tested against
// a fake one (tests/use-muted.test.ts, tests/use-remembered-flag.test.ts).

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export type FlagStore = {
  /** What's held for `key`, or `fallback` when nothing is (or storage is blocked). */
  get: (key: string, fallback?: boolean) => boolean
  set: (key: string, value: boolean) => void
  subscribe: (key: string, listener: () => void) => () => void
  /** Another tab changed `key` (a `storage` event): forget the in-memory value and re-read. */
  changedElsewhere: (key: string) => void
}

export function createFlagStore(getStorage: () => StorageLike | undefined): FlagStore {
  // Values this page set, for when storage refuses them.
  const memory = new Map<string, boolean>()
  const listeners = new Map<string, Set<() => void>>()

  const notify = (key: string) => {
    for (const listener of listeners.get(key) ?? []) listener()
  }

  return {
    get(key, fallback = false) {
      const kept = memory.get(key)
      if (kept !== undefined) return kept
      try {
        const stored = getStorage()?.getItem(key)
        if (stored === 'true') return true
        if (stored === 'false') return false
      } catch {
        // Storage blocked: the fallback.
      }
      return fallback
    },
    set(key, value) {
      memory.set(key, value)
      try {
        getStorage()?.setItem(key, String(value))
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
      memory.delete(key)
      notify(key)
    },
  }
}

const browserStore = createFlagStore(() => (typeof window === 'undefined' ? undefined : window.localStorage))
let listeningForOtherTabs = false

function listenForOtherTabs() {
  if (listeningForOtherTabs || typeof window === 'undefined') return
  listeningForOtherTabs = true
  window.addEventListener('storage', (event) => {
    if (event.key !== null) browserStore.changedElsewhere(event.key)
  })
}

/**
 * `[value, setValue]`, remembered on this device under `key` (name it for
 * the app and what it's about: `"my-app:hub.waiting:collapsed"`), and
 * `fallback` until set. Without a key it's plain state, starting at
 * `fallback` and forgotten with the page.
 */
export function useRememberedFlag(key: string | undefined, fallback = false): readonly [boolean, (value: boolean) => void] {
  const [local, setLocal] = useState(fallback)
  const subscribe = useCallback(
    (listener: () => void) => {
      if (key === undefined) return () => {}
      listenForOtherTabs()
      return browserStore.subscribe(key, listener)
    },
    [key],
  )
  const stored = useSyncExternalStore(
    subscribe,
    () => (key === undefined ? fallback : browserStore.get(key, fallback)),
    () => fallback,
  )
  const set = useCallback((next: boolean) => (key === undefined ? setLocal(next) : browserStore.set(key, next)), [key])
  return [key === undefined ? local : stored, set] as const
}
