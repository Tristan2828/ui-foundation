import type { Meta, StoryObj } from '@storybook/react-vite'
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { BookOpenIcon, BriefcaseIcon, HeartIcon, HouseIcon, PlaneIcon, Trash2Icon, WalletIcon, type LucideIcon } from 'lucide-react'
import { useMemo, useState, useSyncExternalStore } from 'react'
import { createMemoryRouter, Link, RouterProvider } from 'react-router'
import type { AppError } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable } from './data-table'
import { editInPlace } from './edit-in-place'
import { EditableValue } from './editable-value'
import { InlineCreate } from './inline-create'

// DataTable's two opt-ins for a small entity, in a real browser
// (e2e/data-table.spec.ts), with axe and the token check in both themes:
// - ContentWidth: `width="content"`, a few short columns sized to fit on a
//   wide screen, with a switch between the four states.
// - EditInTheRows: every cell an editable value, InlineCreate in the
//   toolbar, a delete in the pinned last column. Saves take ~0.4s; a name
//   another category has is refused the way a server's 422 is. "Elsewhere"
//   is a link that leaves the page, for the leave prompt.

const ICONS = { house: HouseIcon, wallet: WalletIcon, briefcase: BriefcaseIcon, heart: HeartIcon, plane: PlaneIcon, book: BookOpenIcon } satisfies Record<string, LucideIcon>
type IconKey = keyof typeof ICONS
const ICON_LABELS: Record<IconKey, string> = { house: 'House', wallet: 'Wallet', briefcase: 'Briefcase', heart: 'Heart', plane: 'Plane', book: 'Book' }

// Whole class names: Tailwind only generates the ones written out.
const COLOURS = {
  blue: { label: 'Blue', className: 'text-category-1' },
  orange: { label: 'Orange', className: 'text-category-2' },
  green: { label: 'Green', className: 'text-category-3' },
  purple: { label: 'Purple', className: 'text-category-4' },
  navy: { label: 'Navy', className: 'text-category-10' },
} as const
type ColourKey = keyof typeof COLOURS

type Category = { id: number; name: string; colour: ColourKey; icon: IconKey; widgets: number; notes?: string }

const SEED: Category[] = [
  { id: 1, name: 'Home', colour: 'blue', icon: 'house', widgets: 12, notes: 'Everything for the house, the garden shed and the garage loft' },
  { id: 2, name: 'Finance', colour: 'orange', icon: 'wallet', widgets: 4 },
  { id: 3, name: 'Work', colour: 'green', icon: 'briefcase', widgets: 27 },
  { id: 4, name: 'Health', colour: 'navy', icon: 'heart', widgets: 3 },
  { id: 5, name: 'Travel', colour: 'purple', icon: 'plane', widgets: 8 },
]

function Name({ category }: { category: Category }) {
  const Icon = ICONS[category.icon]
  return (
    <span className="inline-flex items-center gap-2 font-medium">
      <Icon aria-hidden="true" className={`size-4 shrink-0 ${COLOURS[category.colour].className}`} />
      {category.name}
    </span>
  )
}

function Colour({ colour }: { colour: ColourKey }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={`size-2.5 rounded-full bg-current ${COLOURS[colour].className}`} />
      {COLOURS[colour].label}
    </span>
  )
}

const noop = () => {}

// --- width="content" -------------------------------------------------------

