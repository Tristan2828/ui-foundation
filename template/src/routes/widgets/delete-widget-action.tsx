// Delete, in the widget view's header: the foundation's DeleteAction (the
// dialogs and feedback standard D1). An icon opens the confirm, which
// says the delete is soft ("It goes to Deleted, and Restore brings it
// back."); a failed delete keeps it open with the reason and Try again.
// Once it's deleted, the caller leaves the page (onDeleted) and the toast
// "Deleted <name>" offers Undo, which restores the widget.
import { DeleteAction } from '@tristan2828/ui-foundation'
import type { components } from '@/api/schema'
import { useDeleteWidgetMutation, useRestoreWidgetMutation } from './use-widgets'

type Widget = components['schemas']['Widget']

export function DeleteWidgetAction({ widget, onDeleted }: { widget: Widget; onDeleted: () => void }) {
  const deleteWidget = useDeleteWidgetMutation()
  const restoreWidget = useRestoreWidgetMutation()

  return (
    <DeleteAction
      name={widget.name}
      kind="soft"
      // mutateAsync, not mutate's callbacks: the view is gone (onDeleted
      // left the page) by the time Undo is pressed, and a mutation's
      // callbacks don't run for an unmounted one.
      onDelete={() => deleteWidget.mutateAsync(widget.id)}
      onRestore={() => restoreWidget.mutateAsync(widget.id)}
      onDeleted={onDeleted}
    />
  )
}
