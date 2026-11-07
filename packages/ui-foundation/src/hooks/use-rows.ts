import { createContext, useContext } from 'react'
import type { RowsName } from '@/lib/rows'

// What RowsProvider (components/app/rows-provider.tsx, rendered by
// FoundationProviders) knows about this device's table rows.

export type RowsState = {
  /** The rows on screen: 'compact' unless this device picked 'regular'. */
  rows: RowsName
  /** Whether this app lets a device pick (FoundationProviders' `rowsPicker`). */
  picker: boolean
  /** Saves `rows` as this device's choice. Does nothing without the picker. */
  setRows: (rows: RowsName) => void
}

const NO_PICKER: RowsState = { rows: 'compact', picker: false, setRows: () => {} }

export const RowsContext = createContext<RowsState>(NO_PICKER)

/** This device's table rows and, with the picker on, a way to change them. */
export function useRows(): RowsState {
  return useContext(RowsContext)
}
