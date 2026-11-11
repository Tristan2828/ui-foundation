import type { Meta, StoryObj } from '@/fixtures/types'
import { useState, type FormEvent } from 'react'
import type { AppError } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormDialog } from './form-dialog'

// FormDialog opened from a page (`open`/`onOpenChange`): a new book of a
// few fields. Opened over a list by its route is RecordDialog's "New
// record" stories. Default starts open; Long has enough fields to scroll
// between the pinned title and buttons; Failed save starts with the
// server's refusal and Try again. A title of "fail" is refused, so the
// specs can watch a failure and a retry; the title is required.
// e2e/form-dialog.spec.ts drives it; axe in both themes is
// fixtures-visual.spec.ts's COMPOSITE_STORIES.

const REFUSED: AppError = { kind: 'server', message: "Couldn't add the book: the server didn't answer." }

const EXTRA = ['Series', 'Number', 'Pages', 'Published', 'Started on', 'Finished on', 'Recommended by', 'Link']

function NewBook({ startOpen = true, long = false, failed = false }: { startOpen?: boolean; long?: boolean; failed?: boolean }) {
  const [open, setOpen] = useState(startOpen)
  const [title, setTitle] = useState(failed ? 'fail' : '')
  const [author, setAuthor] = useState('')
  const [notes, setNotes] = useState('')
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState<AppError | null>(failed ? REFUSED : null)
  const [saving, setSaving] = useState(false)
  const [added, setAdded] = useState<string | null>(null)
  const reset = () => {
    setTitle('')
    setAuthor('')
    setNotes('')
    setMissing(false)
    setError(null)
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim()) {
      setMissing(true)
      return
    }
    setSaving(true)
    setError(null)
    setTimeout(() => {
      setSaving(false)
      if (title.trim() === 'fail') {
        setError(REFUSED)
        return
      }
      setAdded(title.trim())
      setOpen(false)
      reset()
    }, 300)
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="type-body" data-testid="book-result">
        {added ? `Added ${added}` : 'No book added yet'}
      </p>
      <Button variant="outline" onClick={() => setOpen(true)}>
        New book
      </Button>
      <FormDialog
        title="New book"
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) reset()
        }}
        onSubmit={submit}
        isSubmitting={saving}
        submitLabel="Add book"
        submitError={error}
        dirty={title !== '' || author !== '' || notes !== ''}
      >
        <Field data-invalid={missing || undefined}>
          <FieldLabel htmlFor="book-title">Title</FieldLabel>
          <Input
            id="book-title"
            value={title}
            aria-invalid={missing || undefined}
            onChange={(event) => {
              setTitle(event.target.value)
              setMissing(false)
            }}
          />
          {missing && <FieldError>Give it a title</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="book-author">Author</FieldLabel>
          <Input id="book-author" value={author} onChange={(event) => setAuthor(event.target.value)} />
        </Field>
        {long &&
          EXTRA.map((label) => (
            <Field key={label}>
              <FieldLabel htmlFor={`book-${label}`}>{label}</FieldLabel>
              <Input id={`book-${label}`} />
            </Field>
          ))}
        <Field>
          <FieldLabel htmlFor="book-notes">Notes</FieldLabel>
          <Textarea id="book-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </FormDialog>
    </div>
  )
}

const meta: Meta<typeof NewBook> = {
  title: 'App/FormDialog',
  component: NewBook,
}
export default meta

type Story = StoryObj<typeof NewBook>

export const Default: Story = { render: () => <NewBook /> }

export const Closed: Story = { render: () => <NewBook startOpen={false} /> }

export const Long: Story = { render: () => <NewBook long /> }

export const FailedSave: Story = { name: 'Failed save', render: () => <NewBook failed /> }
