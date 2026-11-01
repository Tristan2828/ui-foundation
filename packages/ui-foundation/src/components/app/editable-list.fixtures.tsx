import type { Meta, StoryObj } from '@/fixtures/types'
import { useRef, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { PaperclipIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { editInPlace } from './edit-in-place'
import { EntityView, type EntityViewSection } from './entity-view'

// A list item's row edited in place (#187): the same `renderItem` lays out
// as in the form's ListEditor row. Checklist's row is a fragment, a done
// box then a Field with the text box (the form's shape); Steps' row is an
// app's own flex row around the same two, which still fills the width.
// e2e/editable-list.spec.ts compares the box and the text box while
// editing and while adding.

type Task = { text: string; done: boolean }

// A list held in state, saved after a short wait like a server would.
function useSavedList(initial: Task[]) {
  const [items, setItems] = useState(initial)
  const latest = useRef(initial)
  const save = (change: (current: Task[]) => Task[]) =>
    new Promise<void>((resolve) =>
      setTimeout(() => {
        latest.current = change(latest.current)
        setItems(latest.current)
        resolve()
      }, 100),
    )
  return { items, save }
}

function taskList(list: ReturnType<typeof useSavedList>, name: string, wrapped: boolean) {
  return editInPlace<Task>({
    kind: 'list',
    value: list.items,
    save: list.save,
    newItem: () => ({ text: '', done: false }),
    itemName: (index) => `${name} ${index + 1}`,
    addLabel: `Add ${name}`,
    renderShown: (task) => <span className={task.done ? 'text-muted-foreground' : undefined}>{task.text}</span>,
    renderItem: ({ value, onChange, disabled, invalid, describedBy, index }) => {
      const parts = (
        <>
          <Checkbox
            className="mt-2.5"
            checked={value.done}
            disabled={disabled}
            aria-label={`${name} ${index + 1} done`}
            onCheckedChange={(done) => onChange({ ...value, done })}
          />
          <Field data-invalid={invalid} className="min-w-0 flex-1">
            <Input
              value={value.text}
              readOnly={disabled}
              aria-invalid={invalid || undefined}
              aria-label={`${name} ${index + 1} text`}
              aria-describedby={describedBy}
              onChange={(event) => onChange({ ...value, text: event.target.value })}
            />
          </Field>
        </>
      )
      // An app that wrapped its row before the list laid it out (#187).
      return wrapped ? <div className="flex items-start gap-2">{parts}</div> : parts
    },
  })
}

function RowsRecord() {
  const checklist = useSavedList([
    { text: 'Book the lift', done: true },
    { text: 'Label the boxes', done: false },
  ])
  const steps = useSavedList([{ text: 'Pack the kitchen', done: false }])
  const sections: EntityViewSection[] = [
    { title: 'Checklist', content: null, emptyLabel: 'No items', edit: taskList(checklist, 'Item', false) },
    { title: 'Steps', content: null, emptyLabel: 'No steps', edit: taskList(steps, 'Step', true) },
  ]
  return <EntityView isLoading={false} back={{ to: '/', label: 'Projects' }} title="Office move" sections={sections} />
}

function RowsInRouter() {
  const [router] = useState(() => createMemoryRouter([{ path: '/', element: <RowsRecord /> }]))
  return <RouterProvider router={router} />
}

// A list added by upload (#256): the list's own `add` is an "Add files"
// button that "uploads" (a short wait), then adds the file at the end
// through `save`; "Refuse an upload" reports why under the list. Each
// file reads as its name and caption, a missing caption the muted "No
// caption", which turns foreground on the hover and focus tint (#257), as
// the view's own "Not set" does. e2e/editable-list.spec.ts adds, moves,
// removes, and runs axe with the caret on a pencil in both themes.

type StoredFile = { name: string; caption: string }

const FILES_MAX = 3

// Files held in state, saved after a short wait; an "upload" is another
// short wait that names the next photo.
function useSavedFiles() {
  const [files, setFiles] = useState<StoredFile[]>([{ name: 'floor-plan.pdf', caption: '' }])
  const latest = useRef(files)
  const uploaded = useRef(0)
  const save = (change: (current: StoredFile[]) => StoredFile[]) =>
    new Promise<void>((resolve) =>
      setTimeout(() => {
        latest.current = change(latest.current)
        setFiles(latest.current)
        resolve()
      }, 100),
    )
  const upload = () =>
    new Promise<StoredFile>((resolve) =>
      setTimeout(() => resolve({ name: `photo-${(uploaded.current += 1)}.jpg`, caption: '' }), 100),
    )
  return { files, save, upload }
}

function FilesRecord() {
  const { files, save, upload } = useSavedFiles()
  const [uploading, setUploading] = useState(false)
  const fileList = editInPlace<StoredFile>({
    kind: 'list',
    value: files,
    save,
    itemName: (index) => files[index]?.name ?? `file ${index + 1}`,
    add: ({ add, items, disabled, onProblem }) => (
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading || items.length >= FILES_MAX}
          onClick={() => {
            onProblem(null)
            setUploading(true)
            void upload()
              .then((stored) => add([stored]))
              .finally(() => setUploading(false))
          }}
        >
          <PaperclipIcon />
          {uploading ? 'Uploading…' : 'Add files'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onProblem('That file is too large (at most 10 MB).')}>
          Refuse an upload
        </Button>
      </div>
    ),
    renderShown: (file) => (
      <span className="flex flex-col">
        {file.caption || <span className="text-muted-foreground">No caption</span>}
        <span className="type-caption text-muted-foreground">{file.name}</span>
      </span>
    ),
    renderItem: ({ value, onChange, disabled, invalid, describedBy, label }) => (
      <Input
        value={value.caption}
        readOnly={disabled}
        aria-invalid={invalid || undefined}
        aria-label={`Caption for ${label}`}
        aria-describedby={describedBy}
        placeholder="Caption (optional)"
        autoFocus
        onChange={(event) => onChange({ ...value, caption: event.target.value })}
      />
    ),
  })
  const [owner, setOwner] = useState('')
  const sections: EntityViewSection[] = [
    {
      title: 'Details',
      fields: [
        {
          label: 'Owner',
          value: owner || null,
          edit: editInPlace<string>({
            kind: 'text',
            value: owner,
            save: async (next) => setOwner(next.trim()),
            control: (props) => (
              <Input id={props.id} value={props.value} aria-label={props.label} autoFocus onChange={(event) => props.onChange(event.target.value)} />
            ),
          }),
        },
      ],
    },
    { title: 'Files', content: null, emptyLabel: 'No files yet', edit: fileList },
  ]
  return <EntityView isLoading={false} back={{ to: '/', label: 'Projects' }} title="Office move" sections={sections} />
}

function FilesInRouter() {
  const [router] = useState(() => createMemoryRouter([{ path: '/', element: <FilesRecord /> }]))
  return <RouterProvider router={router} />
}

const meta: Meta = {
  title: 'app/EditableList',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
}

export default meta

export const ItemRows: StoryObj = { render: () => <RowsInRouter /> }

export const AddedByUpload: StoryObj = { render: () => <FilesInRouter /> }
