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
// about the rest. An EntityView or a DataTable inside a scope keeps its
// own.
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { EditInPlaceContext } from './edit-in-place'
import { EditInPlaceStore } from './edit-in-place-store'
import { LeaveGuard } from './editable-value'

export type EditInPlaceScopeProps = {
  children: ReactNode
}

export function EditInPlaceScope({ children }: EditInPlaceScopeProps) {
  const [store] = useState(() => new EditInPlaceStore())
  // The leave-page prompt only while a value is open (or one is always
  // editable), so a page nobody's editing never blocks anything.
  const editing = useSyncExternalStore(
    store.subscribe,
    () => store.editing,
    () => store.editing,
  )
  return (
    <EditInPlaceContext.Provider value={store}>
      {editing && <LeaveGuard store={store} />}
      {children}
    </EditInPlaceContext.Provider>
  )
}
