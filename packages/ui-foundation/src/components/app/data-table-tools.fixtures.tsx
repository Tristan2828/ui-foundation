import type { Meta, StoryObj } from '@/fixtures/types'
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { DropletIcon, MoveRightIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider, useParams } from 'react-router'
import type { AppError } from '@/api/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { DataTable, type DataTableGrouping } from './data-table'
import type { DataTableRowAction } from './data-table-tools'
import { FilterBar, FilterSelect } from './filter-bar'
import { ListHeader } from './list-header'
import { MultiChoice } from './multi-choice'
import { RelatedTable } from './related-table'

// DataTable's table tools from the list and record page standards, in a
// real browser (e2e/data-table-tools.spec.ts), with axe and the token
// check in both themes (e2e/fixtures-visual.spec.ts):
// - ListTools: saved views as pills (L3), FilterBar with search, two
//   filters that name themselves and the rest behind Filters (L4), a
//   Columns menu remembered under `fixtures:plants:columns` (L5), a ⋯ menu
//   per row (L9) and a row list under 48rem (L11). A switch between the
//   four states. Every row opens /plants/:id.
// - OneRowAction: a single action, drawn as its icon.
// - Related: a record's related lists (R8): 19 visits capped at 10 with
//   View all 19, and 3 with no link.
// - Framed: the same list as `look="framed"` (4.100) under a ListHeader
//   with a sibling-list switch (Houseplants / Cuttings / Seeds): views
//   above a card whose top bar holds the filters and one settings button
//   (the Columns ticks and Group By, by Status), its bottom bar the pager.
//   e2e/data-table-framed.spec.ts.
// The rows are made up.

type State = 'loaded' | 'loading' | 'empty' | 'error'
const LOAD_ERROR: AppError = { kind: 'server', message: 'The server had a problem. Try again in a moment.' }
const noop = () => {}

function StateSwitch({ state, onChange }: { state: State; onChange: (state: State) => void }) {
  return (
    <div role="group" aria-label="State" className="flex gap-1.5">
      {(['loaded', 'loading', 'empty', 'error'] as const).map((each) => (
        <Button key={each} size="sm" variant={each === state ? 'default' : 'outline'} aria-pressed={each === state} onClick={() => onChange(each)}>
          {each}
        </Button>
      ))}
    </div>
  )
}

// --- a list: houseplants -----------------------------------------------------

const STATUSES = ['thriving', 'watch', 'resting', 'gone'] as const
type Status = (typeof STATUSES)[number]
const STATUS_LABELS: Record<Status, string> = { thriving: 'Thriving', watch: 'Watch', resting: 'Resting', gone: 'Gone' }
const STATUS_BADGE: Record<Status, 'tinted-success' | 'tinted-warning' | 'tinted-info' | 'outline'> = {
  thriving: 'tinted-success',
  watch: 'tinted-warning',
  resting: 'tinted-info',
  gone: 'outline',
}
const ROOMS = ['Kitchen', 'Hall', 'Bedroom', 'Office', 'Porch'] as const
const LIGHTS = ['Bright', 'Medium', 'Low'] as const
const KINDS = ['Foliage', 'Flowering', 'Succulent', 'Herb'] as const

type Plant = {
  id: number
  name: string
  status: Status
  rooms: string[]
  light: (typeof LIGHTS)[number]
  kind: (typeof KINDS)[number]
  watered: string
  notes: string
}