const READ_COLUMNS: LegacyColumnDef<Category, unknown>[] = [
  { id: 'name', header: 'Name', cell: ({ row }) => <Name category={row.original} /> },
  { id: 'colour', header: 'Colour', cell: ({ row }) => <Colour colour={row.original.colour} /> },
  { id: 'widgets', header: 'Widgets', cell: ({ row }) => <span className="tabular-nums">{row.original.widgets}</span> },
  // Long enough that the loaded table is wider than the 36rem minimum.
  { id: 'notes', header: 'Notes', cell: ({ row }) => row.original.notes ?? <span className="text-muted-foreground">—</span> },
  {
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${row.original.name}`}>
        <Trash2Icon />
      </Button>
    ),
  },
]

type State = 'loaded' | 'loading' | 'empty' | 'error'
const LOAD_ERROR: AppError = { kind: 'server', message: 'The server had a problem. Try again in a moment.' }

function ContentWidthTable() {
  const [state, setState] = useState<State>('loaded')
  return (
    <div className="flex flex-col gap-4 p-6">
      <div role="group" aria-label="State" className="flex gap-1.5">
        {(['loaded', 'loading', 'empty', 'error'] as const).map((each) => (
          <Button key={each} size="sm" variant={each === state ? 'default' : 'outline'} aria-pressed={each === state} onClick={() => setState(each)}>
            {each}
          </Button>
        ))}
      </div>
      <h1 className="type-page-title text-foreground">Categories</h1>
      <DataTable<Category>
        width="content"
        columns={READ_COLUMNS}
        data={state === 'loaded' ? SEED : []}
        total={state === 'loaded' ? SEED.length : 0}
        page={1}
        pageSize={25}
        onPageChange={noop}
        sorting={[]}
        onSortingChange={noop}
        isLoading={state === 'loading'}
        error={state === 'error' ? LOAD_ERROR : null}
        onRetry={noop}
        emptyTitle="No categories yet"
        getRowId={(row) => String(row.id)}
        pinFirstColumn
        pinLastColumn
        toolbar={<Input className="w-64" placeholder="Search categories" aria-label="Search categories" />}
      />
    </div>
  )
}

// --- Editing in the rows -------------------------------------------------------

// A tiny in-memory server: each save answers after a wait, and a name
// another category has is a 422 on `name`.
class CategoryServer {
  items = SEED
  private nextId = 6
  private listeners = new Set<() => void>()
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }
  snapshot = () => this.items
  private set(items: Category[]) {
    this.items = items
    for (const listener of this.listeners) listener()
  }
  private refuseTaken(name: string | undefined, id?: number) {
    if (name === undefined) return
    if (this.items.some((other) => other.id !== id && other.name.toLowerCase() === name.toLowerCase())) {
      const error: AppError = { kind: 'validation', message: 'Check the highlighted fields.', fieldErrors: { name: ['A category with this name already exists'] } }
      throw error
    }
  }
  private later<T>(work: () => T) {
    return new Promise<T>((resolve, reject) =>
      setTimeout(() => {
        try {
          resolve(work())
        } catch (error) {
          reject(error)
        }
      }, 400),
    )
  }
  update = (id: number, change: Partial<Category>) =>
    this.later(() => {
      this.refuseTaken(change.name, id)
      this.set(this.items.map((item) => (item.id === id ? { ...item, ...change } : item)))
    })
  create = (name: string) =>
    this.later(() => {
      this.refuseTaken(name)
      this.set([...this.items, { id: this.nextId++, name, colour: 'blue', icon: 'house', widgets: 0 }])
    })
  remove = (id: number) => this.later(() => this.set(this.items.filter((item) => item.id !== id)))
}

// The form's rule for a name.
const NAME_RULE = {
  safeParse: (value: unknown) => {
    const name = String(value).trim()
    if (name === '') return { success: false as const, error: { issues: [{ message: 'Give the category a name' }] } }
    if (name.length > 40) return { success: false as const, error: { issues: [{ message: 'A name must be 40 characters or fewer' }] } }
    return { success: true as const, data: name }
  },
}

// A choice cell's control: its list opens with the field, a pick saves,
// closing it with no pick gives up, and it isn't modal.
function ChoiceSelect<T extends string>({
  options,
  props,
}: {
  options: Record<T, string>
  props: { id: string; value: T; disabled: boolean; label: string; describedBy: string; commit: (value?: T) => void; cancel: () => void }
}) {
  return (
    <Select
      value={props.value}
      onValueChange={(next) => next && props.commit(next as T)}
      disabled={props.disabled}
      defaultOpen
      modal={false}
      onOpenChange={(open) => {
        if (!open) props.cancel()
      }}
    >
      <SelectTrigger id={props.id} className="w-40" aria-label={props.label} aria-describedby={props.describedBy}>
        <SelectValue>{(value: T) => options[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(options) as T[]).map((key) => (
          <SelectItem key={key} value={key}>
            {options[key]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const COLOUR_LABELS = Object.fromEntries(Object.entries(COLOURS).map(([key, { label }]) => [key, label])) as Record<ColourKey, string>

// Made once per table: new column definitions on every render would
// remount the cells, and an open one with them.
function editColumns(server: CategoryServer): LegacyColumnDef<Category, unknown>[] {
  return [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <EditableValue
          label={`Name of ${row.original.name}`}
          layout="inline"
          edit={editInPlace<string>({
            kind: 'text',
            value: row.original.name,
            schema: NAME_RULE,
            save: (name) => server.update(row.original.id, { name }),
            control: (props) => (
              <Input
                id={props.id}
                className="w-48"
                value={props.value}
                readOnly={props.disabled}
                aria-invalid={props.invalid || undefined}
                aria-label={props.label}
                aria-describedby={props.describedBy}
                onChange={(event) => props.onChange(event.target.value)}
              />
            ),
          })}
        >
          <Name category={row.original} />
        </EditableValue>
      ),
    },
    {
      id: 'colour',
      header: 'Colour',
      cell: ({ row }) => (
        <EditableValue
          label={`Colour of ${row.original.name}`}
          layout="inline"
          edit={editInPlace<ColourKey>({
            kind: 'choice',
            value: row.original.colour,
            save: (colour) => server.update(row.original.id, { colour }),
            control: (props) => <ChoiceSelect options={COLOUR_LABELS} props={props} />,
          })}
        >
          <Colour colour={row.original.colour} />
        </EditableValue>
      ),
    },
    {
      id: 'icon',
      header: 'Icon',
      cell: ({ row }) => (
        <EditableValue
          label={`Icon of ${row.original.name}`}
          layout="inline"
          edit={editInPlace<IconKey>({
            kind: 'choice',
            value: row.original.icon,
            save: (icon) => server.update(row.original.id, { icon }),
            control: (props) => <ChoiceSelect options={ICON_LABELS} props={props} />,
          })}
        >
          {ICON_LABELS[row.original.icon]}
        </EditableValue>
      ),
    },
    { id: 'widgets', header: 'Widgets', cell: ({ row }) => <span className="tabular-nums">{row.original.widgets}</span> },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${row.original.name}`} onClick={() => server.remove(row.original.id)}>
          <Trash2Icon />
        </Button>
      ),
    },
  ]
}

