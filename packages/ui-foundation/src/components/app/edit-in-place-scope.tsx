// Editing in place on a page of the app's own: one that isn't a record's
// view or a table. EntityView and DataTable each run it for what's inside
// them (one field open at a time, autosave, the leave-page prompt); a page
// built from other parts, such as a notes screen that is nothing but its
// text, wraps those parts in this and uses <EditableValue> inside, with
// the same rules (cell-patterns.md "Editable value").
//
// Everything inside one scope is one page's worth of editing: opening a
// value saves the open one first, and leaving the page (a link, Back,
// closing the tab, hiding it on a phone) saves what autosaves and asks
// about the rest.
//
// One scope per page, around everything editable on it, not one per
// value, and not on a page that has an EntityView or a DataTable (each
// runs its own). Every one of them renders a leave guard, which takes
// React Router's blocker, and the router holds one blocker at a time. A
// scope holds any number of always-editable values, such as a notes
// app's open tabs kept mounted with only the one in front shown.
//
// When those tabs are URLs (/notes/1, /notes/2), `staysOnPage` says a move
// between them isn't leaving: it's never held for a save or asked about,
// and each tab's text goes on saving itself. A value taken off the page
// (a tab closed) still saves what it holds; if that save fails, a toast
// says so and offers the text (toastLostEdit), and `onLostEdit` lets the
// app do more, such as open the record again.
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { Location } from 'react-router'
import { EditInPlaceContext } from './edit-in-place'
import { EditInPlaceStore, type LostEdit } from './edit-in-place-store'
import { LeaveGuard } from './editable-value'
import { toastLostEdit } from './lost-edit-toast'

export type { LostEdit }

export type EditInPlaceScopeProps = {
  children: ReactNode
  /**
   * Whether a move to another path stays on this page: true for one that
   * only brings another of the scope's own kept-mounted panes to the front
   * (`(next) => matchPath('/notes/:id', next.pathname) !== null`). A move
   * that stays is never blocked and saves nothing early. Without it, every
   * move to another path is leaving the page.
   */
  staysOnPage?: (next: Location, current: Location) => boolean
  /**
   * A value that left the page (unmounted) holding something that then
   * couldn't be saved. The toast shows either way; this is for the app to
   * do more with `value`, what was typed, such as reopen its record.
   */
  onLostEdit?: (lost: LostEdit) => void
}

export function EditInPlaceScope({ children, staysOnPage, onLostEdit }: EditInPlaceScopeProps) {
  const [store] = useState(() => new EditInPlaceStore({ onLost: toastLostEdit }))
  useEffect(() => (onLostEdit ? store.subscribeLost(onLostEdit) : undefined), [store, onLostEdit])
  // The leave-page prompt only while a value is open (or one is always
  // editable), so a page nobody's editing never blocks anything.
  const editing = useSyncExternalStore(
    store.subscribe,
    () => store.editing,
    () => store.editing,
  )
  return (
    <EditInPlaceContext.Provider value={store}>
      {editing && <LeaveGuard store={store} staysOnPage={staysOnPage} />}
      {children}
    </EditInPlaceContext.Provider>
  )
}
