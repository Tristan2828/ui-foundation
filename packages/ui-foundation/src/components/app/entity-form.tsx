// Generic create/edit form chrome: title, field layout, a banner for
// non-field errors, and the cancel/submit footer. Deliberately thin: each
// entity screen still owns its own zod schema, its own <Field> markup, and
// its own react-hook-form wiring; this component does not attempt to
// generate fields from a schema.
import type { FormEvent, ReactNode } from 'react'
import type { AppError } from '@/api/contracts'
import { ErrorState } from '@/components/app/error-state'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'

export type EntityFormProps = {
  title: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  isSubmitting: boolean
  submitError?: AppError | null
  submitLabel: string
  onCancel: () => void
  /** An edit-only destructive action (e.g. delete), shown opposite Cancel/Submit. */
  danger?: ReactNode
  children: ReactNode
}

export function EntityForm({
  title,
  onSubmit,
  isSubmitting,
  submitError,
  submitLabel,
  onCancel,
  danger,
  children,
}: EntityFormProps) {
  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-6">
      <h1 className="type-page-title text-foreground">{title}</h1>

      <FieldGroup>{children}</FieldGroup>

      {submitError && (
        <ErrorState error={submitError} className="border border-dashed border-destructive/30" />
      )}

      <div className={`flex items-center gap-2 ${danger ? 'justify-between' : 'justify-end'}`}>
        {danger}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Spinner className="size-4" />}
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}
