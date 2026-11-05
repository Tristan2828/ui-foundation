import type { Meta, StoryObj } from '@/fixtures/types'
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { BookOpenIcon, CheckIcon, LayoutGridIcon, ListIcon, Rows3Icon } from 'lucide-react'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { AppError } from '@/api/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTableLayout } from '@/hooks/use-table-layout'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { byDay } from '@/lib/group-by-day'
import { Artwork, ArtworkTag, ArtworkToggle } from './artwork'
import { DataTable, type DataTableCardLayout } from './data-table'
import { PillFilter } from './pill-filter'

// DataTable's card layouts (issue #252), in a real browser
// (e2e/data-table-layouts.spec.ts), with axe and the token check in both
// themes (e2e/fixtures-visual.spec.ts):
// - Feed: a list-like table under day headings with Rows (the table, its
//   switch entry renamed), Grid (16:9 cards, `md`) and Compact (`list`,
//   one line each), a PillFilter, six a page so a day carries on to page
//   2, and a switch between the four states. The layout is in the URL and
//   remembered under `fixtures:feed:layout`.
// - Covers: a collection with Table and Covers (2:3, `sm`), opening on
//   Covers, a round Read button on each cover, one record without a
//   picture for the placeholder.

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

// --- a feed: rows, grid, compact -------------------------------------------------

type Kind = 'video' | 'audio'
type FeedItem = { id: number; title: string; source: string; kind: Kind; publishedAt: string; minutes: number }

const FEED: FeedItem[] = [
  { id: 1, title: 'Morning briefing', source: 'Daily Desk', kind: 'audio', publishedAt: '2026-10-15T07:30:00Z', minutes: 18 },
  { id: 2, title: 'How the bridge was built', source: 'Big Works', kind: 'video', publishedAt: '2026-10-15T06:10:00Z', minutes: 42 },
  { id: 3, title: 'Kitchen garden, week 40', source: 'Plot Notes', kind: 'video', publishedAt: '2026-10-14T19:00:00Z', minutes: 12 },
  { id: 4, title: 'Evening news', source: 'Daily Desk', kind: 'audio', publishedAt: '2026-10-14T18:00:00Z', minutes: 30 },
  { id: 5, title: 'Interview: the new library', source: 'Town Hall', kind: 'audio', publishedAt: '2026-10-13T12:00:00Z', minutes: 55 },
  { id: 6, title: 'Bread at home', source: 'Plot Notes', kind: 'video', publishedAt: '2026-10-13T09:00:00Z', minutes: 9 },
  { id: 7, title: 'Rail timetable changes', source: 'Town Hall', kind: 'audio', publishedAt: '2026-10-12T16:00:00Z', minutes: 7 },
  { id: 8, title: 'Autumn walks', source: 'Big Works', kind: 'video', publishedAt: '2026-10-09T10:00:00Z', minutes: 21 },
]

const FEED_PAGE_SIZE = 6
const byPublished = byDay<FeedItem>('publishedAt', { now: new Date('2026-10-15T10:00:00Z'), timeZone: 'UTC' })
const KIND_LABELS: Record<Kind, string> = { video: 'Video', audio: 'Audio' }

function duration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} m`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} m`
}

function Initials({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[0.625rem] font-semibold text-foreground">
      {name.split(' ').map((word) => word[0]).join('').slice(0, 2)}
    </span>
  )
}

function Open({ item }: { item: FeedItem }) {
  return (
    <Button variant="outline" size="sm" aria-label={`Open ${item.title}`}>
      Open
    </Button>
  )
}

const FEED_COLUMNS: LegacyColumnDef<FeedItem, unknown>[] = [
  {
    id: 'title',
    header: 'Item',
    cell: ({ row }) => (
      <span className="flex items-center gap-3">
        <span className="w-28 shrink-0">
          <Artwork aspect="16:9" bottomEnd={<ArtworkTag>{duration(row.original.minutes)}</ArtworkTag>} />
        </span>
        <span className="flex flex-col whitespace-normal">
          <span className="font-medium text-foreground">{row.original.title}</span>
          <span className="type-caption text-muted-foreground">{row.original.source}</span>
        </span>
      </span>
    ),
  },
  { id: 'actions', header: 'Actions', meta: { align: 'center' }, cell: ({ row }) => <Open item={row.original} /> },
]

