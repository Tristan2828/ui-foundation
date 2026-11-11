// A small form in a dialog (4.82): a new record of up to about eight
// fields over its list, or any short form a page opens (a weak spot, a
// quick add). The title and the buttons stay put and the fields scroll
// between them; 640px wide (DialogContent `size="form"`), the whole screen
// on a phone, with Cancel and the submit button as two wide buttons.
//
// Two ways to open one:
//
// - Anywhere, with `open` and `onOpenChange`, as any dialog.
// - As RecordDialogRoute's `newPath` route (`/widgets/new`), with neither:
//   the route opens it over the list and closing goes back, as a record's
//   dialog does. After the save, `useNewRecordDialog().openRecord(to)`
//   opens the new record over the same list.
//
// `dirty` (react-hook-form's `formState.isDirty`) makes Esc, the close
// button, a click outside and Cancel ask "Discard your changes?" first.
// As a list's `new` route, `dirty` also guards leaving by a link, Back or
// the sidebar (FormLeaveGuard, 4.85), as EntityForm's does.
// A failed save is a Notice above the buttons with Try again, which
// submits again unless `onRetry` says otherwise; what was typed stays.
//
// The form is the app's: its fields, its schema and its react-hook-form
// wiring, as with EntityForm. This draws the chrome around them.
import { useId, useLayoutEffect, useRef, type FormEvent, type ReactNode } from 'react'
import { cn } from 'cn'
import type { AppError } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { FormLeaveGuard } from './form-leave-guard'
import { Notice } from './notice'
import { useNewRecordDialog } from './record-dialog-context'

export type FormDialogProps = {
  /** "New book": the dialog's name. */
  title: string
  /** One short line under the title, only where the title can't say it. */
  description?: ReactNode
  /**
   * Whether it's open. Leave it out inside RecordDialogRoute's `newPath`
   * route, which opens it; anywhere else it's closed until it's given.
   */
  open?: boolean
  /** Asked to close (Esc, the close button, a click outside, Cancel). */
  onOpenChange?: (open: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  isSubmitting: boolean
  /** "Add book": the word Add on every create form. */
  submitLabel: string
  /** A save that failed: a Notice above the buttons, with Try again. */
  submitError?: AppError | null
  /** Try again's action. Defaults to submitting the form again. */
  onRetry?: () => void
  /** Something was typed: closing asks "Discard your changes?" first. */
  dirty?: boolean
  /** The fields. */
  children: ReactNode
  className?: string
}

export function FormDialog({
  title,
  description,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  submitLabel,
  submitError,
  onRetry,
  dirty = false,
  children,
  className,
}: FormDialogProps) {
  const route = useNewRecordDialog()
  const form = useRef<HTMLFormElement>(null)
  const formId = useId()
  const isOpen = open ?? route !== null
  // The route guard lets through the dialog's own close (it has asked
  // already) and the save's move to the new record.
  const leaving = useRef(false)
  const submitting = useRef(isSubmitting)
  useLayoutEffect(() => {
    submitting.current = isSubmitting
  })
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        if (onOpenChange) onOpenChange(next)
        else if (!next) {
          leaving.current = true
          route?.close()
        }
      }}
    >
      <DialogContent size="form" dirty={dirty} data-slot="form-dialog" className={cn('gap-0 p-0', className)}>
        <div data-slot="form-dialog-header" className="flex flex-col gap-1 px-4 pt-4 pb-2 pr-12 md:px-6 md:pt-5 md:pr-14">
          <DialogTitle className="type-section-title">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </div>
        <form
          ref={form}
          id={formId}
          onSubmit={onSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div data-slot="form-dialog-body" className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
            <FieldGroup>{children}</FieldGroup>
          </div>
          <div data-slot="form-dialog-bar" className="flex flex-col gap-3 border-t px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-6 md:pb-3">
            {/* Always there, so a failure that appears is announced. */}
            <div role="status" className="empty:hidden">
              {submitError && (
                <Notice
                  tone="destructive"
                  action={
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isSubmitting}
                      onClick={() => (onRetry ? onRetry() : form.current?.requestSubmit())}
                    >
                      Try again
                    </Button>
                  }
                >
                  {submitError.message}
                </Notice>
              )}
            </div>
            <div className="flex justify-end gap-2 max-md:[&>*]:h-10 max-md:[&>*]:flex-1">
              <DialogClose render={<Button type="button" variant="outline" disabled={isSubmitting} />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Spinner className="size-4" />}
                {submitLabel}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
      {route && open === undefined && (
        <FormLeaveGuard dirty={dirty} letThrough={() => leaving.current || submitting.current} />
      )}
    </Dialog>
  )
}
