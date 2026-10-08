// Creates a record from its name, in a table's toolbar: the way in for a
// small entity edited in its rows (cell pattern 18, "In a table's rows").
// The rest of the new record's fields start at their defaults and are
// edited in its row like any other.
//
// - Enter or Add creates it. While it saves the box is read-only and Add
//   shows a spinner; then the box empties and keeps the caret, so a run of
//   records goes in from the keyboard, and a status line says what was added.
// - A name the form's schema refuses is never sent; a refusal from the
//   server (a 422's field error, word for word) shows under the box with
//   what was typed kept.
import { PlusIcon } from 'lucide-react'
import { useId, useRef, useState, type FormEvent } from 'react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Field, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { messageOf } from './edit-in-place-store'

type SafeParse = (
  value: unknown,
) => { success: true; data: unknown } | { success: false; error: { issues: readonly { message: string }[] } }

export type InlineCreateProps = {
  /** What the box is for, e.g. "New category's name": its accessible name and placeholder. */
  label: string
  /** The button's text. Defaults to "Add". */
  addLabel?: string
  /** The form's rule for the field (`<entity>FormSchema.shape.name`). Its output is what `create` gets. */
  schema?: { safeParse: SafeParse }
  /**
   * Creates the record from the name: the entity's create mutation's
   * `mutateAsync`, with the other fields at their defaults. Rejects with the
   * AppError; a 422's field error shows under the box.
   */
  create: (value: string) => Promise<unknown>
  className?: string
}

export function InlineCreate({ label, addLabel = 'Add', schema, create, className }: InlineCreateProps) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [added, setAdded] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    const parsed = schema ? schema.safeParse(value) : { success: true as const, data: value.trim() }
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check this value.')
      return
    }
    const name = String(parsed.data)
    setSaving(true)
    setError(null)
    try {
      await create(name)
      setValue('')
      setAdded(`Added ${name}`)
    } catch (refusal) {
      setError(messageOf(refusal))
    } finally {
      setSaving(false)
      input.current?.focus()
    }
  }

  return (
    <form onSubmit={submit} noValidate className={cn('flex items-start gap-2', className)} data-slot="inline-create">
      <Field data-invalid={error !== null} className="w-72 max-w-full">
        <Input
          ref={input}
          value={value}
          readOnly={saving}
          placeholder={label}
          aria-label={label}
          aria-invalid={error !== null}
          aria-describedby={error !== null ? `${id}-error` : undefined}
          onChange={(event) => setValue(event.target.value)}
        />
        {error !== null && (
          <FieldError id={`${id}-error`} className="type-caption">
            {error}
          </FieldError>
        )}
      </Field>
      <Button type="submit" variant="outline" disabled={saving}>
        {saving ? <Spinner aria-hidden="true" className="size-4" /> : <PlusIcon />}
        {addLabel}
      </Button>
      <span role="status" className="sr-only">
        {saving ? 'Adding…' : added}
      </span>
    </form>
  )
}
