import type { Meta, StoryObj } from '@/fixtures/types'
import { useState, type ComponentType } from 'react'
import { createMemoryRouter, Link, matchPath, RouterProvider, useNavigate, useParams } from 'react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import type { AppError } from '@/api/contracts'
import { editInPlace } from './edit-in-place'
import { EditInPlaceScope, type LostEdit } from './edit-in-place-scope'
import { EditableValue } from './editable-value'
import { RichTextEditor } from './rich-text-editor'

// A page of the app's own that is nothing but its text: no EntityView, no
// DataTable, just <EditableValue>s inside an <EditInPlaceScope>. Each save
// takes 500ms, so "Saving…" shows; text with "refuse" in it is refused the
// way a 500 is. Saves counts the requests a server would get; "Change …
// Elsewhere" is another tab's save arriving (a refetch); "Close …" takes
// the value off the page, mid-typing or not. "All Notes" is a route to
// leave to: the scope's leave guard needs a data router. "Note tabs" is
// the two notes with the tab in front as the URL (/notes/shopping,
// /notes/packing): `staysOnPage` says a move between them isn't leaving,
// and `onLostEdit`'s calls are listed under the notes.

type NoteSeed = { id: string; title: string; body: string }

function useSavedNote(initial: NoteSeed) {
  const [saved, setSaved] = useState(initial.body)
  const [saves, setSaves] = useState(0)
  const edit = editInPlace<string>({
    kind: 'long-text',
    inline: true,
    value: saved,
    save: (text) =>
      new Promise<void>((resolve, reject) =>
        setTimeout(() => {
          setSaves((count) => count + 1)
          if (text.includes('refuse')) {
            const error: AppError = { kind: 'server', message: 'The server refused it, as a server would.' }
            reject(error)
            return
          }
          setSaved(text)
          resolve()
        }, 500),
      ),
    control: (props) => (
      <RichTextEditor
        id={props.id}
        defaultValue={props.value}
        onChange={props.onChange}
        onProblem={props.onProblem}
        readOnly={props.disabled}
        inline={props.inline}
        toolbar="floating"
        aria-invalid={props.invalid || undefined}
        aria-label={props.label}
        aria-describedby={props.describedBy}
      />
    ),
  })
  const changeElsewhere = () => setSaved((current) => `${current}\n\nAdded in another tab.`)
  return { saved, saves, edit, changeElsewhere }
}

// What the story shows about one note, for its spec: what's saved, the
// number of saves, and the buttons that act from outside the editor.
function NoteFacts({
  note,
  saved,
  saves,
  open,
  onChangeElsewhere,
  onClose,
}: {
  note: NoteSeed
  saved: string
  saves: number
  open: boolean
  onChangeElsewhere: () => void
  onClose: () => void
}) {
  return (
    <section aria-label={`${note.title} facts`} className="flex flex-col gap-2 rounded-md border border-border p-3 type-body-sm">
      <p>
        Saves: <span data-testid={`${note.id}-saves`}>{saves}</span>
      </p>
      <p className="whitespace-pre-wrap">
        Saved: <span data-testid={`${note.id}-saved`}>{saved}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onChangeElsewhere}>
          Change {note.title} Elsewhere
        </Button>
        <Button variant="outline" size="sm" onClick={onClose} disabled={!open}>
          Close {note.title}
        </Button>
      </div>
    </section>
  )
}

const SHOPPING: NoteSeed = { id: 'shopping', title: 'Shopping', body: 'Milk, eggs and bread.' }
const PACKING: NoteSeed = { id: 'packing', title: 'Packing', body: 'Pack the shared shelves first.' }

function OneNotePage() {
  const note = useSavedNote(SHOPPING)
  const [open, setOpen] = useState(true)
  return (
    <div className="flex max-w-3xl flex-col gap-6 p-6">
      <nav>
        <Link to="/notes" className="text-link underline">
          All Notes
        </Link>
      </nav>
      <EditInPlaceScope>
        {open ? <EditableValue label="Shopping" edit={note.edit} /> : <p className="text-muted-foreground">Closed.</p>}
      </EditInPlaceScope>
      <NoteFacts
        note={SHOPPING}
        saved={note.saved}
        saves={note.saves}
        open={open}
        onChangeElsewhere={note.changeElsewhere}
        onClose={() => setOpen(false)}
      />
      <Toaster />
    </div>
  )
}

