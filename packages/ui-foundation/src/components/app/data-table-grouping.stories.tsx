import type { Meta, StoryObj } from '@storybook/react-vite'
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { useState } from 'react'
import { CheckIcon, CircleDashedIcon, EyeIcon, PlayIcon } from 'lucide-react'
import { createMemoryRouter, Link, RouterProvider, useNavigate } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import type { TableView } from '@/hooks/table-url-changes'
import { DataTable, type DataTableGrouping } from './data-table'

// DataTable's Group menu (`groupings`) and detail panel (`detailPanel`),
// in a real browser (e2e/data-table-grouping.spec.ts), with axe and the
// token check in both themes (e2e/storybook-visual.spec.ts):
// - Chores: a list of chores, ungrouped until a grouping is picked:
//   Status (single choice), Area (multi-value: a chore in two areas shows
//   under both, one with none goes under "No area") and Ready (yes/no).
//   Each heading folds, with its count and a summary ("2 quick · 45 m").
//   The grouping is in the URL and remembered under
//   `storybook:chores:group`; the saved views All and By status (which
//   turns on the Status grouping) sit in the toolbar.
// - ChoresByArea: opens grouped by Area (`?group=areas`).
// - ChoresWithPanel: the same list with a detail panel: a click or Enter
//   on a row opens it beside the list (a bottom sheet on a phone), ↑/↓
//   move it, Escape or Close closes it. Each row's title is a link, which
//   picks the row here; the panel has the "Open page" link.
// - ChoresWithQuickLook: the same, with `onRowClick` and `detailRow`: a
//   click on a row opens its page, and the panel opens from a Quick look
//   button in the row instead. The Status headings lead with an icon (an
//   option's `icon`), here and in the stories above.

type Status = 'todo' | 'doing' | 'done'
type Area = 'kitchen' | 'garden' | 'garage' | 'hall'
type Chore = { id: number; title: string; status: Status; areas: Area[]; minutes: number; ready: boolean; notes: string }

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To do' },
  { value: 'doing', label: 'Doing' },
  { value: 'done', label: 'Done' },
] as const satisfies readonly { value: Status; label: string }[]
const AREA_OPTIONS = [
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'garden', label: 'Garden' },
  { value: 'garage', label: 'Garage' },
  { value: 'hall', label: 'Hall' },
] as const satisfies readonly { value: Area; label: string }[]
const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS.map((option) => [option.value, option.label])) as Record<Status, string>
const AREA_LABELS = Object.fromEntries(AREA_OPTIONS.map((option) => [option.value, option.label])) as Record<Area, string>

const STATUS_ICONS: Record<Status, React.ReactNode> = {
  todo: <CircleDashedIcon className="size-4 text-muted-foreground" />,
  doing: <PlayIcon className="size-4 text-info-text" />,
  done: <CheckIcon className="size-4 text-success-text" />,
}

const CHORES: Chore[] = [
  { id: 1, title: 'Descale the kettle', status: 'todo', areas: ['kitchen'], minutes: 10, ready: true, notes: 'Half water, half vinegar; boil twice.' },
  { id: 2, title: 'Rake the leaves', status: 'doing', areas: ['garden'], minutes: 40, ready: true, notes: 'Front lawn first, then the path.' },
  { id: 3, title: 'Sort the tool wall', status: 'todo', areas: ['garage'], minutes: 60, ready: false, notes: 'Waiting on the new hooks.' },
  { id: 4, title: 'Wash the bins', status: 'todo', areas: ['garage', 'garden'], minutes: 20, ready: true, notes: 'After collection day.' },
  { id: 5, title: 'Oil the hinges', status: 'done', areas: ['hall', 'kitchen'], minutes: 15, ready: true, notes: 'Back door still squeaks a little.' },
  { id: 6, title: 'Clear the gutters', status: 'todo', areas: ['garden'], minutes: 45, ready: false, notes: 'Needs the long ladder.' },
  { id: 7, title: 'Replace the door mat', status: 'doing', areas: ['hall'], minutes: 5, ready: true, notes: 'The coir one, not the rubber.' },
  { id: 8, title: 'Find the spare keys', status: 'todo', areas: [], minutes: 10, ready: true, notes: 'Last seen in a coat pocket.' },
]

const GROUPINGS: DataTableGrouping<Chore>[] = [
  {
    id: 'status',
    label: 'Status',
    options: STATUS_OPTIONS.map((option) => ({ ...option, icon: STATUS_ICONS[option.value] })),
    value: (chore) => chore.status,
  },
  { id: 'areas', label: 'Area', options: AREA_OPTIONS, value: (chore) => chore.areas, emptyLabel: 'No area' },
  {
    id: 'ready',
    label: 'Ready',
    options: [
      { value: 'yes', label: 'Ready now' },
      { value: 'no', label: 'Not yet' },
    ],
    value: (chore) => (chore.ready ? 'yes' : 'no'),
  },
]

