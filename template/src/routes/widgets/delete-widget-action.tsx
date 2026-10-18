// Delete, in the widget view's header: a confirm dialog, then the caller
// leaves the page (onDeleted), since the record it shows is gone. The
// dialog stays open on a failed delete, with a toast saying why. The
// delete is soft (issue #137), so the success toast offers Undo, which
// restores the widget.
import { TrashIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@tristan2828/ui-foundation/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@tristan2828/ui-foundation/ui/dialog'
import { Spinner } from '@tristan2828/ui-foundation/ui/spinner'
import type { components } from '@/api/schema'
import { useDeleteWidgetMutation, useRestoreWidgetMutation } from './use-widgets'

type Widget = components['schemas']['Widget']

export function DeleteWidgetAction({ widget, onDeleted }: { widget: Widget; onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const deleteWidget = useDeleteWidgetMutation()
  const restoreWidget = useRestoreWidgetMutation()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <TrashIcon className="text-destructive" />
        Delete
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {widget.name}?</DialogTitle>
          <DialogDescription>You can undo this right after.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            variant="destructive"
            disabled={deleteWidget.isPending}
            onClick={() => {
              deleteWidget.mutate(widget.id, {
                onSuccess: () => {
                  toast.success(`${widget.name} deleted`, {
                    action: {
                      label: 'Undo',
                      // mutateAsync, not mutate's callbacks: this component is
                      // gone (onDeleted left the page) by the time Undo is clicked,
                      // and a mutation's callbacks don't run for an unmounted one.
                      onClick: () => {
                        restoreWidget
                          .mutateAsync(widget.id)
                          .then(() => toast.success(`${widget.name} restored`))
                          .catch((error: Error) => toast.error(error.message))
                      },
                    },
                  })
                  setOpen(false)
                  onDeleted()
                },
                onError: (error) => {
                  toast.error(error.message)
                },
              })
            }}
          >
            {deleteWidget.isPending && <Spinner className="size-4" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
