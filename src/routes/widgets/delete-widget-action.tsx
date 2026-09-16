// Split out of widgets-columns.tsx: eslint-plugin-react-refresh flags a file
// that exports both a component and a non-component (buildWidgetsColumns) —
// same fast-refresh hazard Phase 3 hit splitting src/auth/. See
// docs/phases/phase-3.md.
import { TrashIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
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
import type { components } from '@/api/schema'
import { useDeleteWidgetMutation } from './use-widgets'

type Widget = components['schemas']['Widget']

export function DeleteWidgetAction({ widget }: { widget: Widget }) {
  const [open, setOpen] = useState(false)
  const deleteWidget = useDeleteWidgetMutation()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Delete ${widget.name}`} />}>
        <TrashIcon className="text-destructive" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {widget.name}?</DialogTitle>
          <DialogDescription>This cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            variant="destructive"
            disabled={deleteWidget.isPending}
            onClick={() => {
              deleteWidget.mutate(widget.id, {
                onSuccess: () => {
                  toast.success(`${widget.name} deleted`)
                  setOpen(false)
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
