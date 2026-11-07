import { useCallback, useLayoutEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { RowsContext, type RowsState } from '@/hooks/use-rows'
import { browserRowsStore, subscribeToBrowserRowsStore, type RowsStore } from '@/lib/rows'

/**
 * Puts this device's rows on <html> as data-rows (lib/rows.ts).
 * FoundationProviders renders it; an app doesn't. Without `picker` the
 * rows stay compact and a saved choice is ignored.
 */
export function RowsProvider({
  picker = false,
  store = browserRowsStore,
  children,
}: {
  picker?: boolean
  /** For tests; the browser's localStorage by default. */
  store?: RowsStore
  children: ReactNode
}) {
  const subscribe = useCallback(
    (listener: () => void) => (store === browserRowsStore ? subscribeToBrowserRowsStore(listener) : store.subscribe(listener)),
    [store],
  )
  const saved = useSyncExternalStore(subscribe, store.get, () => null)
  const rows = (picker && saved) || 'compact'

  // Before paint, so the first frame already has the rows.
  useLayoutEffect(() => {
    const root = document.documentElement
    if (rows === 'compact') delete root.dataset.rows
    else root.dataset.rows = rows
    return () => {
      delete root.dataset.rows
    }
  }, [rows])

  const value = useMemo<RowsState>(
    () => ({
      rows,
      picker,
      setRows: (next) => {
        if (picker) store.set(next)
      },
    }),
    [rows, picker, store],
  )
  return <RowsContext.Provider value={value}>{children}</RowsContext.Provider>
}
