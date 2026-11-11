// Leaving a form with something typed (4.85, the form standard's F8):
// "Discard your changes?" (Keep editing, Discard), the prompt a dialog
// and a value edited in place ask with, before a link, Back or the
// sidebar moves to another page; the browser's own prompt before a reload
// or closing the tab. Nothing typed, nothing asked.
//
// EntityForm renders it when it's given `dirty`, and FormDialog when it
// is a list's `new` route. React Router's useBlocker, so it needs a data
// router (createBrowserRouter), as EditableValue's guard does.
//
// `letThrough` is read when a move starts: true while the form is saving
// (the save's own navigate to the new record must not ask), and once the
// form has already asked (its Cancel) or the move is its own close.
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useBlocker } from 'react-router'
import { DiscardChangesDialog } from '@/components/ui/dialog'

export function FormLeaveGuard({ dirty, letThrough }: { dirty: boolean; letThrough: () => boolean }) {
  const latest = useRef({ dirty, letThrough })
  useLayoutEffect(() => {
    latest.current = { dirty, letThrough }
  })
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      latest.current.dirty && !latest.current.letThrough() && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (latest.current.letThrough()) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  return (
    <DiscardChangesDialog
      open={blocker.state === 'blocked'}
      data-form-leave-guard=""
      onKeepEditing={() => {
        if (blocker.state === 'blocked') blocker.reset()
      }}
      onDiscard={() => {
        if (blocker.state === 'blocked') blocker.proceed()
      }}
    />
  )
}
