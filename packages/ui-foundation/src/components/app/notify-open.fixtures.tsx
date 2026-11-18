import type { Meta, StoryObj } from '@/fixtures/types'
import { useState, type FormEvent } from 'react'
import { createMemoryRouter, Link, Outlet, RouterProvider, useOutletContext, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Toaster } from '@/components/ui/sonner'
import { FormDialog } from './form-dialog'
import { notify } from './notify'

// notify.done's Open link on made-up books: a page of tiles whose
// New Book dialog saves and stays on the tiles, with "Added <name>" and
// Open to the new book's page. The Toaster sits under the router, as the
// shell's does. e2e/notify-open.spec.ts drives it at desktop and phone
// widths, axe in both themes with the toast on screen.

type Book = { id: number; title: string }

function TilePage({ books, onAdd }: { books: Book[]; onAdd: (title: string) => Book }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim()) return
    const book = onAdd(title.trim())
    setOpen(false)
    setTitle('')
    notify.done('Added', book.title, { open: `/books/${book.id}` })
  }
  return (
    <main className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="type-page-title">Books</h1>
        <Button onClick={() => setOpen(true)}>New Book</Button>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {books.map((book) => (
          <li key={book.id} className="rounded-lg border p-4 type-body">
            <Link to={`/books/${book.id}`}>{book.title}</Link>
          </li>
        ))}
      </ul>
      <FormDialog
        title="New Book"
        open={open}
        onOpenChange={setOpen}
        onSubmit={submit}
        submitLabel="Add Book"
        dirty={title !== ''}
      >
        <Field>
          <FieldLabel htmlFor="new-book-title">Title</FieldLabel>
          <Input id="new-book-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
      </FormDialog>
    </main>
  )
}

function BookPage({ books }: { books: Book[] }) {
  const { id } = useParams()
  const book = books.find((each) => String(each.id) === id)
  return (
    <main className="flex flex-col gap-2 p-6">
      <h1 className="type-page-title">{book?.title ?? 'Not found'}</h1>
      <Link to="/" className="type-body">
        Back to Books
      </Link>
    </main>
  )
}

// The books live in the layout route, beside the Toaster, so they
// survive the move to a book's page and back.
function Layout() {
  const [books, setBooks] = useState<Book[]>([
    { id: 1, title: 'The Long Walk' },
    { id: 2, title: 'Harbor Light' },
  ])
  const add = (title: string) => {
    const book = { id: books.length + 1, title }
    setBooks((current) => [...current, book])
    return book
  }
  return (
    <>
      <Outlet context={{ books, add } satisfies Shelf} />
      <Toaster />
    </>
  )
}

type Shelf = { books: Book[]; add: (title: string) => Book }

function TilesRoute() {
  const { books, add } = useOutletContext<Shelf>()
  return <TilePage books={books} onAdd={add} />
}

function BookRoute() {
  const { books } = useOutletContext<Shelf>()
  return <BookPage books={books} />
}

function Books() {
  const [router] = useState(() =>
    createMemoryRouter([
      {
        element: <Layout />,
        children: [
          { path: '/', element: <TilesRoute /> },
          { path: '/books/:id', element: <BookRoute /> },
        ],
      },
    ]),
  )
  return <RouterProvider router={router} />
}

const meta: Meta = {
  title: 'app/NotifyOpen',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
}

export default meta

export const Tiles: StoryObj = { render: () => <Books /> }