const PLANTS: Plant[] = [
  { id: 1, name: 'Fiddle leaf fig', status: 'thriving', rooms: ['Hall'], light: 'Bright', kind: 'Foliage', watered: 'Nov 9', notes: 'Turn a quarter each week so it grows straight; it leans toward the window otherwise.' },
  { id: 2, name: 'Basil', status: 'watch', rooms: ['Kitchen'], light: 'Bright', kind: 'Herb', watered: 'Nov 10', notes: 'Pinch the tops before it flowers.' },
  { id: 3, name: 'Snake plant', status: 'resting', rooms: ['Bedroom', 'Office'], light: 'Low', kind: 'Succulent', watered: 'Oct 28', notes: 'Hardly needs anything in winter.' },
  { id: 4, name: 'Peace lily', status: 'thriving', rooms: ['Office'], light: 'Medium', kind: 'Flowering', watered: 'Nov 8', notes: 'Droops when thirsty, which makes it easy.' },
  { id: 5, name: 'A pothos with a very long name from the market', status: 'thriving', rooms: ['Kitchen', 'Hall', 'Porch'], light: 'Medium', kind: 'Foliage', watered: 'Nov 7', notes: 'Cuttings in the jar on the sill; pot them up once the roots are a few centimetres long.' },
  { id: 6, name: 'Rosemary', status: 'gone', rooms: ['Porch'], light: 'Bright', kind: 'Herb', watered: 'Sep 30', notes: 'Lost to the frost.' },
  { id: 7, name: 'Jade', status: 'watch', rooms: ['Office'], light: 'Bright', kind: 'Succulent', watered: 'Nov 1', notes: 'Leaves wrinkling a little.' },
]

const FILTERS = ['search', 'status', 'light', 'kind'] as const
const MULTI = ['rooms'] as const
const VIEWS = {
  growing: { label: 'Growing', filters: { status: 'thriving' } },
  watch: { label: 'Needs a look', filters: { status: 'watch' }, columns: ['name', 'status', 'watered', 'notes'] },
  all: { label: 'All' },
}

const plantColumns: LegacyColumnDef<Plant, unknown>[] = [
  { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <Badge variant={STATUS_BADGE[row.original.status]}>{STATUS_LABELS[row.original.status]}</Badge>,
  },
  { accessorKey: 'rooms', header: 'Rooms', enableSorting: false, cell: ({ row }) => row.original.rooms.join(', ') },
  { accessorKey: 'light', header: 'Light' },
  { accessorKey: 'kind', header: 'Kind' },
  { accessorKey: 'watered', header: 'Watered' },
  { accessorKey: 'notes', header: 'Notes', enableSorting: false, meta: { clip: true } },
]

const plantActions = (plant: Plant): DataTableRowAction[] => [
  { label: 'Water', icon: DropletIcon, onSelect: noop, disabled: plant.status === 'gone' },
  { label: 'Move', icon: MoveRightIcon, onSelect: noop },
  { label: 'Delete', icon: Trash2Icon, tone: 'destructive', onSelect: noop },
]

const STATUS_GROUPING: DataTableGrouping<Plant> = {
  id: 'status',
  label: 'Status',
  options: STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
  value: (plant) => plant.status,
}

