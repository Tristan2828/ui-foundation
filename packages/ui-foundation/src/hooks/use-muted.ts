import { useCallback, useSyncExternalStore } from 'react'

// A mute toggle for a screen's sound cues, remembered on this device
// (localStorage under the app's own key). Where storage is blocked (a
// private window, cleared site data, a sandboxed iframe) it still works
// for the page's life, kept in memory. A change in another tab of the
// same app shows here too.
//
// createMutedStore takes the storage, so the rules are unit tested
// against a fake one (tests/use-muted.test.ts).

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export type MutedStore = {
  get: (key: string) => boolean
  set: (key: string, muted: boolean) => void
  subscribe: (key: string, listener: () => void) => () => void
  /** Another tab changed `key` (a `storage` event): forget the in-memory value and re-read. */
  changedElsewhere: (key: string) => void
}

export function createMutedStore(getStorage: () => StorageLike | undefined): MutedStore {
  // Values this page set, for when storage refuses them.
  const memory = new Map<string, boolean>()
  const listeners = new Map<string, Set<() => void>>()

  const notify = (key: string) => {
    for (const listener of listeners.get(key) ?? []) listener()
  }

  return {
    get(key) {
      const kept = memory.get(key)
      if (kept !== undefined) return kept
      try {
        const stored = getStorage()?.getItem(key)
        if (stored === 'true') return true
        if (stored === 'false') return false
      } catch {
        // Storage blocked: unmuted.
      }
      return false
    },
    set(key, muted) {
      memory.set(key, muted)
      try {
        getStorage()?.setItem(key, String(muted))
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

const browserStore = createMutedStore(() => (typeof window === 'undefined' ? undefined : window.localStorage))
let listeningForOtherTabs = false

function listenForOtherTabs() {
  if (listeningForOtherTabs || typeof window === 'undefined') return
  listeningForOtherTabs = true
  window.addEventListener('storage', (event) => {
    if (event.key !== null) browserStore.changedElsewhere(event.key)
  })
}

/**
 * `[muted, setMuted]`, remembered on this device under `key` (name it for
 * the app and screen: `"my-app:timer:muted"`). Unmuted until set.
 */
export function useMuted(key: string): readonly [boolean, (muted: boolean) => void] {
  const subscribe = useCallback(
    (listener: () => void) => {
      listenForOtherTabs()
      return browserStore.subscribe(key, listener)
    },
    [key],
  )
  const muted = useSyncExternalStore(
    subscribe,
    () => browserStore.get(key),
    () => false,
  )
  const setMuted = useCallback((next: boolean) => browserStore.set(key, next), [key])
  return [muted, setMuted] as const
}
