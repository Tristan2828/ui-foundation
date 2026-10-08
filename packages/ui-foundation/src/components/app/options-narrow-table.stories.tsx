import type { Meta, StoryObj } from '@storybook/react-vite'
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import {
  BookOpenIcon,
  BriefcaseIcon,
  HeartIcon,
  HouseIcon,
  PencilIcon,
  PlaneIcon,
  SearchIcon,
  ShoppingCartIcon,
  Trash2Icon,
  WalletIcon,
  type LucideIcon,
} from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { AppError } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable } from './data-table'

// Options page for issue #104 (not a component, not for merging): a table
// with a few short columns on a wide screen. Every card is the real
// DataTable at a real content width, scaled down to fit; "100%" shows it
// at full size. The options are simulated with a wrapper around the table
// (what the opt-in prop would do), so the look is exactly what ships.

type Category = {
  id: number
  name: string
  icon: LucideIcon
  colour: string
  colourName: string
  widgets: number
  created: string
  owner: string
  notes: string
}

const CATEGORIES: Category[] = [
  { id: 1, name: 'Home', icon: HouseIcon, colour: 'text-category-1', colourName: 'Blue', widgets: 12, created: 'Mar 2, 2026', owner: 'ada@example.com', notes: 'Everything for the house' },
  { id: 2, name: 'Finance', icon: WalletIcon, colour: 'text-category-2', colourName: 'Purple', widgets: 4, created: 'Mar 9, 2026', owner: 'ada@example.com', notes: 'Bills and receipts' },
  { id: 3, name: 'Work', icon: BriefcaseIcon, colour: 'text-category-3', colourName: 'Olive', widgets: 27, created: 'Apr 1, 2026', owner: 'grace@example.com', notes: 'Office kit' },
  { id: 4, name: 'Health', icon: HeartIcon, colour: 'text-category-5', colourName: 'Magenta', widgets: 3, created: 'Apr 18, 2026', owner: 'grace@example.com', notes: '' },
  { id: 5, name: 'Travel', icon: PlaneIcon, colour: 'text-category-4', colourName: 'Teal', widgets: 8, created: 'May 5, 2026', owner: 'ada@example.com', notes: 'Bags, adapters' },
  { id: 6, name: 'Shopping', icon: ShoppingCartIcon, colour: 'text-category-10', colourName: 'Plum', widgets: 0, created: 'Jun 30, 2026', owner: 'alan@example.com', notes: '' },
  { id: 7, name: 'Reading', icon: BookOpenIcon, colour: 'text-category-9', colourName: 'Deep teal', widgets: 15, created: 'Jul 14, 2026', owner: 'alan@example.com', notes: 'Books to lend' },
]

const NAME: LegacyColumnDef<Category, unknown> = {
  id: 'name',
  header: 'Name',
  cell: ({ row }) => {
    const Icon = row.original.icon
    return (
      <span className="inline-flex items-center gap-2 font-medium">
        <Icon aria-hidden="true" className={`size-4 ${row.original.colour}`} />
        {row.original.name}
      </span>
    )
  },
}
const COLOUR: LegacyColumnDef<Category, unknown> = {
  id: 'colour',
  header: 'Colour',
  cell: ({ row }) => (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={`size-2.5 rounded-full bg-current ${row.original.colour}`} />
      {row.original.colourName}
    </span>
  ),
}
const WIDGETS: LegacyColumnDef<Category, unknown> = {
  id: 'widgets',
  header: 'Widgets',
  cell: ({ row }) => <span className="tabular-nums">{row.original.widgets}</span>,
}
const ACTIONS: LegacyColumnDef<Category, unknown> = {
  id: 'actions',
  header: () => <span className="sr-only">Actions</span>,
  cell: ({ row }) => (
    <span className="flex justify-end gap-1">
      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${row.original.name}`}>
        <PencilIcon />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${row.original.name}`}>
        <Trash2Icon />
      </Button>
    </span>
  ),
}
const EXTRA: LegacyColumnDef<Category, unknown>[] = [
  { id: 'created', header: 'Created', cell: ({ row }) => row.original.created },
  { id: 'owner', header: 'Owner', cell: ({ row }) => row.original.owner },
  { id: 'notes', header: 'Notes', cell: ({ row }) => row.original.notes || <span className="text-muted-foreground">—</span> },
  { id: 'id', header: 'Id', cell: ({ row }) => <span className="tabular-nums">{row.original.id}</span> },
  { id: 'updated', header: 'Updated', cell: () => 'Oct 6, 2026' },
]

