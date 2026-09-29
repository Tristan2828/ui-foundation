import { useEffect, useState } from 'react'

// `value`, once it has stopped changing for `delayMs`. Used to keep a
// search box from sending one request per keystroke; the input itself stays
// bound to the live value so typing never lags.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timeout)
  }, [value, delayMs])

  return debounced
}
