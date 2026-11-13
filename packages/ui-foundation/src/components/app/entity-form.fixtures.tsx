import type { Meta, StoryObj } from '@/fixtures/types'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { createMemoryRouter, Link, RouterProvider, useNavigate, useSearchParams } from 'react-router'
import type { AppError } from '@/api/contracts'
import { Badge } from '@/components/ui/badge'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DateField } from './date-field'
import { EntityForm } from './entity-form'
import { FormSection } from './form-section'
import { OptionSelect, type OptionSelectOption } from './option-select'

// EntityForm in the form standard (4.85), on made-up books, in a data
// router so the leave guard works: `/books/new` is the form, `/books` the
// list Cancel and the "Books" link go to, `/books/added` where a save
// lands.
//
// - Default: a short form, one run of fields. Short ones share rows by
//   `size` (Status and Format; Series and Number; Started, Finished and
//   Rating; Pages and Published), the required ones marked, the status
//   drawn as its badge (OptionSelect `render`).
// - Sections: the same book with more fields, in cards (FormSection),
//   taller than the window, so the bar sticks to its bottom.
// - Failed save: the server's refusal as a Notice in the bar, above the buttons.
//
// A title of "fail" is refused by the "server"; the title is required.
// e2e/entity-form.spec.ts drives these; axe in both themes and every
// palette is fixtures-visual.spec.ts's COMPOSITE_STORIES.

type Status = 'to-read' | 'queue' | 'reading' | 'done' | 'gave-up'

const STATUSES: OptionSelectOption<Status>[] = [
  { value: 'to-read', label: 'To read' },
  { value: 'queue', label: 'Queue' },
  { value: 'reading', label: 'Reading' },
  { value: 'done', label: 'Done' },
  { value: 'gave-up', label: 'Gave up' },
]

const TONE = {
  'to-read': 'outline',
  queue: 'outline-info',
  reading: 'tinted-info',
  done: 'outline-success',
  'gave-up': 'outline-warning',
} as const

const FORMATS: OptionSelectOption<string>[] = [
  { value: 'print', label: 'Print' },
  { value: 'ebook', label: 'Ebook' },
  { value: 'audio', label: 'Audio' },
]

const REFUSED: AppError = { kind: 'server', message: "Couldn't add the book: the server didn't answer." }

type Book = {
  title: string
  author: string
  status: Status | null
  format: string | null
  series: string
  number: string
  started: string
  finished: string
  rating: string
  pages: string
  published: string
  recommendedBy: string
  link: string
  notes: string
}

const EMPTY: Book = {
  title: '',
  author: '',
  status: 'to-read',
  format: null,
  series: '',
  number: '',
  started: '',
  finished: '',
  rating: '',
  pages: '',
  published: '',
  recommendedBy: '',
  link: '',
  notes: '',
}

