import type { Meta, StoryObj } from '@/fixtures/types'
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { BoxIcon, DownloadIcon, ExternalLinkIcon, PinIcon, PrinterIcon, UploadIcon } from 'lucide-react'
import { useState } from 'react'
import { createMemoryRouter, Link, MemoryRouter, RouterProvider, useLocation } from 'react-router'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Toaster } from '@/components/ui/sonner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { ChoiceButtons } from './choice-buttons'
import { DataTable } from './data-table'
import { DeleteAction } from './delete-action'
import { editInPlace } from './edit-in-place'
import { EntityView, type EntityViewSection } from './entity-view'
import { FilterBar, FilterSelect } from './filter-bar'
import { IconAction } from './icon-action'
import { delayedUpload } from './image-upload.fixtures'
import { ListHeader } from './list-header'
import { MultiPick } from './multi-pick'
import { Notice } from './notice'
import { RichTextEditor } from './rich-text-editor'

// The page standards' gaps that apps worked around (4.121), on made-up
// records: an icon action that is a link, a search box's own keys, toned
// badges in the facts rail, a default view that keeps its sort off the
// address, filter selects named by their label, a ToggleGroup paired with
// ChoiceButtons, a list fact edited in place that holds still on a phone,
// Delete icons named by their record, the slash menu's Image in an editor
// with only the floating toolbar, ⋯ items that can't be used now, and a
// bar between a framed list's header and its card.
// e2e/page-gaps.spec.ts drives them; axe sees them in both themes
// (e2e/fixtures-visual.spec.ts).

const meta: Meta = {
  title: 'app/Page Gaps',
  parameters: { controls: { disable: true } },
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
        <Toaster />
      </TooltipProvider>
    ),
  ],
}

export default meta

// --- IconAction as a link, FilterBar's keys, FilterSelect's names ----------

function ActionsAndFilters() {
  const [search, setSearch] = useState('')
  const [opened, setOpened] = useState('nothing')
  const [kind, setKind] = useState('')
  const [shelf, setShelf] = useState('')
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex items-center gap-2">
        <IconAction icon={PrinterIcon} label="Print" render={<Link to="/print" />} />
        <IconAction icon={ExternalLinkIcon} label="Open site" render={<a href="https://example.com" target="_blank" rel="noreferrer" />} />
        <IconAction icon={PinIcon} label="Pin" />
      </div>
      <FilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search, or #12 to open one',
          onKeyDown: (event) => {
            if (event.key !== 'Enter') return
            const number = /^#(\d+)$/.exec(search.trim())
            if (!number) return
            event.preventDefault()
            setOpened(`record ${number[1]}`)
          },
        }}
        primary={
          <>
            <FilterSelect
              label="Kind"
              options={[
                { value: 'tool', label: 'Tool' },
                { value: 'part', label: 'Part' },
              ]}
              value={kind}
              onValueChange={setKind}
            />
            <FilterSelect
              label="Shelf"
              anyLabel="Anywhere"
              options={[
                { value: 'top', label: 'Top' },
                { value: 'low', label: 'Low' },
              ]}
              value={shelf}
              onValueChange={setShelf}
            />
          </>
        }
      />
      <p className="type-caption text-muted-foreground" data-testid="opened">
        Opened: {opened}
      </p>
    </div>
  )
}

export const LinksAndFilters: StoryObj = {
  name: 'Links and filters',
  render: () => (
    <MemoryRouter>
      <ActionsAndFilters />
    </MemoryRouter>
  ),
}

// --- A record: toned badges, a list fact edited in place, named Deletes ---

const PARTS = [
  { id: 1, label: 'Hinge, brass, left-hand door' },
  { id: 2, label: 'Shelf bracket' },
  { id: 3, label: 'Cabinet handle, matte' },
  { id: 4, label: 'Drawer runner, full extension' },
]

