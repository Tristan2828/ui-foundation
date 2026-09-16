// Generic create/edit form chrome: title, field layout, a banner for
// non-field errors, and the cancel/submit footer. Deliberately thin — see
// docs/BUILD-PLAN.md Phase 4 "Scope Ceiling" (exactly three app/
// composites). Each entity screen still owns its own zod schema, its own
// <Field> markup, and its own react-hook-form wiring; this component does
// not attempt to generate fields from a schema.
import type { FormEvent, ReactNode } from 'react'
import type { AppError } from '@/api/contracts'
import { ErrorState } from '@/components/app/error-state'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'

export function EntityForm({
  title,
  onSubmit,
  isSubmitting,
  submitError,
  submitLabel,
  onCancel,
  children,
}: {
  title: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  isSubmitting: boolean
  submitError?: AppError | null
  submitLabel: string
  onCancel: () => void
  children: ReactNode
}) {
  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-6">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>

      <FieldGroup>{children}</FieldGroup>

      {submitError && (
        <ErrorState error={submitError} className="border border-dashed border-destructive/30" />
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Spinner className="size-4" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