const NARROW_COLUMNS = [NAME, COLOUR, WIDGETS, ACTIONS]
const WIDE_COLUMNS = [NAME, COLOUR, WIDGETS, ...EXTRA, ACTIONS]

type State = 'loaded' | 'loading' | 'empty' | 'error'
const ERROR: AppError = { kind: 'server', message: 'The server had a problem. Try again in a moment.' }

function CategoriesTable({ state, wide }: { state: State; wide: boolean }) {
  return (
    <DataTable<Category>
      columns={wide ? WIDE_COLUMNS : NARROW_COLUMNS}
      data={state === 'loaded' ? CATEGORIES : []}
      total={state === 'loaded' ? CATEGORIES.length : 0}
      page={1}
      pageSize={25}
      onPageChange={() => {}}
      sorting={[]}
      onSortingChange={() => {}}
      isLoading={state === 'loading'}
      error={state === 'error' ? ERROR : null}
      onRetry={() => {}}
      emptyTitle="No categories yet"
      emptyDescription="Add one to start sorting widgets."
      pinFirstColumn
      pinLastColumn
      getRowId={(row) => String(row.id)}
      toolbar={
        <div className="flex items-center gap-2">
          <div className="relative w-64 max-w-full">
            <SearchIcon aria-hidden="true" className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search categories" aria-label="Search categories" />
          </div>
          <Button className="ml-auto">New category</Button>
        </div>
      }
    />
  )
}

// A page in the app shell's content area: its title, then the table.
function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="flex flex-col gap-4">
        <h1 className="type-page-title text-foreground">Categories</h1>
        {children}
      </div>
    </div>
  )
}

