import { toast } from 'sonner'
import type { LostEdit } from './edit-in-place-store'

/**
 * A field that left the page (unmounted: a closed tab, a collapsed
 * section) and whose last save then failed: said in a toast that stays
 * until it's dismissed, with the reason, and for text a "Copy Text" that
 * puts what was typed on the clipboard, since nothing on screen holds it
 * any more. Every store EntityView, DataTable and EditInPlaceScope make
 * calls it (EditInPlaceStoreOptions' `onLost`).
 */
export function toastLostEdit({ label, value, reason }: LostEdit) {
  const text = typeof value === 'string' && value.trim() !== '' ? value : null
  const id = toast.error(`Couldn't save ${label}`, {
    description: text ? `${reason} It's no longer on the page: copy what you typed to keep it.` : reason,
    duration: Infinity,
    action: text
      ? {
          label: 'Copy Text',
          onClick: (event) => {
            // The toast stays until the copy is done: it holds the only copy.
            event.preventDefault()
            void navigator.clipboard.writeText(text).then(
              () => {
                toast.dismiss(id)
                toast.success('Copied what you typed')
              },
              () => toast.error("Couldn't copy it", { description: 'The browser kept the clipboard closed. Copy Text tries again.' }),
            )
          },
        }
      : undefined,
  })
}