const FEED_LAYOUTS: DataTableCardLayout<FeedItem>[] = [
  {
    id: 'grid',
    label: 'Grid',
    icon: LayoutGridIcon,
    aspect: '16:9',
    renderCard: (item) => (
      <article className="flex flex-col gap-2">
        <Artwork aspect="16:9" bottomEnd={<ArtworkTag>{duration(item.minutes)}</ArtworkTag>} />
        <div className="flex items-start gap-2">
          <Initials name={item.source} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="line-clamp-2 font-medium text-foreground">{item.title}</span>
            <span className="type-caption text-muted-foreground">
              {item.source} · {KIND_LABELS[item.kind]}
            </span>
          </div>
        </div>
        <div>
          <Open item={item} />
        </div>
      </article>
    ),
  },
  {
    id: 'compact',
    label: 'Compact',
    icon: ListIcon,
    arrange: 'list',
    renderCard: (item) => (
      <div className="flex items-center gap-3 px-3 py-1.5">
        <Initials name={item.source} />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{item.title}</span>
        <span className="type-caption text-muted-foreground tabular-nums">{duration(item.minutes)}</span>
        <Open item={item} />
      </div>
    ),
  },
]

function FeedTable() {
  const [state, setState] = useState<State>('loaded')
  const { page, filters, setFilter, setPage } = useTableUrlState(['kind'])
  const { layout, setLayout } = useTableLayout({ layouts: ['table', 'grid', 'compact'], storageKey: 'fixtures:feed:layout' })
  const matching = filters.kind ? FEED.filter((item) => item.kind === filters.kind) : FEED
  const rows = state === 'loaded' ? matching.slice((page - 1) * FEED_PAGE_SIZE, page * FEED_PAGE_SIZE) : []
  return (
    <div className="flex flex-col gap-4 p-6">
      <StateSwitch state={state} onChange={setState} />
      <h1 className="type-page-title text-foreground">Feed</h1>
      <DataTable<FeedItem>
        header={false}
        groupBy={byPublished}
        groupSummary={(items) => `${items.length} · ${duration(items.reduce((sum, item) => sum + item.minutes, 0))}`}
        columns={FEED_COLUMNS}
        layouts={FEED_LAYOUTS}
        layout={layout}
        onLayoutChange={setLayout}
        tableLayout={{ label: 'Rows', icon: Rows3Icon }}
        data={rows}
        total={state === 'loaded' ? matching.length : 0}
        page={page}
        pageSize={FEED_PAGE_SIZE}
        onPageChange={setPage}
        sorting={[]}
        onSortingChange={noop}
        isLoading={state === 'loading'}
        error={state === 'error' ? LOAD_ERROR : null}
        onRetry={noop}
        getRowId={(row) => String(row.id)}
        emptyTitle="Nothing in the feed yet"
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

// --- a collection: table or covers ---------------------------------------------

type Book = { id: number; title: string; author: string; cover: string | null; read: boolean; rating: number | null }

// Covers drawn in the page itself (data: URIs), so the story needs no network.
const cover = (hue: number) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 3"><defs><linearGradient id="g" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue} 35% 72%)"/><stop offset="1" stop-color="hsl(${hue + 30} 40% 42%)"/></linearGradient></defs><rect width="2" height="3" fill="url(#g)"/></svg>`,
  )}`

const BOOKS: Book[] = [
  { id: 1, title: 'The Long Field', author: 'A. Marsh', cover: cover(20), read: true, rating: 4 },
  { id: 2, title: 'Harbour Lights', author: 'J. Okafor', cover: cover(200), read: false, rating: null },
  { id: 3, title: 'A Map of Small Towns', author: 'R. Lind', cover: cover(120), read: false, rating: null },
  { id: 4, title: 'Winter Orchard', author: 'S. Vale', cover: null, read: true, rating: 5 },
  { id: 5, title: 'The Quiet Engine', author: 'M. Duarte', cover: cover(280), read: false, rating: null },
]

function ReadToggle({ book, onToggle }: { book: Book; onToggle: (id: number) => void }) {
  return <ArtworkToggle label={`Read: ${book.title}`} pressed={book.read} onPressedChange={() => onToggle(book.id)} icon={CheckIcon} />
}

function CoversTable() {
  const [state, setState] = useState<State>('loaded')
  const [books, setBooks] = useState(BOOKS)
  const { layout, setLayout } = useTableLayout({
    layouts: ['table', 'covers'],
    defaultLayout: 'covers',
    storageKey: 'fixtures:books:layout',
  })
  const toggle = (id: number) => setBooks((all) => all.map((book) => (book.id === id ? { ...book, read: !book.read } : book)))
  const columns: LegacyColumnDef<Book, unknown>[] = [
    {
      id: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <span className="flex items-center gap-3">
          <span className="w-8 shrink-0">
            <Artwork aspect="2:3" src={row.original.cover} placeholderIcon={BookOpenIcon} />
          </span>
          <span className="font-medium">{row.original.title}</span>
        </span>
      ),
    },
    { id: 'author', header: 'Author', cell: ({ row }) => row.original.author },
    {
      id: 'read',
      header: 'Read',
      cell: ({ row }) => (
        <Button variant="outline" size="sm" aria-pressed={row.original.read} onClick={() => toggle(row.original.id)}>
          {row.original.read ? 'Read' : 'Not read'}
        </Button>
      ),
    },
  ]
  const layouts: DataTableCardLayout<Book>[] = [
    {
      id: 'covers',
      label: 'Covers',
      icon: LayoutGridIcon,
      size: 'sm',
      aspect: '2:3',
      renderCard: (book) => (
        <article className="flex flex-col gap-1.5">
          <Artwork
            aspect="2:3"
            src={book.cover}
            placeholderIcon={BookOpenIcon}
            placeholderLabel={book.title}
            topEnd={<ReadToggle book={book} onToggle={toggle} />}
          />
          <span className="line-clamp-2 font-medium text-foreground">{book.title}</span>
          <span className="type-caption truncate text-muted-foreground">{book.author}</span>
          {book.read && (
            <span>
              <Badge variant="secondary">Read</Badge>
            </span>
          )}
        </article>
      ),
    },
  ]
  return (
    <div className="flex flex-col gap-4 p-6">
      <StateSwitch state={state} onChange={setState} />
      <h1 className="type-page-title text-foreground">Books</h1>
      <DataTable<Book>
        columns={columns}
        layouts={layouts}
        layout={layout}
        onLayoutChange={setLayout}
        data={state === 'loaded' ? books : []}
        total={state === 'loaded' ? books.length : 0}
        page={1}
        pageSize={25}
        onPageChange={noop}
        sorting={[]}
        onSortingChange={noop}
        isLoading={state === 'loading'}
        error={state === 'error' ? LOAD_ERROR : null}
        onRetry={noop}
        getRowId={(row) => String(row.id)}
        emptyTitle="No books yet"
      />
    </div>
  )
}

function InRouter({ element, path }: { element: React.ReactNode; path: string }) {
  const [router] = useState(() => createMemoryRouter([{ path: '/', element }], { initialEntries: [path] }))
  return <RouterProvider router={router} />
}

const meta: Meta = {
  title: 'app/DataTable layouts',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
}

export default meta

export const Feed: StoryObj = { render: () => <InRouter element={<FeedTable />} path="/" /> }

export const FeedGrid: StoryObj = { render: () => <InRouter element={<FeedTable />} path="/?layout=grid" /> }

export const FeedCompact: StoryObj = { render: () => <InRouter element={<FeedTable />} path="/?layout=compact" /> }

export const Covers: StoryObj = { render: () => <InRouter element={<CoversTable />} path="/?layout=covers" /> }