function GapRecord() {
  const [parts, setParts] = useState<number[]>([1, 2, 3])
  const [shelves, setShelves] = useState(['Workshop wall', 'Garage'])
  const name = (id: number) => PARTS.find((part) => part.id === id)?.label ?? `Part ${id}`
  const sections: EntityViewSection[] = [
    {
      title: 'Facts',
      placement: 'rail',
      facts: [
        {
          label: 'Flags',
          kind: 'badges',
          items: [
            { label: 'Pinned', icon: PinIcon, tone: 'info' },
            { label: 'Overdue', tone: 'destructive' },
            { label: 'Checked', tone: 'success' },
            { label: 'Low stock', tone: 'warning' },
            'Plain',
          ],
        },
        {
          label: 'Parts',
          kind: 'list',
          items: parts.map((id) => ({ name: name(id), to: `/parts/${id}`, icon: BoxIcon })),
          emptyLabel: 'No parts linked',
          edit: editInPlace<number[]>({
            kind: 'multi',
            value: parts,
            save: async (next) => setParts(next),
            control: (props) => (
              <MultiPick
                options={PARTS}
                value={props.value}
                onValueChange={props.onChange}
                aria-label={props.label}
                aria-describedby={props.describedBy}
              />
            ),
          }),
        },
        { label: 'Added', kind: 'text', text: 'Nov 2, 2026' },
      ],
    },
    {
      title: 'Shelves',
      content: (
        <ul className="flex flex-col gap-2">
          {shelves.map((shelf) => (
            <li key={shelf} className="flex items-center gap-3">
              <span className="flex-1 type-body">{shelf}</span>
              <DeleteAction name={shelf} kind="hard" size="sm" onDelete={async () => setShelves((was) => was.filter((s) => s !== shelf))} />
            </li>
          ))}
        </ul>
      ),
    },
  ]
  return (
    <EntityView
      isLoading={false}
      back={{ to: '/', label: 'Kits' }}
      title="Cabinet repair kit"
      factsRail
      actions={<DeleteAction name="Cabinet repair kit" kind="soft" onDelete={async () => {}} />}
      sections={sections}
    />
  )
}

function GapRecordInRouter() {
  const [router] = useState(() => createMemoryRouter([{ path: '*', element: <GapRecord /> }]))
  return <RouterProvider router={router} />
}

export const Record: StoryObj = { name: 'Record', render: () => <GapRecordInRouter /> }

// --- A ToggleGroup and ChoiceButtons paired; the slash menu's Image ------

const SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'large', label: 'Large' },
]

const GUIDE =
  '# Before You Start\n\nTurn the water off at the valve under the sink, then open the tap to drain the line.\n\n' +
  '| Part | Size | Where |\n| --- | --- | --- |\n| Washer | 1/2 in | Drawer 2 |\n| Cartridge | 35 mm | Shelf |\n\n' +
  "- [ ] Photograph the old fitting\n- [x] Buy plumber's tape\n"

function FormGaps() {
  const [size, setSize] = useState<string | null>('small')
  const [finish, setFinish] = useState<string[]>(['matte'])
  const [notes, setNotes] = useState('Steps for the repair.\n')
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <FieldGroup>
        <Field size="m">
          <FieldLabel id="size-label">Size</FieldLabel>
          <ChoiceButtons aria-labelledby="size-label" options={SIZES} value={size} onValueChange={setSize} />
        </Field>
        <Field size="m">
          <FieldLabel id="finish-label">Finish</FieldLabel>
          <ToggleGroup aria-labelledby="finish-label" variant="outline" value={finish} onValueChange={(next) => setFinish(next as string[])}>
            <ToggleGroupItem value="matte">Matte</ToggleGroupItem>
            <ToggleGroupItem value="gloss">Gloss</ToggleGroupItem>
          </ToggleGroup>
        </Field>
      </FieldGroup>
      <div data-testid="floating-editor">
        <RichTextEditor
          id="repair-notes"
          aria-label="Repair notes"
          defaultValue={notes}
          onChange={setNotes}
          toolbar="floating"
          upload={delayedUpload(200)}
        />
      </div>
      <pre className="type-caption text-muted-foreground whitespace-pre-wrap" data-testid="notes-value">
        {notes}
      </pre>
      {/* Notes always edited where they're read (a phone's), above the
          facts: while the editor loads, the text holds their place. */}
      <RichTextEditor aria-label="Guide" defaultValue={GUIDE} onChange={() => {}} inline toolbar="floating" />
      <p className="type-body" data-testid="after-guide">
        The facts under the notes.
      </p>
    </div>
  )
}

