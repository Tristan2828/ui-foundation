// Generic create/edit form chrome: title, field layout, a failed save, and
// the cancel/submit bar. Deliberately thin: each entity screen still owns
// its own zod schema, its own <Field> markup, and its own react-hook-form
// wiring; this component does not attempt to generate fields from a
// schema.
//
// The form standard (4.85) is drawn here and in Field:
//
// - Fields are a FieldGroup, so short ones share a row (`Field size`),
//   compact (32px controls, 14px between). `FormSection` groups them in
//   cards on a long form.
// - Add finds the problem: a submit that's refused moves to the first
//   field marked invalid (opening a fold around it) and the bar says how
//   many are left ("2 to fix"), from `errors` or the fields marked
//   `data-invalid`.
// - A failed save is a destructive Notice in the bar, above the buttons,
//   with Try again; what was typed stays.
// - The bar sticks to the bottom of the window while the form is taller
//   than it; on a phone, two wide buttons. It sets
//   `--toast-bottom-offset` on <html> to the room it takes, for anything
//   pinned to the bottom of the window to sit above it.
// - `dirty`: leaving (a link, Back, the sidebar, Cancel) asks "Discard
//   your changes?" first, and the browser asks before a reload. Nothing
//   typed, nothing asked.
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { AppError } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { DiscardChangesDialog } from '@/components/ui/dialog'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { countFormErrors } from '@/lib/form-errors'
import { FormLeaveGuard } from './form-leave-guard'
import { Notice } from './notice'

export type EntityFormProps = {
  /** "New book", "Edit book". */
  title: string
  /** The form's submit: react-hook-form's `handleSubmit(...)`, or any handler. */
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  isSubmitting: boolean
  /** A save that failed: a Notice above the buttons, with Try again. */
  submitError?: AppError | null
  /** Try again's action. Defaults to submitting the form again. */
  onRetry?: () => void
  /** "Add book": the word Add on every create form. */
  submitLabel: string
  onCancel: () => void
  /** An edit-only destructive action (e.g. delete), shown opposite Cancel/Submit. */
  danger?: ReactNode
  /**
   * Something was typed (react-hook-form's `formState.isDirty`): leaving
   * asks "Discard your changes?" first. Leave it out and nothing is
   * guarded. Needs a data router (createBrowserRouter).
   */
  dirty?: boolean
  /**
   * The form's errors (react-hook-form's `formState.errors`), counted for
   * the bar's "N to fix". Without it, the fields marked `data-invalid`
   * are counted.
   */
  errors?: object
  /**
   * The field to move to after a refused submit. Defaults to the first
   * control marked `aria-invalid`, or failing that the first Field marked
   * `data-invalid`.
   */
  firstInvalid?: (form: HTMLFormElement) => HTMLElement | null
  children: ReactNode
}

const FOCUSABLE =
  'input:not([type=hidden]), select, textarea, button, [contenteditable=true], [tabindex]:not([tabindex="-1"])'

function problemIn(form: HTMLFormElement): HTMLElement | null {
  return (
    form.querySelector<HTMLElement>('[aria-invalid=true]') ??
    form.querySelector<HTMLElement>('[data-slot=field][data-invalid=true]')
  )
}

/** Opens what hides it (a fold), then moves to it. */
function moveTo(target: HTMLElement, form: HTMLFormElement) {
  for (let at = target.parentElement; at && at !== form; at = at.parentElement) {
    if (at instanceof HTMLDetailsElement && !at.open) at.open = true
  }
  const control = target.matches(FOCUSABLE) ? target : (target.querySelector<HTMLElement>(FOCUSABLE) ?? target)
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  control.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' })
  // react-hook-form may have focused it already.
  if (!target.contains(document.activeElement)) control.focus({ preventScroll: true })
}

