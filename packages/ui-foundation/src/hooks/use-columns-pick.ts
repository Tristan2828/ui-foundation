// DataTable's Columns menu pick (`columnsMenu`), remembered on this device
// under the list's `storageKey` in the same store as a table's layout and
// grouping (use-table-layout.ts). The format is table-columns.ts's.
import { useCallback, useSyncExternalStore } from 'react'
import { parseColumnsPick, type ColumnsPick } from '@/components/app/table-columns'
import { browserStore } from './use-table-layout'

/** The pick stored under `key`, read and written through the device's store. */
export function useColumnsPick(key: string | undefined) {
  const subscribe = useCallback(
    (listener: () => void) => (key === undefined ? () => {} : browserStore.subscribe(key, listener)),
    [key],
  )
  const raw = useSyncExternalStore(
    subscribe,
    () => (key === undefined ? null : browserStore.get(key)),
    () => null,
  )
  const pick = parseColumnsPick(raw)
  const setPick = (next: ColumnsPick | null) => {
    if (key === undefined) return
    browserStore.set(key, next === null ? '' : JSON.stringify(next))
  }
  return [pick, setPick] as const
}
