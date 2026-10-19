import { useSyncExternalStore } from 'react'

// Whether the person asked their system for less motion, kept current as
// they change it. A screen swaps movement (a sweeping ring, a breathing
// circle) for a fade or a still state while it's true.
const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const getSnapshot = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(QUERY).matches

/** True while the system asks for reduced motion; false where it can't be read (and on the server). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
