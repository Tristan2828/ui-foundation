// Whether the app can reach its server (4.90, the dialogs and feedback
// standard D9): what OfflineNotice reads. Offline when the browser says so
// (`navigator.onLine`, its `offline` event) or when a request couldn't get
// an answer at all (safeFetch's network failure); online again when the
// browser says so or when any request gets an answer. One store for the
// whole app, so the notice shows once however many saves fail.
import { useSyncExternalStore } from 'react'

let offline = false
const listeners = new Set<() => void>()

function set(next: boolean) {
  if (next === offline) return
  offline = next
  for (const listener of listeners) listener()
}

/** A request got an answer (any status): the server can be reached. */
export function reportAnswered() {
  set(false)
}

/** A request got no answer at all (fetch rejected): the server can't be reached. */
export function reportUnreachable() {
  set(true)
}

let watching = false
function watchBrowser() {
  if (watching || typeof window === 'undefined') return
  watching = true
  if (typeof navigator !== 'undefined' && navigator.onLine === false) offline = true
  window.addEventListener('offline', () => set(true))
  window.addEventListener('online', () => set(false))
}

function subscribe(listener: () => void) {
  watchBrowser()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Whether the server can't be reached right now. */
export function isOffline() {
  return offline
}

/** Whether the server can't be reached right now, re-rendering when that changes. */
export function useOffline(): boolean {
  return useSyncExternalStore(subscribe, isOffline, () => false)
}
