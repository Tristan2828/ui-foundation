import { useEffect } from 'react'

// A screen wake lock held while a session runs (a timer, a player, a
// recipe step), so the device doesn't sleep on a screen nobody touches.
// The browser drops the lock whenever the tab is hidden and never gives it
// back on its own, so it's asked for again each time the tab is visible.
// The rules live in createWakeLock, React-free, so they're unit tested
// against a fake browser (tests/use-wake-lock.test.ts).

/** What createWakeLock needs from the browser; `navigator.wakeLock` and `document` by default. */
export type WakeLockEnvironment = {
  wakeLock: Pick<WakeLock, 'request'> | undefined
  document: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>
}

export type WakeLockController = {
  /** Hold the lock from now on, asking again whenever the tab comes back. */
  activate: () => void
  /** Let it go, including a request still waiting for the browser's answer. */
  deactivate: () => void
}

export function createWakeLock(env: WakeLockEnvironment): WakeLockController {
  let active = false
  let sentinel: WakeLockSentinel | null = null
  // One request at a time: a second ask while the browser decides waits for
  // that answer rather than ending up holding two locks.
  let requesting = false

  const request = () => {
    if (!active || !env.wakeLock || sentinel || requesting) return
    if (env.document.visibilityState !== 'visible') return
    requesting = true
    env.wakeLock.request('screen').then(
      (lock) => {
        requesting = false
        // Deactivated while the browser decided: let it go at once.
        if (!active) {
          void lock.release().catch(() => {})
          return
        }
        sentinel = lock
        lock.addEventListener('release', () => {
          if (sentinel === lock) sentinel = null
        })
      },
      // Refused (no permission, low battery, an iframe without the policy):
      // the screen may sleep, nothing else changes.
      () => {
        requesting = false
      },
    )
  }

  const onVisibility = () => {
    if (env.document.visibilityState === 'visible') request()
  }

  return {
    activate() {
      if (active) return
      active = true
      env.document.addEventListener('visibilitychange', onVisibility)
      request()
    },
    deactivate() {
      if (!active) return
      active = false
      env.document.removeEventListener('visibilitychange', onVisibility)
      const lock = sentinel
      sentinel = null
      if (lock) void lock.release().catch(() => {})
    },
  }
}

/**
 * Keep the screen awake while `active`. Asked for again when the tab
 * returns, released on `active` going false or unmount. Does nothing where
 * the browser has no wake lock, or refuses it.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined') return
    const controller = createWakeLock({ wakeLock: navigator.wakeLock, document })
    controller.activate()
    return () => controller.deactivate()
  }, [active])
}
