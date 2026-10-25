// After a deploy, a tab opened on the build before it still runs that
// build, and its content-hashed chunks are gone from the server: the next
// lazy import (the rich-text editor's, say) fails with "Failed to fetch
// dynamically imported module" (#206). Vite's preload helper announces it
// first as a cancelable `vite:preloadError` on `window`, for the package's
// own lazy chunks too once the app's build bundles them. On it, the page
// reloads once onto the new build, and the failure is not reported.
//
// Once, because a file missing from the new build too would reload
// forever: the reload is remembered in sessionStorage, and a second
// failure within `windowMs` of it is let through to the error boundary
// (and reported, since that one is a real missing file). Where nothing
// can be remembered, nothing reloads.
//
// createStaleChunkReload takes its storage, reload and clock, so the rules
// are unit tested in node (tests/stale-chunk-reload.test.ts);
// FoundationProviders installs the shared instance over the real ones.

const KEY = 'ui-foundation:stale-chunk-reload'
const WINDOW_MS = 60_000

export type StaleChunkReload = {
  /** True from the reload asked for until the page goes: nothing that fails meanwhile is a bug. */
  isReloading: () => boolean
  /** Listens for `vite:preloadError` on `target`; returns the undo. */
  install: (target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>) => () => void
}

export function createStaleChunkReload({
  storage,
  reload,
  now = Date.now,
  windowMs = WINDOW_MS,
}: {
  storage: () => Pick<Storage, 'getItem' | 'setItem'> | undefined
  reload: () => void
  now?: () => number
  windowMs?: number
}): StaleChunkReload {
  let reloading = false

  const remember = (): boolean => {
    try {
      const store = storage()
      if (!store) return false
      const last = Number(store.getItem(KEY))
      if (Number.isFinite(last) && last > 0 && now() - last < windowMs) return false
      store.setItem(KEY, String(now()))
      return true
    } catch {
      return false
    }
  }

  const onPreloadError = (event: Event) => {
    if (reloading) {
      event.preventDefault()
      return
    }
    if (!remember()) return
    reloading = true
    event.preventDefault()
    reload()
  }

  return {
    isReloading: () => reloading,
    install(target) {
      target.addEventListener('vite:preloadError', onPreloadError)
      return () => target.removeEventListener('vite:preloadError', onPreloadError)
    },
  }
}

let shared: StaleChunkReload | null = null

/** The one instance over the real window, sessionStorage and reload. */
export function browserStaleChunkReload(): StaleChunkReload {
  shared ??= createStaleChunkReload({
    storage: () => (typeof sessionStorage === 'undefined' ? undefined : sessionStorage),
    reload: () => window.location.reload(),
  })
  return shared
}
