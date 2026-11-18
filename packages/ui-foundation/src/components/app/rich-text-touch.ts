// Whether the editor is on a touch screen (review F11): where its toolbar
// is the bar pinned to the keyboard (rich-text-keyboard-bar.tsx), the
// floating bar over selected words gives way to the system's own, and the
// slash menu is capped to what the keyboard leaves visible.
import { useEffect, useState } from 'react'

const COARSE = '(pointer: coarse)'

/** Whether the pointer is a finger: where the editor's toolbar is the keyboard bar. */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(() => typeof window !== 'undefined' && window.matchMedia(COARSE).matches)
  useEffect(() => {
    const query = window.matchMedia(COARSE)
    const update = () => setCoarse(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return coarse
}
