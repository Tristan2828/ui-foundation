// A form's save refused because the record changed elsewhere (a 409,
// AppError kind `conflict`; useFormVersion): the Notice EntityForm and
// FormDialog put in their bar, above the buttons, in place of a failed
// save's. Warning, not destructive: nothing went wrong, two writers met.
// It says nothing was saved, that what's typed is still here, and what
// each button does, so Show Saved never drops the typing unannounced.
import { Button } from '@/components/ui/button'
import type { FormConflict } from '@/hooks/use-form-version'
import { Notice } from './notice'

export const FORM_CONFLICT_MESSAGE =
  'This was saved elsewhere (another tab, device or chat) after you opened it, so nothing was saved. ' +
  'What you typed is still here: Keep Mine saves this form as it is over that, Show Saved drops your changes and shows what was saved.'

export function FormConflictNotice({
  conflict,
  isSubmitting,
  onKeepMine,
}: {
  conflict: FormConflict
  isSubmitting: boolean
  /** Keep Mine's click: the conflict's own, then the form submits again. */
  onKeepMine: () => void
}) {
  const waiting = conflict.loading === true || isSubmitting
  return (
    <Notice
      tone="warning"
      title="Changed elsewhere"
      action={
        <>
          <Button type="button" size="sm" variant="outline" disabled={waiting} onClick={conflict.onShowSaved}>
            Show Saved
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={waiting} onClick={onKeepMine}>
            Keep Mine
          </Button>
        </>
      }
    >
      <span data-slot="form-conflict">{FORM_CONFLICT_MESSAGE}</span>
    </Notice>
  )
}