export const Forms: StoryObj = { name: 'Forms', render: () => <FormGaps /> }

// --- A framed list: a bar under its header, ⋯ items disabled, and a
// default view that keeps its sort off the address ------------------------

type Kit = { id: number; name: string; status: 'open' | 'done'; due: string }
const KITS: Kit[] = [
  { id: 1, name: 'Cabinet repair', status: 'open', due: '2026-11-20' },
  { id: 2, name: 'Bike tune-up', status: 'open', due: '2026-11-03' },
  { id: 3, name: 'Gutter clean', status: 'done', due: '2026-10-12' },
]
const kitColumns: LegacyColumnDef<Kit, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'due', header: 'Due' },
]
const KIT_VIEWS = {
  open: { label: 'Open', filters: { status: 'open' }, sort: [{ id: 'due', desc: false }] },
  done: { label: 'Done', filters: { status: 'done' }, sort: [{ id: 'name', desc: false }] },
}

function sortKits(rows: Kit[], sorting: readonly { id: string; desc: boolean }[]) {
  const [by] = sorting
  if (!by) return rows
  const key = by.id as keyof Kit
  return [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (by.desc ? -1 : 1))
}

function KitList() {
  const { filters, setFilter, activeView, applyView, sorting, setSorting } = useTableUrlState(['status'], [], KIT_VIEWS, {
    defaultView: 'open',
  })
  const location = useLocation()
  const rows = sortKits(
    KITS.filter((kit) => !filters.status || kit.status === filters.status),
    sorting,
  )
  return (
    <div className="flex flex-col gap-4 p-4">
      <DataTable
        look="framed"
        pageHeader={
          <ListHeader
            title="Kits"
            count={rows.length}
            more={[
              { label: 'Export', icon: DownloadIcon, onSelect: () => {} },
              { label: 'Import', icon: UploadIcon, onSelect: () => {}, disabled: true },
            ]}
            newAction={{ label: 'New kit', onClick: () => {} }}
          />
        }
        pageBar={
          <Notice tone="info" title="Two kits are due this week">
            A bar between the header and the list, as wide as the card however long it runs: it wraps rather than widening the box.
          </Notice>
        }
        columns={kitColumns}
        opens={{ kind: 'page', to: (kit) => `/kits/${kit.id}` }}
        views={KIT_VIEWS}
        activeView={activeView}
        onViewChange={applyView}
        toolbar={
          <FilterBar
            primary={
              <FilterSelect
                label="Status"
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'done', label: 'Done' },
                ]}
                value={filters.status}
                onValueChange={(value) => setFilter('status', value)}
              />
            }
          />
        }
        data={rows}
        total={rows.length}
        page={1}
        pageSize={50}
        onPageChange={() => {}}
        sorting={sorting}
        onSortingChange={setSorting}
        isLoading={false}
        getRowId={(kit) => String(kit.id)}
        emptyTitle="No kits match"
        emptyDescription="Try another view."
      />
      <p className="type-caption text-muted-foreground" data-testid="address">
        Address: {location.search || '(plain)'}
      </p>
      <p className="type-caption text-muted-foreground" data-testid="order">
        Order: {rows.map((kit) => kit.name).join(', ')}
      </p>
    </div>
  )
}

function KitListInRouter() {
  const [router] = useState(() => createMemoryRouter([{ path: '*', element: <KitList /> }]))
  return <RouterProvider router={router} />
}

export const FramedList: StoryObj = { name: 'Framed list', render: () => <KitListInRouter /> }
