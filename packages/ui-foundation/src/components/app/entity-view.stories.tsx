import type { Meta, StoryObj } from '@storybook/react-vite'
import { useRef, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import type { AppError } from '@/api/contracts'
import { editInPlace } from './edit-in-place'
import { EntityView, type EntityViewLayout, type EntityViewSection } from './entity-view'
import { Markdown } from './markdown'

// One record in both layouts: `column` (the default) and `rail`, the
// short sections in a column on the right of long Markdown. Axe and the
// token check measure both in both themes, and e2e/entity-view.spec.ts
// pins the rail's geometry, order and stickiness. Editing in place needs a
// data router (its leave prompt is React Router's useBlocker), so each
// story renders in a memory one; Owner saves after a short wait. Lists
// edits two sub-item lists in place (a checklist in the main column, links
// in the rail), each change saved after a short wait.

// Long enough to scroll past a rail, with a table wider than the column
// layout's 896px (it scrolls sideways there) but not than the rail
// layout's main column on a wide screen.
const NOTES = `# Background

The office moves to the third floor in March. Every desk, chair and
cabinet is tagged by the week it moves, and each team packs its own
boxes the Friday before.

${Array.from(
  { length: 8 },
  (_, week) =>
    `## Week ${week + 1}\n\nPack the shared shelves first, then personal desks. Label each box with the room it goes to and the team's colour, and leave the fragile ones open until the movers check them.`,
).join('\n\n')}

# Schedule

| Week | Team | Room | Ticket | Desks | Chairs | Cabinets | Monitors | Plants | Boxes | Lift slot | Contact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Finance | 3.01 | MOVE-2026-0001-FINANCE | 12 | 12 | 4 | 24 | 3 | 40 | 08:00–10:00 | finance-move-lead@example.com |
| 2 | Design | 3.04 | MOVE-2026-0002-DESIGN | 8 | 10 | 2 | 16 | 6 | 35 | 10:00–12:00 | design-move-lead@example.com |
| 3 | Support | 3.07 | MOVE-2026-0003-SUPPORT | 20 | 20 | 1 | 40 | 2 | 50 | 13:00–15:00 | support-move-lead@example.com |