// Two notes open in one scope, as a notes app's tabs: both editors stay
// mounted and only the one in front shows (the other is `hidden`), so each
// keeps its caret and undo. One scope around both means one leave guard.
function TwoNotesPage() {
  const shopping = useSavedNote(SHOPPING)
  const packing = useSavedNote(PACKING)
  const notes = [
    { note: SHOPPING, state: shopping },
    { note: PACKING, state: packing },
  ]
  const [front, setFront] = useState(SHOPPING.id)
  const [open, setOpen] = useState<string[]>([SHOPPING.id, PACKING.id])
  const shown = notes.filter(({ note }) => open.includes(note.id))
  return (
    <div className="flex max-w-3xl flex-col gap-6 p-6">
      <nav className="flex flex-wrap items-center gap-2">
        {shown.map(({ note }) => (
          <Button
            key={note.id}
            variant={front === note.id ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={front === note.id}
            onClick={() => setFront(note.id)}
          >
            {note.title}
          </Button>
        ))}
        <Link to="/notes" className="ml-auto text-link underline">
          All Notes
        </Link>
      </nav>
      <EditInPlaceScope>
        {shown.map(({ note, state }) => (
          <div key={note.id} data-testid={`${note.id}-pane`} hidden={front !== note.id}>
            <EditableValue label={note.title} edit={state.edit} />
          </div>
        ))}
      </EditInPlaceScope>
      <div className="grid gap-3 sm:grid-cols-2">
        {notes.map(({ note, state }) => (
          <NoteFacts
            key={note.id}
            note={note}
            saved={state.saved}
            saves={state.saves}
            open={open.includes(note.id)}
            onChangeElsewhere={state.changeElsewhere}
            onClose={() => {
              const rest = open.filter((id) => id !== note.id)
              setOpen(rest)
              if (front === note.id && rest[0]) setFront(rest[0])
            }}
          />
        ))}
      </div>
      <Toaster />
    </div>
  )
}

// A move between the open notes' URLs stays on the page: their panes are
// all mounted, only the one in front shown.
const staysOnNotes = (next: { pathname: string }) => matchPath('/notes/:id', next.pathname) !== null

function NoteTabsPage() {
  const { id: front } = useParams()
  const navigate = useNavigate()
  const shopping = useSavedNote(SHOPPING)
  const packing = useSavedNote(PACKING)
  const notes = [
    { note: SHOPPING, state: shopping },
    { note: PACKING, state: packing },
  ]
  const [open, setOpen] = useState<string[]>([SHOPPING.id, PACKING.id])
  const [lost, setLost] = useState<LostEdit[]>([])
  const shown = notes.filter(({ note }) => open.includes(note.id))
  return (
    <div className="flex max-w-3xl flex-col gap-6 p-6">
      <nav className="flex flex-wrap items-center gap-2">
        {shown.map(({ note }) => (
          <Link
            key={note.id}
            to={`/notes/${note.id}`}
            aria-current={front === note.id ? 'page' : undefined}
            className={buttonVariants({ variant: front === note.id ? 'secondary' : 'ghost', size: 'sm' })}
          >
            {note.title}
          </Link>
        ))}
        <Link to="/notes" className="ml-auto text-link underline">
          All Notes
        </Link>
      </nav>
      <EditInPlaceScope staysOnPage={staysOnNotes} onLostEdit={(edit) => setLost((all) => [...all, edit])}>
        {shown.map(({ note, state }) => (
          <div key={note.id} data-testid={`${note.id}-pane`} hidden={front !== note.id}>
            <EditableValue label={note.title} edit={state.edit} />
          </div>
        ))}
      </EditInPlaceScope>
      <div className="grid gap-3 sm:grid-cols-2">
        {notes.map(({ note, state }) => (
          <NoteFacts
            key={note.id}
            note={note}
            saved={state.saved}
            saves={state.saves}
            open={open.includes(note.id)}
            onChangeElsewhere={state.changeElsewhere}
            onClose={() => {
              const rest = open.filter((id) => id !== note.id)
              setOpen(rest)
              if (front === note.id) navigate(rest[0] ? `/notes/${rest[0]}` : '/notes')
            }}
          />
        ))}
      </div>
      <section aria-label="Lost edits" className="type-body-sm">
        <ul data-testid="lost-edits">
          {lost.map((edit, index) => (
            <li key={index}>
              {edit.label}: {String(edit.value)} ({edit.reason})
            </li>
          ))}
        </ul>
      </section>
      <Toaster />
    </div>
  )
}

function InRouter({ page }: { page: ComponentType }) {
  const [router] = useState(() =>
    createMemoryRouter([
      { path: '/', Component: page },
      { path: '/notes', element: <p className="p-6">All notes</p> },
    ]),
  )
  return <RouterProvider router={router} />
}

const meta: Meta = {
  title: 'app/EditInPlaceScope',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
}

export default meta

export const Note: StoryObj = { render: () => <InRouter page={OneNotePage} /> }

export const TwoNotes: StoryObj = { render: () => <InRouter page={TwoNotesPage} /> }

function NoteTabsRouter() {
  const [router] = useState(() =>
    createMemoryRouter(
      [
        { path: '/notes/:id', Component: NoteTabsPage },
        { path: '/notes', element: <p className="p-6">All notes</p> },
      ],
      { initialEntries: ['/notes/shopping'] },
    ),
  )
  return <RouterProvider router={router} />
}

export const NoteTabs: StoryObj = { render: () => <NoteTabsRouter /> }