export function EntityForm({
  title,
  onSubmit,
  isSubmitting,
  submitError,
  onRetry,
  submitLabel,
  onCancel,
  danger,
  dirty,
  errors,
  firstInvalid,
  children,
}: EntityFormProps) {
  const form = useRef<HTMLFormElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  // A submit was refused: the bar counts what's left until it's none.
  const [refused, setRefused] = useState(false)
  const [marked, setMarked] = useState(0)
  const [askingCancel, setAskingCancel] = useState(false)
  // Moves the guard lets through: while saving, and once Cancel has asked.
  const leaving = useRef(false)
  const submitting = useRef(isSubmitting)
  useLayoutEffect(() => {
    submitting.current = isSubmitting
  })

  // Without `errors`, count the fields marked invalid, as they change,
  // while there's a count to show.
  const counted = errors !== undefined
  useEffect(() => {
    const element = form.current
    if (!refused || counted || !element) return
    const count = () => setMarked(element.querySelectorAll('[data-slot=field][data-invalid=true]').length)
    count()
    const observer = new MutationObserver(count)
    observer.observe(element, { subtree: true, attributes: true, attributeFilter: ['data-invalid'], childList: true })
    return () => observer.disconnect()
  }, [refused, counted])
  const toFix = refused ? (errors ? countFormErrors(errors) : marked) : 0

  // The room the stuck bar takes, for the toaster.
  useEffect(() => {
    const element = bar.current
    if (!element) return
    const root = document.documentElement
    const measure = () => {
      const bottom = Number.parseFloat(getComputedStyle(element).bottom) || 0
      root.style.setProperty('--toast-bottom-offset', `${Math.round(element.offsetHeight + bottom)}px`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--toast-bottom-offset')
    }
  }, [])

  // Each submit, once its validation is done: the effect below runs after
  // the render that draws react-hook-form's marks, and looks for them.
  const [attempt, setAttempt] = useState(0)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    const done = onSubmit(event)
    void Promise.resolve(done).then(() => setAttempt((count) => count + 1))
  }
  const findInvalid = useRef(firstInvalid)
  useLayoutEffect(() => {
    findInvalid.current = firstInvalid
  })
  useEffect(() => {
    const element = form.current
    if (attempt === 0 || !element) return
    const target = findInvalid.current ? findInvalid.current(element) : problemIn(element)
    setRefused(target !== null)
    if (target) moveTo(target, element)
  }, [attempt])

  const cancel = () => {
    if (dirty) {
      setAskingCancel(true)
      return
    }
    onCancel()
  }

  return (
    <form ref={form} onSubmit={submit} noValidate data-slot="entity-form" className="flex max-w-xl flex-col gap-6">
      <h1 className="type-page-title text-foreground">{title}</h1>

      <FieldGroup>{children}</FieldGroup>

      {/* A child of the form itself, so it sticks for the form's whole
          height, with a failed save's Notice in it, so the Notice is on
          screen with the buttons however long the form. */}
      <div
        ref={bar}
        data-slot="entity-form-bar"
        className="sticky z-10 -mt-3 flex flex-col gap-3 border-t border-border bg-background pt-3"
      >
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
                  Try Again
                </Button>
              }
            >
              {submitError.message}
            </Notice>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {danger}
          <p role="status" data-slot="entity-form-to-fix" className="mr-auto type-label text-destructive-text empty:hidden">
            {toFix > 0 ? `${toFix} to fix` : ''}
          </p>
          <div className="ml-auto flex gap-2 max-md:w-full max-md:[&>*]:flex-1">
            <Button type="button" variant="outline" onClick={cancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner className="size-4" />}
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>

      {dirty !== undefined && <FormLeaveGuard dirty={dirty} letThrough={() => leaving.current || submitting.current} />}
      <DiscardChangesDialog
        open={askingCancel}
        onKeepEditing={() => setAskingCancel(false)}
        onDiscard={() => {
          setAskingCancel(false)
          leaving.current = true
          onCancel()
        }}
      />
    </form>
  )
}