function PlantsList({ single = false, framed = false }: { single?: boolean; framed?: boolean }) {
  const [state, setState] = useState<State>('loaded')
  const { page, setPage, sorting, setSorting, filters, multiFilters, setFilter, setFilters, setMultiFilter, activeView, applyView } =
    useTableUrlState(FILTERS, MULTI, VIEWS)
  const rows = PLANTS.filter(
    (plant) =>
      (!filters.search || plant.name.toLowerCase().includes(filters.search.toLowerCase())) &&
      (!filters.status || plant.status === filters.status) &&
      (!filters.light || plant.light === filters.light) &&
      (!filters.kind || plant.kind === filters.kind) &&
      multiFilters.rooms.every((room) => plant.rooms.includes(room)),
  )
  const shown = state === 'loaded' ? rows : []
  const filtered = Boolean(filters.search || filters.status || filters.light || filters.kind || multiFilters.rooms.length)
  return (
    <div className="flex flex-col gap-4 p-4">
      <StateSwitch state={state} onChange={setState} />
      {framed ? (
        <ListHeader
          title="Houseplants"
          count={PLANTS.length}
          siblings={[
            { label: 'Houseplants', to: '/', count: PLANTS.length },
            { label: 'Cuttings', to: '/cuttings', count: 6 },
            { label: 'Seeds', to: '/seeds', count: 3 },
          ]}
          deleted={{ shown: false, onShownChange: noop, noun: 'plants' }}
          newAction={{ label: 'New plant', onClick: noop }}
        />
      ) : (
        <h1 className="type-page-title">Houseplants</h1>
      )}
      <DataTable
        look={framed ? 'framed' : 'plain'}
        groupings={framed ? [STATUS_GROUPING] : undefined}
        columns={plantColumns}
        opens={{ kind: 'page', to: (plant) => `/plants/${plant.id}` }}
        views={VIEWS}
        activeView={activeView}
        onViewChange={applyView}
        columnsMenu={{ storageKey: 'fixtures:plants:columns' }}
        rowActions={single ? (plant) => [{ label: `Water ${plant.name}`, icon: DropletIcon, onSelect: noop }] : plantActions}
        phoneRow={{
          title: (plant) => plant.name,
          status: (plant) => <Badge variant={STATUS_BADGE[plant.status]}>{STATUS_LABELS[plant.status]}</Badge>,
          facts: (plant) => [`${plant.light} light`, `Watered ${plant.watered}`],
        }}
        toolbar={
          <FilterBar
            search={{ value: filters.search, onChange: (value) => setFilter('search', value), placeholder: 'Search by name' }}
            primary={
              <>
                <FilterSelect
                  label="Status"
                  options={STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] }))}
                  value={filters.status}
                  onValueChange={(value) => setFilter('status', value)}
                />
                <MultiChoice
                  label="Rooms"
                  options={ROOMS}
                  value={multiFilters.rooms}
                  onValueChange={(rooms) => setMultiFilter('rooms', rooms)}
                  placeholder="Any room"
                  aria-label="Filter by rooms"
                  className="w-52 max-md:w-full"
                />
              </>
            }
            primaryActive={[
              ...(filters.status
                ? [{ id: 'status', label: `Status: ${STATUS_LABELS[filters.status as Status]}`, onRemove: () => setFilter('status', '') }]
                : []),
              ...(multiFilters.rooms.length
                ? [{ id: 'rooms', label: `Rooms: ${multiFilters.rooms.join(', ')}`, onRemove: () => setMultiFilter('rooms', []) }]
                : []),
            ]}
            secondary={
              <>
                <FilterSelect
                  label="Light"
                  options={LIGHTS.map((light) => ({ value: light, label: light }))}
                  value={filters.light}
                  onValueChange={(value) => setFilter('light', value)}
                />
                <FilterSelect
                  label="Kind"
                  options={KINDS.map((kind) => ({ value: kind, label: kind }))}
                  value={filters.kind}
                  onValueChange={(value) => setFilter('kind', value)}
                />
              </>
            }
            active={[
              ...(filters.light ? [{ id: 'light', label: `Light: ${filters.light}`, onRemove: () => setFilter('light', '') }] : []),
              ...(filters.kind ? [{ id: 'kind', label: `Kind: ${filters.kind}`, onRemove: () => setFilter('kind', '') }] : []),
            ]}
            onClear={() => setFilters({ light: '', kind: '' })}
            onClearAll={() => setFilters({ status: '', light: '', kind: '', rooms: [] })}
          />
        }
        data={shown}
        total={shown.length}
        page={page}
        pageSize={50}
        onPageChange={setPage}
        sorting={sorting}
        onSortingChange={setSorting}
        isLoading={state === 'loading'}
        error={state === 'error' ? LOAD_ERROR : null}
        onRetry={noop}
        getRowId={(plant) => String(plant.id)}
        emptyTitle={filtered ? 'No plants match your filters' : 'No plants yet'}
        emptyDescription={filtered ? 'Try different filters.' : 'Add the first one to get started.'}
      />
    </div>
  )
}

function Opened() {
  const { id } = useParams()
  return <p className="p-4 type-body">Opened plant {id}</p>
}

