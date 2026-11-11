import { useSyncExternalStore } from 'react'

// Whether the screen is under 48rem (useIsMobile's 768px), read through
// matchMedia as a store, so rendering on the server or where matchMedia is
// missing (a test's DOM) gives "not a phone" instead of failing on
// `window`. DataTable's row list, FilterBar and SecondaryFilters' sheet
// read it, so they always agree.
const PHONE_QUERY = '(max-width: 767px)'
const canMatchMedia = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'

function subscribe(listener: () => void) {
  if (!canMatchMedia()) return () => {}
  const query = window.matchMedia(PHONE_QUERY)
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}

export function useIsPhone() {
  return useSyncExternalStore(
    subscribe,
    () => canMatchMedia() && window.matchMedia(PHONE_QUERY).matches,
    () => false,
  )
}
