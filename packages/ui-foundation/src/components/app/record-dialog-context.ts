// The record dialog's state and hooks (record-dialog.tsx has the parts).
// A record opened over its list is the record's own address with the list's
// address in the history entry's state: `{ recordDialog: <the list's
// location> }`. RecordDialogRoute reads it to draw the list under the
// dialog, at the list's address (its filters, sort and page as they were),
// and an address with no such state (a link pasted, a reload in a new tab,
// "Open full page") is the record's full page.
import { createContext, useCallback, useContext } from 'react'
import { useLocation, useNavigate, type Location } from 'react-router'

/**
 * Where a record dialog was opened from: the list's address, and how many
 * history entries the dialog has pushed since (1, or more after a linked
 * record opened inside it), which Close goes back over.
 */
export type RecordDialogBackground = Pick<Location, 'pathname' | 'search' | 'hash'> & { depth: number }

export type RecordDialogState = { recordDialog: RecordDialogBackground }

export function backgroundOf(state: unknown): RecordDialogBackground | null {
  if (typeof state !== 'object' || state === null || !('recordDialog' in state)) return null
  const background = (state as RecordDialogState).recordDialog
  return typeof background?.pathname === 'string' && typeof background.depth === 'number' ? background : null
}

/**
 * The history state that opens a record over the list it's on: pass it as
 * a `<Link>`'s `state` (or use `<RecordLink>`, or `useOpenRecord`). Opened
 * from inside a dialog (a linked record), the new one opens over the same
 * list.
 */
export function recordDialogState(location: Pick<Location, 'pathname' | 'search' | 'hash' | 'state'>): RecordDialogState {
  const open = backgroundOf(location.state)
  return {
    recordDialog: open
      ? { ...open, depth: open.depth + 1 }
      : { pathname: location.pathname, search: location.search, hash: location.hash, depth: 1 },
  }
}

/**
 * Opens a record over the current list: `open('/widgets/3')` for a
 * DataTable's `onRowClick`, say. The record's address goes in the address
 * bar and history, so Back closes it.
 */
export function useOpenRecord(): (to: string) => void {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback((to: string) => void navigate(to, { state: recordDialogState(location) }), [navigate, location])
}

export type RecordDialogContextValue = {
  /** The dialog's title id: EntityView puts it on its heading. */
  titleId: string
  /** Closes the dialog: back to the list, as Back does. */
  close: () => void
}

export const RecordDialogContext = createContext<RecordDialogContextValue | null>(null)

/**
 * Inside a record dialog, its `close` (a Delete that has just removed the
 * record closes the dialog rather than going to the list's page); `null`
 * on the record's full page.
 */
export function useRecordDialog(): RecordDialogContextValue | null {
  return useContext(RecordDialogContext)
}

export type NewRecordDialogContextValue = {
  /** Closes the new record's form: back to the list, as Back does. */
  close: () => void
  /**
   * After the save: the new record, over the same list (this entry
   * replaced, so Back from it is the list). `open('/widgets/12')`.
   */
  openRecord: (to: string) => void
}

export const NewRecordDialogContext = createContext<NewRecordDialogContextValue | null>(null)

/**
 * Inside RecordDialogRoute's `newPath` route (`/widgets/new`): its `close`
 * and `openRecord`. FormDialog reads it to open itself over the list with
 * no `open` of its own; the route's form calls `openRecord` once it has
 * saved. `null` anywhere else.
 */
export function useNewRecordDialog(): NewRecordDialogContextValue | null {
  return useContext(NewRecordDialogContext)
}
