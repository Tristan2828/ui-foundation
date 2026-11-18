import type { Meta, StoryObj } from '@/fixtures/types'
import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { createMemoryRouter, RouterProvider, useNavigate } from 'react-router'
import type { AppError } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useFormVersion } from '@/hooks/use-form-version'
import { EntityForm } from './entity-form'
import { FormDialog } from './form-dialog'

// A form's save that doesn't overwrite (useFormVersion): an edit form on
// a made-up book whose "server" checks the version the way the template's
// backend does. "Save Elsewhere" is another writer (a phone, a chat)
// saving the book behind the form's back; the form's save after it is
// refused (a 409, AppError kind `conflict`), and the bar asks: Keep Mine
// or Show Saved. "Saved: …" under the form is what the server holds.
//
// - Edit form: EntityForm, on the page.
// - Edit dialog: the same in a FormDialog.
//
// e2e/form-conflict.spec.ts drives these at a laptop's and a phone's width.

type Book = { id: number; title: string; notes: string; updatedAt: string }
type BookUpdate = { title?: string; notes?: string; baseUpdatedAt?: string }

const withVersion = (update: BookUpdate, book: Book): BookUpdate => ({ ...update, baseUpdatedAt: book.updatedAt })

function makeServer() {
  let book: Book = { id: 1, title: 'The Long Walk', notes: 'Started in the spring.', updatedAt: 'v0' }
  let clock = 0
  const later = <T,>(value: () => T) => new Promise<T>((resolve, reject) => setTimeout(() => {
    try {
      resolve(value())
    } catch (error) {
      reject(error)
    }
  }, 150))
  return {
    get: () => later(() => ({ ...book })),
    update: (body: BookUpdate) =>
      later(() => {
        if (body.baseUpdatedAt !== undefined && body.baseUpdatedAt !== book.updatedAt) {
          throw { kind: 'conflict', message: 'This book changed since you opened it.' } satisfies AppError
        }
        const fields = { ...body }
        delete fields.baseUpdatedAt
        book = { ...book, ...fields, updatedAt: `v${++clock}` }
        return { ...book }
      }),
    elsewhere: () => {
      book = { ...book, title: 'The Long Walk (2nd ed.)', notes: 'Edited on the phone.', updatedAt: `v${++clock}-elsewhere` }
    },
    peek: () => book,
  }
}

type Server = ReturnType<typeof makeServer>
type Values = { title: string; notes: string }

function EditBook({ server, inDialog }: { server: Server; inDialog: boolean }) {
  const navigate = useNavigate()
  const query = useQuery<Book, AppError>({ queryKey: ['books', 1], queryFn: server.get })
  const version = useFormVersion<Book, BookUpdate>({ record: query.data, withVersion, refetch: query.refetch })
  const [submitError, setSubmitError] = useState<AppError | null>(null)
  const [stored, setStored] = useState(() => server.peek())
  const [open, setOpen] = useState(true)
  const form = useForm<Values>({
    defaultValues: { title: '', notes: '' },
    values: version.record ? { title: version.record.title, notes: version.record.notes } : undefined,
  })
  const save = useMutation<Book, AppError, BookUpdate>({ mutationFn: server.update })

  const onSubmit = form.handleSubmit((values) => {
    setSubmitError(null)
    save.mutate(version.send(values), {
      onSuccess: (book) => {
        version.saved(book)
        setStored(book)
        form.reset({ title: book.title, notes: book.notes })
        if (!inDialog) navigate('/saved', { replace: true })
      },
      onError: (error) => {
        if (!version.refused(error)) setSubmitError(error)
      },
    })
  })

  const fields = (
    <>
      <Field>
        <FieldLabel htmlFor="book-title" required>
          Title
        </FieldLabel>
        <Input id="book-title" {...form.register('title')} />
      </Field>
      <Field>
        <FieldLabel htmlFor="book-notes">Notes</FieldLabel>
        <Textarea id="book-notes" {...form.register('notes')} />
      </Field>
    </>
  )
  const elsewhere = (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          server.elsewhere()
          setStored(server.peek())
        }}
      >
        Save Elsewhere
      </Button>
      <p className="type-body text-muted-foreground" data-testid="stored">
        Saved: {stored.title} / {stored.notes}
      </p>
    </div>
  )

  if (!version.record) return <p className="type-body text-muted-foreground">Loading…</p>

  if (inDialog) {
    return (
      <div className="flex flex-col gap-4">
        <FormDialog
          title="Edit Book"
          open={open}
          onOpenChange={setOpen}
          onSubmit={onSubmit}
          isSubmitting={save.isPending}
          submitLabel="Save Changes"
          submitError={submitError}
          conflict={version.conflict}
          dirty={form.formState.isDirty}
        >
          {/* Inside, so the other writer can be reached past the dialog's backdrop. */}
          {elsewhere}
          {fields}
        </FormDialog>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      {elsewhere}
      <EntityForm
        title="Edit Book"
        onSubmit={onSubmit}
        isSubmitting={save.isPending}
        submitError={submitError}
        conflict={version.conflict}
        submitLabel="Save Changes"
        onCancel={() => navigate('/saved', { replace: true })}
        dirty={form.formState.isDirty}
        errors={form.formState.errors}
      >
        {fields}
      </EntityForm>
    </div>
  )
}

function Saved({ server }: { server: Server }) {
  const book = server.peek()
  return (
    <p className="type-body text-foreground" data-testid="landed">
      Saved {book.title} / {book.notes}
    </p>
  )
}

function Story({ inDialog = false }: { inDialog?: boolean }) {
  const [server] = useState(makeServer)
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }))
  const [router] = useState(() =>
    createMemoryRouter(
      [
        { path: '/edit', element: <EditBook server={server} inDialog={inDialog} /> },
        { path: '/saved', element: <Saved server={server} /> },
      ],
      { initialEntries: ['/edit'] },
    ),
  )
  return (
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

const meta: Meta<typeof Story> = {
  title: 'App/Form Conflict',
  component: Story,
}
export default meta

type StoryT = StoryObj<typeof Story>

export const EditForm: StoryT = { render: () => <Story /> }

export const EditDialog: StoryT = { render: () => <Story inDialog /> }
