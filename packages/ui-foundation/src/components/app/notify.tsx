// The words and the lifetimes of the app's toasts (4.90, the dialogs and
// feedback standard D5, D6). A toast is for what happened out of sight: a
// delete (with Undo), a record made somewhere else, a job that finished
// after the page was left. Never after an edit in place, which shows its
// own "Saved" (cell-patterns.md, add-an-entity.md "When a toast shows").
//
// - `notify.done("Deleted", "The Long Walk", { undo })`: "Deleted The Long
//   Walk", the verb first, the same way everywhere, for 4 seconds. With
//   `undo`, an Undo button that runs it, then "Restored The Long Walk"; an
//   Undo that fails is a toast that stays.
// - `notify.done("Added", "The Long Walk", { open: "/books/7" })`: the same
//   toast with an Open link to the new record, for a record made from a
//   page that stays put (a dialog over a page of tiles). A real link (the
//   router's `Link`), named "Open The Long Walk", reached by Tab once the
//   toaster has focus (Alt+T); it closes the toast as it goes. Same 4
//   seconds. `{ to, label: "View" }` changes its word.
// - `notify.failed("Couldn't save The Long Walk: the server didn't
//   answer.")`: an error toast that stays until it's closed. Only as the
//   fallback, when what failed is no longer on screen (useAction does
//   this); an action whose button is still there shows its error beside
//   it (ActionError).
import { Link, type To } from 'react-router'
import { toast } from 'sonner'
import { messageOf } from './edit-in-place-store'

/** Where Open goes: a path, or `{ to, label }` to change its word ("View"). */
export type NotifyOpen = To | { to: To; label?: string }

export type NotifyDoneOptions = {
  /** Undo's action: restores what was done. Undo shows only when it's given. */
  undo?: () => unknown
  /** The verb once Undo has worked: "Restored" unless set ("Unarchived"). */
  undone?: string
  /**
   * An Open link to the record the toast names: a path, or `{ to, label }`.
   * For a record made where the person stays. With Undo too, both
   * show, Open first.
   */
  open?: NotifyOpen
}

/** "Deleted The Long Walk": the verb, then the name. */
export function doneMessage(verb: string, name: string) {
  return `${verb} ${name}`
}

/** "Retire" → "Retired", "Archive" → "Archived", "Remove" → "Removed". */
export function pastTense(verb: string) {
  return verb.endsWith('e') ? `${verb}d` : `${verb}ed`
}

function failed(message: string) {
  return toast.error(message, { duration: Number.POSITIVE_INFINITY, closeButton: true })
}

/** `open` as a link and its word: "Open" unless `{ label }` says otherwise. */
export function openTarget(open: NotifyOpen): { to: To; label: string } {
  if (typeof open === 'object' && 'to' in open) return { to: open.to, label: open.label ?? 'Open' }
  return { to: open, label: 'Open' }
}

function done(verb: string, name: string, { undo, undone = 'Restored', open }: NotifyDoneOptions = {}) {
  let id: string | number | undefined = undefined
  const target = open === undefined ? undefined : openTarget(open)
  // A link, not a button that navigates: the router's Link inside the
  // shell's Toaster (it sits under the router), so it can be opened in a
  // new tab too. `data-button` takes sonner's own action look, Undo's.
  const link = target && (
    <Link
      to={target.to}
      data-button=""
      data-action=""
      aria-label={`${target.label} ${name}`}
      onClick={() => toast.dismiss(id)}
    >
      {target.label}
    </Link>
  )
  id = toast.success(doneMessage(verb, name), {
    // With Undo as the action, Open takes the slot before it.
    cancel: undo ? link : undefined,
    action: undo
      ? {
          label: 'Undo',
          onClick: () => {
            // A promise from here, not a mutation's callbacks: whatever
            // asked for the toast may be gone (a record's page, left after
            // its delete) by the time Undo is pressed.
            Promise.resolve()
              .then(undo)
              .then(
                () => toast.success(doneMessage(undone, name)),
                (error: unknown) => failed(`Couldn't undo: ${messageOf(error)}`),
              )
          },
        }
      : link,
  })
  return id
}

export const notify = { done, failed }