function EditInRowsTable() {
  const [server] = useState(() => new CategoryServer())
  const data = useSyncExternalStore(server.subscribe, server.snapshot)
  const columns = useMemo(() => editColumns(server), [server])
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="type-page-title text-foreground">Categories</h1>
        <Link to="/elsewhere" className="type-label text-link underline underline-offset-4">
          Elsewhere
        </Link>
      </div>
      <DataTable<Category>
        width="content"
        columns={columns}
        data={data}
        total={data.length}
        page={1}
        pageSize={25}
        onPageChange={noop}
        sorting={[]}
        onSortingChange={noop}
        isLoading={false}
        emptyTitle="No categories yet"
        getRowId={(row) => String(row.id)}
        pinFirstColumn
        pinLastColumn
        toolbar={<InlineCreate label="New category's name" schema={NAME_RULE} create={server.create} />}
      />
    </div>
  )
}

function InRouter() {
  const [router] = useState(() =>
    createMemoryRouter([
      { path: '/', element: <EditInRowsTable /> },
      { path: '/elsewhere', element: <p className="p-6 type-body text-foreground">Somewhere else.</p> },
    ]),
  )
  return <RouterProvider router={router} />
}

const meta: Meta = {
  title: 'app/DataTable',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
}

export default meta

export const ContentWidth: StoryObj = { render: () => <ContentWidthTable /> }

export const EditInTheRows: StoryObj = { render: () => <InRouter /> }