Measure twice, cut once.
`

function useOwner() {
  const [owner, setOwner] = useState('Ada Lovelace')
  const owners = editInPlace<string>({
    kind: 'text',
    value: owner,
    save: (next) => new Promise((resolve) => setTimeout(() => resolve(setOwner(next)), 300)),
    control: (props) => (
      <Input
        id={props.id}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        readOnly={props.disabled}
        aria-invalid={props.invalid || undefined}
        aria-label={props.label}
        aria-describedby={props.describedBy}
      />
    ),
  })
  return { owner, owners }
}

function Record({ layout }: { layout: EntityViewLayout }) {
  const { owner, owners } = useOwner()
  const sections: EntityViewSection[] = [
    {
      title: 'Summary',
      placement: 'rail',
      fields: [
        { label: 'Owner', value: owner, edit: owners },
        { label: 'Floor', value: 'Third' },
        { label: 'Starts', value: 'Mar 2, 2026' },
        { label: 'Contact', value: 'facilities-desk@example.com' },
        { label: 'Budget', value: null, emptyLabel: 'No budget yet' },
      ],
    },
    {
      title: 'Links',
      placement: 'rail',
      content: (
        <ul className="flex flex-col gap-1">
          <li>
            <a className="text-link underline underline-offset-4" href="#floor-plan">
              Floor plan
            </a>
          </li>
          <li>
            <a className="text-link underline underline-offset-4" href="#movers">
              Movers' quote
            </a>
          </li>
        </ul>
      ),
    },
    { title: 'Notes', content: <Markdown>{NOTES}</Markdown> },
    { title: 'Follow-ups', content: null, emptyLabel: 'No follow-ups' },
  ]
  return (
    <EntityView
      layout={layout}
      isLoading={false}
      back={{ to: '/', label: 'Projects' }}
      title="Office move"
      badges={<Badge variant="outline">In progress</Badge>}
      actions={<Button variant="outline">Edit</Button>}
      sections={sections}
    />
  )
}

function InRouter({ layout }: { layout: EntityViewLayout }) {
  const [router] = useState(() => createMemoryRouter([{ path: '/', element: <Record layout={layout} /> }]))
  return <RouterProvider router={router} />
}

const meta: Meta = {
  title: 'app/EntityView',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
}

export default meta

export const Column: StoryObj = { render: () => <InRouter layout="column" /> }

export const Rail: StoryObj = { render: () => <InRouter layout="rail" /> }

function LoadingRail() {
  const [router] = useState(() =>
    createMemoryRouter([
      {
        path: '/',
        element: <EntityView layout="rail" isLoading back={{ to: '/', label: 'Projects' }} sections={[]} />,
      },
    ]),
  )
  return <RouterProvider router={router} />
}

export const RailLoading: StoryObj = { render: () => <LoadingRail /> }

// --- Lists edited in place ------------------------------------------------

type Task = { text: string; done: boolean }
type Link = { label: string; url: string }

// A list held in state, saved after a short wait like a server would. The
// change is applied to the latest list when the "request" is sent, as
// useRecordUpdate does. An item whose text is "refuse" is refused the way
// a 422 is, with the field error on that item.
function useSavedList<TItem>(initial: TItem[], refused: (item: TItem) => boolean) {
  const [items, setItems] = useState(initial)
  const latest = useRef(initial)
  const save = (change: (current: TItem[]) => TItem[]) =>
    new Promise<void>((resolve, reject) =>
      setTimeout(() => {
        const next = change(latest.current)
        const at = next.findIndex(refused)
        if (at !== -1) {
          const error: AppError = {
            kind: 'validation',
            message: 'Check the highlighted fields.',
            fieldErrors: { [`items.${at}`]: ['That one is refused, as a server would.'] },
          }
          reject(error)
          return
        }
        latest.current = next
        setItems(next)
        resolve()
      }, 300),
    )
  return { items, setItems: (next: TItem[]) => setItems((latest.current = next)), save }
}

const TASK_SCHEMA = {
  safeParse: (value: unknown) => {
    const tasks = value as Task[]
    const blank = tasks.findIndex((task) => task.text.trim() === '')
    if (blank !== -1) return { success: false as const, error: { issues: [{ message: 'Write something or remove the item', path: [blank, 'text'] }] } }
    if (tasks.length > 10) return { success: false as const, error: { issues: [{ message: 'A checklist can have at most 10 items', path: [] }] } }
    return { success: true as const, data: tasks.map((task) => ({ ...task, text: task.text.trim() })) }
  },
}

function ListsRecord() {
  const tasks = useSavedList<Task>(
    [
      { text: 'Book the lift', done: true },
      { text: 'Label the boxes', done: false },
      { text: 'Return the keys', done: false },
    ],
    (task) => task.text === 'refuse',
  )
  const links = useSavedList<Link>([{ label: 'Floor plan', url: 'https://example.com/plan' }], (link) => link.label === 'refuse')

  const checklist = editInPlace<Task>({
    kind: 'list',
    value: tasks.items,
    schema: TASK_SCHEMA,
    save: tasks.save,
    newItem: () => ({ text: '', done: false }),
    itemName: (index) => `item ${index + 1}`,
    addLabel: 'Add item',
    // A quick action: the box ticks and saves on its own; the text edits.
    renderShown: (task, index) => (
      <span className="flex items-start gap-2">
        <Checkbox
          className="mt-0.5"
          checked={task.done}
          aria-label={`Done: ${task.text}`}
          onCheckedChange={(done) => tasks.setItems(tasks.items.map((other, i) => (i === index ? { ...other, done } : other)))}
        />
        <span className={task.done ? 'text-muted-foreground' : undefined}>{task.text}</span>
      </span>
    ),
    // The form's row: the box and the text, over the draft.
    renderItem: ({ value, onChange, disabled, invalid, describedBy, index }) => (
      <span className="flex w-full items-start gap-2">
        <Checkbox
          className="mt-2.5"
          checked={value.done}
          disabled={disabled}
          aria-label={`Item ${index + 1} done`}
          onCheckedChange={(done) => onChange({ ...value, done })}
        />
        <Input
          value={value.text}
          readOnly={disabled}
          aria-invalid={invalid || undefined}
          aria-label={`Item ${index + 1} text`}
          aria-describedby={describedBy}
          onChange={(event) => onChange({ ...value, text: event.target.value })}
        />
      </span>
    ),
  })

  const linkList = editInPlace<Link>({
    kind: 'list',
    value: links.items,
    save: links.save,
    newItem: () => ({ label: '', url: '' }),
    itemName: (index) => `link ${index + 1}`,
    addLabel: 'Add link',
    renderShown: (link) => (
      <a className="text-link underline underline-offset-4" href={link.url}>
        {link.label}
      </a>
    ),
    renderItem: ({ value, onChange, disabled, invalid, describedBy, index }) => (
      <span className="flex w-full flex-col gap-1.5">
        <Input
          value={value.label}
          readOnly={disabled}
          aria-invalid={invalid || undefined}
          aria-label={`Link ${index + 1} label`}
          aria-describedby={describedBy}
          onChange={(event) => onChange({ ...value, label: event.target.value })}
        />
        <Input
          value={value.url}
          readOnly={disabled}
          aria-label={`Link ${index + 1} address`}
          onChange={(event) => onChange({ ...value, url: event.target.value })}
        />
      </span>
    ),
  })

  const done = tasks.items.filter((task) => task.done).length
  const sections: EntityViewSection[] = [
    { title: 'Links', placement: 'rail', content: null, emptyLabel: 'No links', edit: linkList },
    {
      title: 'Checklist',
      content: tasks.items.length > 0 && (
        <p className="type-caption tabular-nums text-muted-foreground">
          {done}/{tasks.items.length} done
        </p>
      ),
      emptyLabel: 'No items',
      edit: checklist,
    },
    { title: 'Notes', content: <Markdown>Measure twice, cut once.</Markdown> },
  ]
  return (
    <EntityView
      layout="rail"
      isLoading={false}
      back={{ to: '/', label: 'Projects' }}
      title="Office move"
      sections={sections}
    />
  )
}

function ListsInRouter() {
  const [router] = useState(() => createMemoryRouter([{ path: '/', element: <ListsRecord /> }]))
  return <RouterProvider router={router} />
}

export const Lists: StoryObj = { render: () => <ListsInRouter /> }