function NewBook({ sections = false, failed = false }: { sections?: boolean; failed?: boolean }) {
  const navigate = useNavigate()
  const form = useForm<Book>({ defaultValues: failed ? { ...EMPTY, title: 'fail' } : EMPTY })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<AppError | null>(failed ? REFUSED : null)
  const { errors, isDirty } = form.formState

  const onSubmit = form.handleSubmit((values) => {
    setError(null)
    setSaving(true)
    setTimeout(() => {
      if (values.title.trim() === 'fail') {
        setSaving(false)
        setError(REFUSED)
        return
      }
      // Still saving as it leaves, as a mutation's onSuccess is: the guard lets it through.
      navigate(`/books/added?title=${encodeURIComponent(values.title.trim())}`, { replace: true })
    }, 300)
  })

  const title = (
    <Field data-invalid={!!errors.title || undefined}>
      <FieldLabel htmlFor="book-title" required>
        Title
      </FieldLabel>
      <Input id="book-title" aria-invalid={!!errors.title || undefined} {...form.register('title', { required: 'Give it a title' })} />
      <FieldError errors={[errors.title]} />
    </Field>
  )
  const status = (
    <Field size="m">
      <FieldLabel htmlFor="book-status" required>
        Status
      </FieldLabel>
      <Controller
        control={form.control}
        name="status"
        render={({ field }) => (
          <OptionSelect
            id="book-status"
            required
            options={STATUSES}
            value={field.value}
            onValueChange={field.onChange}
            render={(value, label) => <Badge variant={TONE[value]}>{label}</Badge>}
          />
        )}
      />
    </Field>
  )
  const format = (
    <Field size="m">
      <FieldLabel htmlFor="book-format">Format</FieldLabel>
      <Controller
        control={form.control}
        name="format"
        render={({ field }) => (
          <OptionSelect id="book-format" options={FORMATS} value={field.value} onValueChange={field.onChange} />
        )}
      />
    </Field>
  )
  const author = (
    <Field>
      <FieldLabel htmlFor="book-author">Author</FieldLabel>
      <Input id="book-author" {...form.register('author')} />
    </Field>
  )
  const series = (
    <>
      <Field size="l">
        <FieldLabel htmlFor="book-series">Series</FieldLabel>
        <Input id="book-series" {...form.register('series')} />
      </Field>
      <Field size="s">
        <FieldLabel htmlFor="book-number">Number</FieldLabel>
        <Input id="book-number" inputMode="numeric" {...form.register('number')} />
      </Field>
    </>
  )
  const reading = (
    <>
      {(['started', 'finished'] as const).map((name) => (
        <Field key={name} size="m" kind="date">
          <FieldLabel htmlFor={`book-${name}`}>{name === 'started' ? 'Started on' : 'Finished on'}</FieldLabel>
          <Controller
            control={form.control}
            name={name}
            render={({ field }) => (
              <DateField id={`book-${name}`} value={field.value} onChange={field.onChange} clearable placeholder="" />
            )}
          />
        </Field>
      ))}
      <Field size="s">
        <FieldLabel htmlFor="book-rating">Rating</FieldLabel>
        <Input id="book-rating" inputMode="numeric" {...form.register('rating')} />
      </Field>
    </>
  )
  const numbers = (
    <>
      <Field size="s">
        <FieldLabel htmlFor="book-pages">Pages</FieldLabel>
        <Input id="book-pages" inputMode="numeric" {...form.register('pages')} />
      </Field>
      <Field size="s">
        <FieldLabel htmlFor="book-published">Published</FieldLabel>
        <Input id="book-published" inputMode="numeric" {...form.register('published')} />
      </Field>
    </>
  )
  const link = (
    <Field data-invalid={!!errors.link || undefined}>
      <FieldLabel htmlFor="book-link">Link</FieldLabel>
      <Input
        id="book-link"
        placeholder="https://"
        aria-invalid={!!errors.link || undefined}
        {...form.register('link', {
          validate: (value) => !value || /^https?:\/\/\S+\.\S+/.test(value) || 'Enter a full address, starting https://',
        })}
      />
      <FieldError errors={[errors.link]} />
    </Field>
  )
  const notes = (
    <Field>
      <FieldLabel htmlFor="book-notes">Notes</FieldLabel>
      <Textarea id="book-notes" {...form.register('notes')} />
    </Field>
  )

  return (
    <EntityForm
      title="New book"
      onSubmit={onSubmit}
      isSubmitting={saving}
      submitError={error}
      submitLabel="Add Book"
      onCancel={() => navigate('/books', { replace: true })}
      dirty={isDirty}
      errors={errors}
    >
      {sections ? (
        <>
          <FormSection title="What It Is">
            {title}
            {status}
            {format}
            {author}
          </FormSection>
          <FormSection title="Reading">{reading}</FormSection>
          <FormSection title="Details">
            {series}
            {numbers}
            <Field>
              <FieldLabel htmlFor="book-recommended">Recommended By</FieldLabel>
              <Input id="book-recommended" {...form.register('recommendedBy')} />
            </Field>
            {link}
          </FormSection>
          <FormSection title="Notes">{notes}</FormSection>
        </>
      ) : (
        <>
          {title}
          {status}
          {format}
          {author}
          {series}
          {reading}
          {numbers}
          {link}
          <Field>
            <FieldLabel htmlFor="book-recommended">Recommended By</FieldLabel>
            <Input id="book-recommended" {...form.register('recommendedBy')} />
            <FieldDescription>Who told you about it.</FieldDescription>
          </Field>
          {notes}
        </>
      )}
    </EntityForm>
  )
}

function Books() {
  return (
    <div className="flex flex-col items-start gap-2">
      <h1 className="type-page-title text-foreground">Books</h1>
      <Link to="/books/new" className="text-link underline">
        New Book
      </Link>
    </div>
  )
}

function Added() {
  const [params] = useSearchParams()
  return <p className="type-body text-foreground">Added {params.get('title')}</p>
}

function Page({ sections, failed }: { sections?: boolean; failed?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Books nav">
        <Link to="/books" className="type-label text-link underline">
          Books
        </Link>
      </nav>
      <NewBook sections={sections} failed={failed} />
    </div>
  )
}

function Story({ sections = false, failed = false }: { sections?: boolean; failed?: boolean }) {
  const [router] = useState(() =>
    createMemoryRouter(
      [
        { path: '/books', element: <Books /> },
        { path: '/books/new', element: <Page sections={sections} failed={failed} /> },
        { path: '/books/added', element: <Added /> },
      ],
      { initialEntries: ['/books', '/books/new'], initialIndex: 1 },
    ),
  )
  return <RouterProvider router={router} />
}

const meta: Meta<typeof Story> = {
  title: 'App/EntityForm',
  component: Story,
}
export default meta

type StoryT = StoryObj<typeof Story>

export const Default: StoryT = { render: () => <Story /> }

export const Sections: StoryT = { render: () => <Story sections /> }

export const FailedSave: StoryT = { name: 'Failed save', render: () => <Story failed /> }