type ViewId = 'all' | 'by-status'
const VIEWS: Record<ViewId, TableView<never, never>> = {
  all: {},
  'by-status': { group: 'status' },
}

function minutes(total: number) {
  return total >= 60 ? `${Math.floor(total / 60)} h ${total % 60 ? `${total % 60} m` : ''}`.trim() : `${total} m`
}

function ChoresTable({ withPanel, quickLook }: { withPanel?: boolean; quickLook?: boolean }) {
  const navigate = useNavigate()
  const [detailRow, setDetailRow] = useState<string | null>(null)
  const { grouping, setGrouping, applyView } = useTableUrlState([], [], VIEWS, { groupStorageKey: 'storybook:chores:group' })
  const columns: LegacyColumnDef<Chore, unknown>[] = [
    {
      id: 'title',
      header: 'Chore',
      cell: ({ row }) => (
        <Link to={`/chores/${row.original.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
          {row.original.title}
        </Link>
      ),
    },
    { id: 'status', header: 'Status', cell: ({ row }) => <Badge variant="outline">{STATUS_LABELS[row.original.status]}</Badge> },
    {
      id: 'areas',
      header: 'Area',
      cell: ({ row }) =>
        row.original.areas.length ? (
          row.original.areas.map((area) => AREA_LABELS[area]).join(', ')
        ) : (
          <span className="text-muted-foreground">No area</span>
        ),
    },
    ...(quickLook
      ? [
          {
            id: 'quick-look',
            header: 'Quick look',
            cell: ({ row }) => (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Quick look: ${row.original.title}`}
                onClick={() => setDetailRow(String(row.original.id))}
              >
                <EyeIcon aria-hidden="true" />
              </Button>
            ),
          } satisfies LegacyColumnDef<Chore, unknown>,
        ]
      : []),
    { id: 'ready', header: 'Ready', cell: ({ row }) => (row.original.ready ? 'Yes' : 'No') },
    { id: 'minutes', header: 'Time', meta: { align: 'right' }, cell: ({ row }) => <span className="tabular-nums">{minutes(row.original.minutes)}</span> },
  ]
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="type-page-title text-foreground">Chores</h1>
      <DataTable<Chore>
        columns={columns}
        data={CHORES}
        total={CHORES.length}
        page={1}
        pageSize={25}
        onPageChange={() => {}}
        sorting={[]}
        onSortingChange={() => {}}
        isLoading={false}
        emptyTitle="No chores yet"
        getRowId={(row) => String(row.id)}
        groupings={GROUPINGS}
        grouping={grouping}
        onGroupingChange={setGrouping}
        groupSummary={(rows) => `${rows.filter((row) => row.minutes <= 15).length} quick · ${minutes(rows.reduce((sum, row) => sum + row.minutes, 0))}`}
        toolbar={
          <div role="group" aria-label="Views" className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={() => applyView(VIEWS.all)}>
              All
            </Button>
            <Button size="sm" variant="outline" onClick={() => applyView(VIEWS['by-status'])}>
              By status
            </Button>
          </div>
        }
        detailLabel={withPanel || quickLook ? 'Chore' : undefined}
        {...(quickLook
          ? { onRowClick: (chore: Chore) => navigate(`/chores/${chore.id}`), detailRow, onDetailRowChange: setDetailRow }
          : {})}
        detailPanel={
          withPanel || quickLook
            ? (chore) => (
                <div className="flex flex-col gap-3">
                  <p className="type-section-title text-foreground">{chore.title}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{STATUS_LABELS[chore.status]}</Badge>
                    <Badge variant="secondary">{minutes(chore.minutes)}</Badge>
                  </div>
                  <p className="type-body text-foreground">{chore.notes}</p>
                  <Link to={`/chores/${chore.id}`} className="w-fit type-label text-link underline underline-offset-4">
                    Open page
                  </Link>
                </div>
              )
            : undefined
        }
      />
    </div>
  )
}

function ChorePage() {
  return (
    <div className="p-6">
      <p className="type-body text-foreground">A chore's page</p>
      <Link to="/" className="text-link underline">
        Back to chores
      </Link>
    </div>
  )
}

function InRouter({ path, withPanel, quickLook }: { path: string; withPanel?: boolean; quickLook?: boolean }) {
  const [router] = useState(() =>
    createMemoryRouter(
      [
        { path: '/', element: <ChoresTable withPanel={withPanel} quickLook={quickLook} /> },
        { path: '/chores/:id', element: <ChorePage /> },
      ],
      { initialEntries: [path] },
    ),
  )
  return <RouterProvider router={router} />
}

const meta: Meta = {
  title: 'app/DataTable grouping',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
}

export default meta

export const Chores: StoryObj = { render: () => <InRouter path="/" /> }

export const ChoresByArea: StoryObj = { render: () => <InRouter path="/?group=areas" /> }

export const ChoresWithPanel: StoryObj = { render: () => <InRouter path="/" withPanel /> }

export const ChoresWithQuickLook: StoryObj = { render: () => <InRouter path="/?group=status" quickLook /> }
