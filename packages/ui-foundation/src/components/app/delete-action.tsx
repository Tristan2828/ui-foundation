// The one delete (4.90, the dialogs and feedback standard D1): a record's
// Delete in its header and a row's delete in a table both use it.
//
// - The confirm asks "Delete <name>?" and says what happens, by `kind`:
//   `soft` "It goes to Deleted, and Restore brings it back.", `hard` "This
//   can't be undone." A confirm dialog (420px; a bottom sheet on a phone,
//   the action above Cancel), Cancel first, then the filled red button.
// - A failed delete keeps the dialog open with the reason in a Notice and
//   Try again (useAction, ActionError). A slow one spins in the button.
// - Done: the dialog closes, `onDeleted` runs (leave the record's page),
//   and the toast says "Deleted <name>". A soft delete's toast has Undo
//   (`onRestore`), then "Restored <name>".
// - `verb` covers the other ways something leaves a list: `verb="Retire"`
//   asks "Retire <name>?" on a "Retire" button and says "Retired <name>".
//
// The trigger is an icon (IconAction's Trash2) unless `trigger` says
// otherwise: `"button"` for a "Delete" button in words, an element of the
// caller's, or `null` for none, opened with `open`/`onOpenChange` (a row's
// menu item).
import { useState, type ReactElement, type ReactNode } from 'react'
import { Trash2Icon } from 'lucide-react'
import { useAction } from '@/hooks/use-action'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { ActionError } from './action-error'
import { IconAction } from './icon-action'
import { notify, pastTense } from './notify'

export type DeleteKind = 'soft' | 'hard'

export type DeleteActionProps = {
  /** What's deleted, as the page names it: "The Long Walk". */
  name: string
  /** `soft`: it goes to Deleted and Restore brings it back. `hard`: it's gone. */
  kind: DeleteKind
  /** Deletes it. A rejection keeps the dialog open with the reason. */
  onDelete: () => Promise<unknown>
  /** A soft delete's Undo: restores it. Without it the toast has no Undo. */
  onRestore?: () => Promise<unknown>
  /** After it's deleted and the toast is up: leave the record's page, say. */
  onDeleted?: () => void
  /** The action's word, "Delete" unless set ("Retire"). */
  verb?: string
  /** The word once it's done, "Deleted" unless set. Defaults to `verb` + "d" ("Retired"), or + "ed". */
  verbDone?: string
  /** Another sentence under the question than `kind`'s. */
  description?: ReactNode
  /** `"icon"` (the default), `"button"` (the verb in words), an element to open it, or `null` for none. */
  trigger?: 'icon' | 'button' | ReactElement | null
  /** The icon trigger's size: `default` (36px, a header) or `sm` (32px, a row). */
  size?: 'default' | 'sm'
  /** Open it from outside, with `trigger={null}`. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const SAYS: Record<DeleteKind, string> = {
  soft: 'It goes to Deleted, and Restore brings it back.',
  hard: 'This can’t be undone.',
}

export function DeleteAction({
  name,
  kind,
  onDelete,
  onRestore,
  onDeleted,
  verb = 'Delete',
  verbDone,
  description,
  trigger = 'icon',
  size = 'default',
  open: openProp,
  onOpenChange,
}: DeleteActionProps) {
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenState(next)
    onOpenChange?.(next)
  }
  const done = verbDone ?? pastTense(verb)
  const remove = useAction(onDelete, { failed: `Couldn't ${verb.toLowerCase()} ${name}` })

  const confirm = async () => {
    const outcome = await remove.run()
    if (!outcome.ok) return
    // Whether or not this is still on screen: a row's delete is gone with
    // its row once the list refetches, and the toast must still show.
    notify.done(done, name, kind === 'soft' && onRestore ? { undo: onRestore } : {})
    setOpen(false)
    onDeleted?.()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (remove.pending) return
        if (!next) remove.reset()
        setOpen(next)
      }}
    >
      {trigger === 'icon' && (
        <DialogTrigger render={<IconAction icon={Trash2Icon} label={verb} tone="destructive" size={size} />} />
      )}
      {trigger === 'button' && (
        <DialogTrigger render={<Button variant="outline" size={size === 'sm' ? 'sm' : 'default'} />}>{verb}</DialogTrigger>
      )}
      {trigger && typeof trigger === 'object' && <DialogTrigger render={trigger} />}
      <DialogContent size="confirm" data-slot="delete-action" data-kind={kind}>
        <DialogHeader>
          <DialogTitle>
            {verb} {name}?
          </DialogTitle>
          <DialogDescription>{description ?? SAYS[kind]}</DialogDescription>
        </DialogHeader>
        {/* Try again is the whole confirm again: the toast and closing included. */}
        <ActionError action={{ ...remove, retry: confirm }} />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={remove.pending} />}>Cancel</DialogClose>
          <Button variant="destructive" disabled={remove.pending} onClick={() => void confirm()}>
            {remove.pending && <Spinner className="size-4" />}
            {verb}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
