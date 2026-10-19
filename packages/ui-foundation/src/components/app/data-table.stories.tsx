import type { Meta, StoryObj } from '@storybook/react-vite'
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { BookOpenIcon, BriefcaseIcon, FileTextIcon, HeartIcon, HouseIcon, MusicIcon, PlaneIcon, Trash2Icon, VideoIcon, WalletIcon, type LucideIcon } from 'lucide-react'
import { useMemo, useState, useSyncExternalStore } from 'react'
import { createMemoryRouter, Link, RouterProvider } from 'react-router'
import type { AppError } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { byDay } from '@/lib/group-by-day'
import { DataTable } from './data-table'
import { editInPlace } from './edit-in-place'
import { EditableValue } from './editable-value'
import { InlineCreate } from './inline-create'
import { PillFilter } from './pill-filter'

// DataTable's two opt-ins for a small entity, in a real browser
// (e2e/data-table.spec.ts), with axe and the token check in both themes:
// - ContentWidth: `width="content"`, a few short columns sized to fit on a
//   wide screen, with a switch between the four states.
// - EditInTheRows: every cell an editable value, InlineCreate in the
//   toolbar, a delete in the pinned last column. Saves take ~0.4s; a name
//   another category has is refused the way a server's 422 is. "Elsewhere"
//   is a link that leaves the page, for the leave prompt.
// - Grouped: a feed under day headings (`groupBy: byDay`), no header row,
//   and a PillFilter in the toolbar, its value and the page in the URL.
//   Six rows a page, so This week's group carries on to page 2. Today is
//   pinned (15 Oct 2026, UTC) so the headings never drift.
//   GroupedNoMatches opens on a type with no items: the empty state with
//   a way to take the filter off.
// - Highlighted: `highlightRow`, two rows to look at (cell pattern 22).

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

// --- highlightRow ---------------------------------------------------------------

// Two rows marked to look at (one odd, one striped even), each also saying
// why in words, with muted text inside them and pinned first and last
// columns, so the wash, the darker muted grey and the bar are measured on
// both kinds of row and on the opaque pinned cells.
const NEXT_UP = new Set([2, 3])

const HIGHLIGHT_COLUMNS: LegacyColumnDef<Category, unknown>[] = [
  { id: 'name', header: 'Name', cell: ({ row }) => <Name category={row.original} /> },
  {
    id: 'state',
    header: 'State',
    cell: ({ row }) =>
      NEXT_UP.has(row.original.id) ? 'Next up' : <span className="text-muted-foreground">Waiting</span>,
  },
  {
    id: 'notes',
    header: 'Notes',
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.notes ?? 'No notes'}</span>,
  },
  READ_COLUMNS[4],
]

function HighlightedTable() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="type-page-title text-foreground">Categories</h1>
      <DataTable<Category>
        columns={HIGHLIGHT_COLUMNS}
        data={SEED}
        total={SEED.length}
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
        highlightRow={(row) => NEXT_UP.has(row.id)}
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

// --- grouped under headings, with a pill filter ------------------------------

type Kind = 'video' | 'audio' | 'text'
type FeedItem = { id: number; title: string; kind: Kind; publishedAt: string; minutes: number }

const KIND_LABELS: Record<Kind, string> = { video: 'Video', audio: 'Audio', text: 'Text' }
const KIND_ICONS: Record<Kind, LucideIcon> = { video: VideoIcon, audio: MusicIcon, text: FileTextIcon }

// Newest first, as a server would send them. No text items, so that pill
// shows the empty state.
const FEED: FeedItem[] = [
  { id: 1, title: 'Morning briefing', kind: 'audio', publishedAt: '2026-10-15T07:30:00Z', minutes: 18 },
  { id: 2, title: 'How the bridge was built', kind: 'video', publishedAt: '2026-10-15T06:10:00Z', minutes: 42 },
  { id: 3, title: 'Kitchen garden, week 40', kind: 'video', publishedAt: '2026-10-14T19:00:00Z', minutes: 12 },
  { id: 4, title: 'Evening news', kind: 'audio', publishedAt: '2026-10-14T18:00:00Z', minutes: 30 },
  { id: 5, title: 'Interview: the new library', kind: 'audio', publishedAt: '2026-10-13T12:00:00Z', minutes: 55 },
  { id: 6, title: 'Bread at home', kind: 'video', publishedAt: '2026-10-13T09:00:00Z', minutes: 9 },
  { id: 7, title: 'Rail timetable changes', kind: 'audio', publishedAt: '2026-10-12T16:00:00Z', minutes: 7 },
  { id: 8, title: 'Autumn walks', kind: 'video', publishedAt: '2026-10-09T10:00:00Z', minutes: 21 },
  { id: 9, title: 'Weekend debate', kind: 'audio', publishedAt: '2026-10-07T20:00:00Z', minutes: 64 },
  { id: 10, title: 'Repairing a bicycle wheel', kind: 'video', publishedAt: '2026-09-30T08:00:00Z', minutes: 16 },
  { id: 11, title: 'Harvest festival', kind: 'video', publishedAt: '2026-08-22T13:00:00Z', minutes: 33 },
]

