import type { Meta, StoryObj } from '@/fixtures/types'
import { useRef, useState, type ReactElement } from 'react'
import { Controller, type FieldValues, type UseFormReturn } from 'react-hook-form'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { PaperclipIcon } from 'lucide-react'
import { z } from 'zod'
import type { AppError } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldError } from '@/components/ui/field'
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

// A list grouped by one of its items' fields (rooms), and one filtered
// (hide what's done): each group has its own rows, moves and Add, and the
// list still saves as one, in its own order. Duplicate copies an item
// right after it. e2e/editable-list.spec.ts moves, adds and duplicates.

type RoomTask = { text: string; room: string; done: boolean }

function useSaved<T>(initial: T[], refuse?: (list: T[]) => AppError | null) {
  const [items, setItems] = useState(initial)
  const latest = useRef(initial)
  const save = (change: (current: T[]) => T[]) =>
    new Promise<void>((resolve, reject) =>
      setTimeout(() => {
        const next = change(latest.current)
        const refused = refuse?.(next)
        if (refused) return reject(refused)
        latest.current = next
        setItems(next)
        resolve()
      }, 100),
    )
  return { items, save }
}

type RoomTaskRowProps = {
  value: RoomTask
  onChange: (task: RoomTask) => void
  disabled: boolean
  invalid: boolean
  describedBy: string
  index: number
}

function roomTaskRow(name: string) {
  return ({ value, onChange, disabled, invalid, describedBy, index }: RoomTaskRowProps) => (
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
  )
}

function GroupedRecord() {
  const tasks = useSaved<RoomTask>([
    { text: 'Paint the skirting', room: 'Kitchen', done: false },
    { text: 'Sweep out', room: 'Garage', done: true },
    { text: 'Fix the tap', room: 'Kitchen', done: false },
    { text: 'Hang the shelves', room: 'Garage', done: false },
    { text: 'Clear the worktop', room: 'Kitchen', done: true },
  ])
  const [hideDone, setHideDone] = useState(false)
  const byRoom = editInPlace<RoomTask>({
    kind: 'list',
    value: tasks.items,
    save: tasks.save,
    groupBy: { key: (task) => task.room, order: ['Kitchen', 'Garage', 'Hallway'] },
    duplicate: (task) => ({ ...task, done: false }),
    newItem: (room) => ({ text: '', room: room ?? 'Kitchen', done: false }),
    itemName: (index) => `task ${index + 1}`,
    addLabel: 'Add task',
    renderShown: (task) => <span className={task.done ? 'text-muted-foreground line-through' : undefined}>{task.text}</span>,
    renderItem: roomTaskRow('Task'),
  })
  const every = editInPlace<RoomTask>({
    kind: 'list',
    value: tasks.items,
    save: tasks.save,
    filter: hideDone ? (task) => !task.done : undefined,
    newItem: () => ({ text: '', room: 'Hallway', done: false }),
    itemName: (index) => `entry ${index + 1}`,
    addLabel: 'Add entry',
    renderShown: (task) => (
      <span className={task.done ? 'text-muted-foreground line-through' : undefined}>
        {task.text} <span className="type-caption text-muted-foreground">({task.room})</span>
      </span>
    ),
    renderItem: roomTaskRow('Entry'),
  })
  const sections: EntityViewSection[] = [
    { title: 'By room', content: null, emptyLabel: 'No tasks', edit: byRoom },
    {
      title: 'Every task',
      content: (
        <div>
          <Button type="button" variant="outline" size="sm" aria-pressed={hideDone} onClick={() => setHideDone((now) => !now)}>
            Hide done
          </Button>
        </div>
      ),
      emptyLabel: 'Nothing left to do',
      edit: every,
    },
  ]
  return <EntityView isLoading={false} back={{ to: '/', label: 'Projects' }} title="Spring clean" sections={sections} />
}

// A list item that is the form's own react-hook-form row (`itemForm`):
// it registers its text and its minutes as the form's ListEditor row
// does, and shows its errors from `form.formState.errors`. The list's
// schema refuses an empty text, and the "server" refuses a text with
// "!" in it as a 422 at `steps.<n>.text`: both show on the text box,
// not under the row. e2e/editable-list.spec.ts checks both.

type Step = { text: string; minutes: number }

const STEPS_SCHEMA = z.array(z.object({ text: z.string().trim().min(1, 'A step needs its words'), minutes: z.number().min(1) }))

// The form's row, written for react-hook-form, shared with the form.
function StepFields({ form, index, disabled }: { form: UseFormReturn<FieldValues>; index: number; disabled?: boolean }) {
  const steps = form.formState.errors.steps as { text?: { message?: string } }[] | undefined
  const error = steps?.[index]?.text
  return (
    <>
      <Field data-invalid={Boolean(error)} className="min-w-0 flex-1">
        <Input
          aria-label={`Step ${index + 1} text`}
          aria-invalid={Boolean(error) || undefined}
          readOnly={disabled}
          {...form.register(`steps.${index}.text`)}
        />
        <FieldError errors={[error]} />
      </Field>
      <Controller
        control={form.control}
        name={`steps.${index}.minutes`}
        render={({ field }) => (
          <Input
            className="w-20"
            inputMode="numeric"
            aria-label={`Step ${index + 1} minutes`}
            readOnly={disabled}
            value={String(field.value ?? '')}
            onChange={(event) => field.onChange(Number(event.target.value) || 0)}
          />
        )}
      />
    </>
  )
}

function FormRowsRecord() {
  const steps = useSaved<Step>(
    [
      { text: 'Strip the old felt', minutes: 30 },
      { text: 'Lay the new felt', minutes: 45 },
    ],
    (list) => {
      const at = list.findIndex((step) => step.text.includes('!'))
      if (at === -1) return null
      return { kind: 'validation', message: 'Validation failed', fieldErrors: { [`steps.${at}.text`]: ['No exclamation marks in a step'] } }
    },
  )
  const list = editInPlace<Step>({
    kind: 'list',
    name: 'steps',
    itemForm: true,
    value: steps.items,
    schema: STEPS_SCHEMA,
    save: steps.save,
    newItem: () => ({ text: '', minutes: 10 }),
    itemName: (index) => `step ${index + 1}`,
    addLabel: 'Add step',
    renderShown: (step) => (
      <span>
        {step.text} <span className="type-caption text-muted-foreground">· {step.minutes} min</span>
      </span>
    ),
    renderItem: ({ form, index, disabled }) => <StepFields form={form!} index={index} disabled={disabled} />,
  })
  const sections: EntityViewSection[] = [{ title: 'Steps', content: null, emptyLabel: 'No steps', edit: list }]
  return <EntityView isLoading={false} back={{ to: '/', label: 'Projects' }} title="Shed roof" sections={sections} />
}

function InRouter({ Record }: { Record: () => ReactElement }) {
  const [router] = useState(() => createMemoryRouter([{ path: '/', element: <Record /> }]))
  return <RouterProvider router={router} />
}

const meta: Meta = {
  title: 'app/EditableList',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
}

export default meta

export const ItemRows: StoryObj = { render: () => <RowsInRouter /> }

export const AddedByUpload: StoryObj = { render: () => <FilesInRouter /> }

export const GroupedAndFiltered: StoryObj = { render: () => <InRouter Record={GroupedRecord} /> }

export const FormRows: StoryObj = { render: () => <InRouter Record={FormRowsRecord} /> }
