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
// - `notify.failed("Couldn't save The Long Walk: the server didn't
//   answer.")`: an error toast that stays until it's closed. Only as the
//   fallback, when what failed is no longer on screen (useAction does
//   this); an action whose button is still there shows its error beside
//   it (ActionError).
import { toast } from 'sonner'
import { messageOf } from './edit-in-place-store'

export type NotifyDoneOptions = {
  /** Undo's action: restores what was done. Undo shows only when it's given. */
  undo?: () => unknown
  /** The verb once Undo has worked: "Restored" unless set ("Unarchived"). */
  undone?: string
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

function done(verb: string, name: string, { undo, undone = 'Restored' }: NotifyDoneOptions = {}) {
  return toast.success(doneMessage(verb, name), {
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
      : undefined,
  })
}

export const notify = { done, failed }
