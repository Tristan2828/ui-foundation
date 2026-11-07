// A look chosen on this device and kept in localStorage: the palette
// (lib/palettes.ts) and the table rows (lib/rows.ts). A saved value is read
// back only when it is one of the choices; when storage is blocked or full
// the choice is kept for this page; another tab's save replaces it.

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export type DeviceChoiceStore<T extends string> = {
  /** The saved choice, or null when there is none (or storage is blocked, or it names no choice). */
  get: () => T | null
  set: (value: T) => void
  subscribe: (listener: () => void) => () => void
  /** Another tab saved a choice: forget the in-memory one and re-read. */
  changedElsewhere: () => void
}

export function createDeviceChoiceStore<T extends string>(
  key: string,
  isChoice: (value: unknown) => value is T,
  getStorage: () => StorageLike | undefined,
): DeviceChoiceStore<T> {
  // What this page chose, for when storage refuses it.
  let memory: T | null = null
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const listener of listeners) listener()
  }
  return {
    get() {
      if (memory) return memory
      try {
        const stored = getStorage()?.getItem(key)
        return isChoice(stored) ? stored : null
      } catch {
        return null
      }
    },
    set(value) {
      memory = value
      try {
        getStorage()?.setItem(key, value)
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

/** Subscribes to `store`, and (once) to other tabs' saves under `key`. */
export function otherTabsSubscriber<T extends string>(store: DeviceChoiceStore<T>, key: string) {
  let listening = false
  return (listener: () => void) => {
    if (!listening && typeof window !== 'undefined') {
      listening = true
      window.addEventListener('storage', (event) => {
        if (event.key === key || event.key === null) store.changedElsewhere()
      })
    }
    return store.subscribe(listener)
  }
}

export const browserStorage = () => (typeof window === 'undefined' ? undefined : window.localStorage)