function InRouter({ element, path }: { element: React.ReactNode; path: string }) {
  const [router] = useState(() =>
    createMemoryRouter(
      [
        { path: '/', element },
        { path: '/plants/:id', element: <Opened /> },
        { path: '/visits', element: <p className="p-4 type-body">All visits</p> },
        { path: '/cuttings', element: <p className="p-4 type-body">All cuttings</p> },
        { path: '/seeds', element: <p className="p-4 type-body">All seeds</p> },
      ],
      { initialEntries: [path] },
    ),
  )
  return <RouterProvider router={router} />
}

// --- a record's related lists ------------------------------------------------

type Visit = { id: number; date: string; kind: string; what: string; done: boolean }
const VISIT_WHAT = ['Repotting check', 'Pest look-over', 'Pruning', 'Feeding', 'Cuttings taken', 'Leaf clean', 'Soil test']
const VISITS: Visit[] = Array.from({ length: 19 }, (_, index) => ({
  id: index + 1,
  date: new Date(Date.UTC(2026, 10, 10 - index * 4)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
  kind: index % 3 === 0 ? 'Call' : 'Visit',
  what: VISIT_WHAT[index % VISIT_WHAT.length] as string,
  done: index > 0,
}))

const visitColumns: LegacyColumnDef<Visit, unknown>[] = [
  { accessorKey: 'date', header: 'Date' },
  { accessorKey: 'kind', header: 'Kind' },
  { accessorKey: 'what', header: 'What' },
  {
    accessorKey: 'done',
    header: 'Status',
    cell: ({ row }) => (row.original.done ? <Badge variant="tinted-success">Done</Badge> : <Badge variant="tinted-info">Booked</Badge>),
  },
]

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h2 className="flex items-baseline gap-2 type-section-title">
        {title}
        <span className="type-caption text-muted-foreground tabular-nums">{count}</span>
      </h2>
      {children}
    </section>
  )
}

function RelatedLists() {
  return (
    <div className="flex max-w-3xl flex-col gap-4 p-4">
      <Section title="Care log" count={VISITS.length}>
        <RelatedTable
          columns={visitColumns}
          opens={{ kind: 'page', to: (visit) => `/plants/${visit.id}` }}
          data={VISITS.slice(0, 10)}
          total={VISITS.length}
          isLoading={false}
          getRowId={(visit) => String(visit.id)}
          emptyTitle="No visits yet"
          viewAll={{ to: '/visits?plant=1' }}
          phoneRow={{
            title: (visit) => visit.what,
            status: (visit) => (visit.done ? <Badge variant="tinted-success">Done</Badge> : <Badge variant="tinted-info">Booked</Badge>),
            facts: (visit) => [visit.date, visit.kind],
          }}
        />
      </Section>
      <Section title="Cuttings" count={3}>
        <RelatedTable
          columns={visitColumns}
          opens={{ kind: 'page', to: (visit) => `/plants/${visit.id}` }}
          data={VISITS.slice(0, 3)}
          total={3}
          isLoading={false}
          getRowId={(visit) => String(visit.id)}
          emptyTitle="No cuttings yet"
          viewAll={{ to: '/visits?plant=1&kind=cutting' }}
        />
      </Section>
    </div>
  )
}

const meta: Meta = {
  title: 'app/DataTable tools',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
}

export default meta

export const ListTools: StoryObj = { render: () => <InRouter element={<PlantsList />} path="/" /> }

export const ListToolsFiltered: StoryObj = {
  render: () => <InRouter element={<PlantsList />} path="/?status=thriving&rooms=Hall&light=Medium" />,
}

export const OneRowAction: StoryObj = { render: () => <InRouter element={<PlantsList single />} path="/" /> }

export const Related: StoryObj = { render: () => <InRouter element={<RelatedLists />} path="/" /> }

export const Framed: StoryObj = { render: () => <InRouter element={<PlantsList framed />} path="/" /> }