// A content area `width` px wide, scaled down to the card (or at 100%,
// scrolled sideways).
function Frame({ width, fit, children }: { width: number; fit: boolean; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState(0)
  useLayoutEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) return
      setScale(fit ? Math.min(1, outer.current.clientWidth / width) : 1)
      setHeight(inner.current.offsetHeight)
    }
    const observer = new ResizeObserver(measure)
    if (outer.current) observer.observe(outer.current)
    if (inner.current) observer.observe(inner.current)
    return () => observer.disconnect()
  }, [width, fit])
  return (
    <div
      ref={outer}
      className={fit ? 'overflow-hidden rounded-lg border bg-background' : 'overflow-x-auto rounded-lg border bg-background'}
      style={{ height: height * scale + 2 }}
    >
      <div ref={inner} className="p-6" style={{ width, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {children}
      </div>
    </div>
  )
}

const OPTIONS: { id: string; title: string; how: string; notes: string[]; render: (table: ReactNode) => ReactNode }[] = [
  {
    id: 'today',
    title: 'Today (no option)',
    how: 'What every table does now, and what a table that doesn’t opt in keeps.',
    notes: ['Columns spread across the whole width; Edit and Delete sit at the far right edge.'],
    render: (table) => <Page>{table}</Page>,
  },
  {
    id: 'cap',
    title: '1. A width cap on the table',
    how: 'A prop such as size="narrow" (here capped at 48rem): table, toolbar and pagination share one width.',
    notes: [
      'Every state (loading, empty, error) is the same width, so nothing jumps when data arrives.',
      'The width is a fixed step, not the columns’ own: a table with long names wraps or scrolls inside it.',
    ],
    render: (table) => (
      <Page>
        <div className="max-w-3xl">{table}</div>
      </Page>
    ),
  },
  {
    id: 'content',
    title: '2. Size to content',
    how: 'The table takes the width its columns need, up to the page; the actions sit right after the last column.',
    notes: [
      'The tightest look once loaded, and it follows the columns as they change.',
      'Loading, empty and error don’t know that width: switch the state to see the page change width when data arrives.',
    ],
    render: (table) => (
      <Page>
        <div className="w-fit max-w-full">{table}</div>
      </Page>
    ),
  },
  {
    id: 'page',
    title: '3. A page-level cap',
    how: 'The app shell caps a list page with no wide content at a readable width (here 64rem): the title narrows with it.',
    notes: [
      'One switch per page rather than per table, and the title, toolbar and table line up.',
      'Wider than option 1 at the same table, since it’s sized for a page, not this table.',
    ],
    render: (table) => <Page className="max-w-5xl">{table}</Page>,
  },
  {
    id: 'content-min',
    title: '4. Size to content, with a minimum',
    how: 'Option 2, but never narrower than 36rem, so a tiny table doesn’t look lost.',
    notes: ['A small table looks deliberate rather than squeezed.', 'Still changes width between states, like option 2 (less, thanks to the minimum).'],
    render: (table) => (
      <Page>
        <div className="w-fit min-w-[36rem] max-w-full">{table}</div>
      </Page>
    ),
  },
]

const WIDTHS = [
  { width: 2300, label: '2560 screen (2300 content)' },
  { width: 1344, label: '1600 screen' },
  { width: 1024, label: '1280 screen' },
]

function Segmented<T extends string | number | boolean>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="type-label text-muted-foreground">{label}</span>
      {options.map((option) => (
        <Button
          key={String(option.value)}
          size="sm"
          variant={option.value === value ? 'default' : 'outline'}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

function OptionsPage() {
  const [width, setWidth] = useState(2300)
  const [state, setState] = useState<State>('loaded')
  const [wide, setWide] = useState(false)
  const [fit, setFit] = useState(true)
  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="type-page-title text-foreground">#104 Narrow tables on wide screens: options</h1>
        <p className="type-body max-w-3xl text-muted-foreground">
          Each card is the real DataTable at a real content width, scaled to fit. Pick one; the default stays as it is
          today and a table opts in. Phone widths are unchanged in every option. Switch the theme in Storybook’s toolbar.
        </p>
      </header>
      <div className="sticky top-0 z-30 flex flex-wrap gap-x-6 gap-y-2 border-b bg-background py-3">
        <Segmented label="Content width" value={width} onChange={setWidth} options={WIDTHS.map(({ width, label }) => ({ value: width, label }))} />
        <Segmented
          label="State"
          value={state}
          onChange={setState}
          options={[
            { value: 'loaded', label: 'Loaded' },
            { value: 'loading', label: 'Loading' },
            { value: 'empty', label: 'Empty' },
            { value: 'error', label: 'Error' },
          ]}
        />
        <Segmented
          label="Columns"
          value={wide}
          onChange={setWide}
          options={[
            { value: false, label: '4 (narrow)' },
            { value: true, label: '9 (wide)' },
          ]}
        />
        <Segmented
          label="Zoom"
          value={fit}
          onChange={setFit}
          options={[
            { value: true, label: 'Fit' },
            { value: false, label: '100%' },
          ]}
        />
      </div>
      {OPTIONS.map((option) => (
        <section key={option.id} aria-labelledby={`option-${option.id}`} className="flex flex-col gap-2">
          <h2 id={`option-${option.id}`} className="type-section-title text-foreground">
            {option.title}
          </h2>
          <p className="type-body text-foreground">{option.how}</p>
          <ul className="type-caption list-disc pl-5 text-muted-foreground">
            {option.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <Frame width={width} fit={fit}>
            {option.render(<CategoriesTable state={state} wide={wide} />)}
          </Frame>
        </section>
      ))}
    </div>
  )
}

const meta: Meta = {
  title: 'options/104 Narrow table',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
}

export default meta

export const Options: StoryObj = { render: () => <OptionsPage /> }