const FEED_PAGE_SIZE = 6
const FEED_NOW = new Date('2026-10-15T10:00:00Z')
const byPublished = byDay<FeedItem>('publishedAt', { now: FEED_NOW, timeZone: 'UTC' })

function duration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} m`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} m`
}

// A list's two columns: what the item is (its type's icon, title and
// length) takes the width, and its action sits at the end.
const FEED_COLUMNS: LegacyColumnDef<FeedItem, unknown>[] = [
  {
    id: 'title',
    header: 'Item',
    cell: ({ row }) => {
      const Icon = KIND_ICONS[row.original.kind]
      return (
        <span className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon aria-hidden="true" className="size-4" />
          </span>
          <span className="flex flex-col whitespace-normal">
            <span className="font-medium text-foreground">{row.original.title}</span>
            <span className="type-caption text-muted-foreground">
              {KIND_LABELS[row.original.kind]} · {duration(row.original.minutes)}
            </span>
          </span>
        </span>
      )
    },
  },
  {
    id: 'actions',
    header: 'Actions',
    meta: { align: 'center' },
    cell: ({ row }) => (
      <Button variant="outline" size="sm" aria-label={`Open ${row.original.title}`}>
        Open
      </Button>
    ),
  },
]

function FeedTable() {
  const { page, filters, setFilter, setPage } = useTableUrlState(['kind'])
  const matching = filters.kind ? FEED.filter((item) => item.kind === filters.kind) : FEED
  const rows = matching.slice((page - 1) * FEED_PAGE_SIZE, page * FEED_PAGE_SIZE)
  const kindLabel = filters.kind ? KIND_LABELS[filters.kind as Kind]?.toLowerCase() : null
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="type-page-title text-foreground">Feed</h1>
      <DataTable<FeedItem>
        header={false}
        groupBy={byPublished}
        groupSummary={(items) => `${items.length} · ${duration(items.reduce((sum, item) => sum + item.minutes, 0))}`}
        columns={FEED_COLUMNS}
        data={rows}
        total={matching.length}
        page={page}
        pageSize={FEED_PAGE_SIZE}
        onPageChange={setPage}
        sorting={[]}
        onSortingChange={noop}
        isLoading={false}
        getRowId={(row) => String(row.id)}
        emptyTitle={kindLabel ? `No ${kindLabel} items` : 'Nothing in the feed yet'}
        emptyAction={
          filters.kind ? (
            <Button variant="outline" onClick={() => setFilter('kind', '')}>
              Show all types
            </Button>
          ) : undefined
        }
        toolbar={
          <PillFilter
            label="Type"
            options={(Object.keys(KIND_LABELS) as Kind[]).map((kind) => ({ value: kind, label: KIND_LABELS[kind] }))}
            value={filters.kind}
            onValueChange={(kind) => setFilter('kind', kind)}
          />
        }
      />
    </div>
  )
}

function FeedInRouter({ path }: { path: string }) {
  const [router] = useState(() => createMemoryRouter([{ path: '/', element: <FeedTable /> }], { initialEntries: [path] }))
  return <RouterProvider router={router} />
}

const meta: Meta = {
  title: 'app/DataTable',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
}

export default meta

export const ContentWidth: StoryObj = { render: () => <ContentWidthTable /> }

export const EditInTheRows: StoryObj = { render: () => <InRouter /> }

export const Grouped: StoryObj = { render: () => <FeedInRouter path="/" /> }

export const Highlighted: StoryObj = { render: () => <HighlightedTable /> }

export const GroupedNoMatches: StoryObj = { render: () => <FeedInRouter path="/?kind=text" /> }
