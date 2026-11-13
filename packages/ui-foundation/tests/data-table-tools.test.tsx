// DataTable's table tools (the list and record page standards: L3, L4, L5,
// L9, L11, R8) as markup: the views' pills, a view's columns over the
// menu's, the row actions' column, a capped list and its View All, and the
// filters that name themselves. The Columns menu's stored pick, the phone's
// row list and the bottom sheet need a browser: e2e/data-table-tools.spec.ts.
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { DropletIcon, Trash2Icon } from 'lucide-react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DataTable, type DataTableProps } from '../src/components/app/data-table'
import { FilterBar, FilterSelect } from '../src/components/app/filter-bar'
import { MultiChoice } from '../src/components/app/multi-choice'
import { RelatedTable } from '../src/components/app/related-table'
import { parseColumnsPick, togglePick, visibleFromPick } from '../src/components/app/table-columns'

type Item = { id: number; name: string; status: string; notes: string }

const columns: LegacyColumnDef<Item, unknown>[] = [
  { id: 'name', header: 'Name', cell: ({ row }) => row.original.name },
  { id: 'status', header: 'Status', cell: ({ row }) => row.original.status },
  { id: 'notes', header: 'Notes', cell: ({ row }) => row.original.notes },
]

const items: Item[] = Array.from({ length: 19 }, (_, index) => ({
  id: index + 1,
  name: `Plant ${index + 1}`,
  status: index % 2 ? 'Resting' : 'Thriving',
  notes: `Note ${index + 1}`,
}))

const noop = () => {}

function render(props: Partial<DataTableProps<Item>> = {}) {
  return renderToStaticMarkup(
    <DataTable<Item>
      columns={columns}
      data={items.slice(0, 3)}
      total={3}
      page={1}
      pageSize={50}
      onPageChange={noop}
      sorting={[]}
      onSortingChange={noop}
      isLoading={false}
      emptyTitle="Nothing yet"
      getRowId={(row) => String(row.id)}
      {...props}
    />,
  )
}

const VIEWS = {
  growing: { label: 'Growing', filters: { status: 'thriving' } },
  short: { label: 'Short', columns: ['name', 'status'] },
  all: { label: 'All' },
}

describe('the Columns menu pick', () => {
  it('reads only a well-formed pick', () => {
    expect(parseColumnsPick(null)).toBeNull()
    expect(parseColumnsPick('')).toBeNull()
    expect(parseColumnsPick('{"order":["a"]}')).toBeNull()
    expect(parseColumnsPick('{"order":["a","b"],"hidden":["b",3]}')).toEqual({ order: ['a', 'b'], hidden: ['b'] })
  })

  it('hides what was unticked, shows a column added since, never hides the name', () => {
    const pick = { order: ['name', 'status', 'notes'], hidden: ['notes', 'name'] }
    expect(visibleFromPick(['name', 'status', 'notes', 'added'], pick, ['name'])).toEqual(['name', 'status', 'added'])
  })

  it('a tick keeps every id in order, the unticked in hidden', () => {
    const ids = ['name', 'status', 'notes']
    const first = togglePick(ids, ids, 'notes', false, null)
    expect(first).toEqual({ order: ids, hidden: ['notes'] })
    const second = togglePick(ids, ['name', 'status'], 'notes', true, { order: ['name', 'notes', 'status'], hidden: ['notes'] })
    // A stored order is kept (for reordering, later).
    expect(second).toEqual({ order: ['name', 'notes', 'status'], hidden: [] })
  })
})

describe('DataTable views (L3)', () => {
  it('draws a pill per view, in order, the active one pressed', () => {
    const html = render({ views: VIEWS, activeView: 'growing', onViewChange: noop })
    expect(html).toContain('aria-label="Views"')
    const pills = [...html.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*>([^<]*)<\/button>/g)].map((match) => [match[2], match[1]])
    expect(pills).toEqual([
      ['Growing', 'true'],
      ['Short', 'false'],
      ['All', 'false'],
    ])
  })

  it('presses none when the filters are off every view', () => {
    const html = render({ views: VIEWS, activeView: null, onViewChange: noop })
    expect(html).not.toContain('aria-pressed="true"')
  })

  it("a view's columns show while it's on, over visibleColumns", () => {
    const html = render({ views: VIEWS, activeView: 'short', visibleColumns: ['name', 'notes'], columnsMenu: { storageKey: 'test:columns' } })
    expect(html).toContain('>Status<')
    expect(html).not.toContain('>Notes<')
  })

  it('a Columns button joins the toolbar', () => {
    expect(render({ columnsMenu: { storageKey: 'test:columns' } })).toContain('data-slot="data-table-columns-menu"')
  })
})

describe('DataTable row actions (L9)', () => {
  it('one action is its icon, named by its label, in a pinned last column', () => {
    const html = render({ rowActions: () => [{ label: 'Water', icon: DropletIcon, onSelect: noop }] })
    expect(html.match(/aria-label="Water"/g)).toHaveLength(3)
    expect(html).toContain('<span class="sr-only">Actions</span>')
    const lastCell = html.match(/<td[^>]*>(?:(?!<td).)*?aria-label="Water"/)?.[0] ?? ''
    expect(lastCell).toContain('sticky right-0')
  })

  it('two or more are a ⋯ menu', () => {
    const html = render({
      rowActions: () => [
        { label: 'Water', icon: DropletIcon, onSelect: noop },
        { label: 'Delete', icon: Trash2Icon, tone: 'destructive', onSelect: noop },
      ],
    })
    expect(html.match(/aria-label="Actions"/g)).toHaveLength(3)
    expect(html).not.toContain('aria-label="Water"')
  })

  it('a row with none gets an empty cell', () => {
    const html = render({ rowActions: (row) => (row.id === 1 ? [{ label: 'Water', icon: DropletIcon, onSelect: noop }] : []) })
    expect(html.match(/aria-label="Water"/g)).toHaveLength(1)
  })
})

describe('a capped list (R8)', () => {
  it('shows the limit, no pagination, and View All with the total', () => {
    const html = render({ data: items, total: 19, limit: 10, viewAll: { to: '/visits?plant=1' } })
    expect(html.match(/<tr/g)).toHaveLength(11)
    expect(html).not.toContain('data-table-pagination')
    expect(html).toMatch(/<a[^>]*href="\/visits\?plant=1"[^>]*>View All 19<\/a>/)
  })

  it('has no View All when every row shows', () => {
    const html = render({ data: items.slice(0, 3), total: 3, limit: 10, viewAll: { to: '/visits' } })
    expect(html).not.toContain('View All')
  })

  it('RelatedTable caps at 10 and its headers are not sort buttons', () => {
    const html = renderToStaticMarkup(
      <RelatedTable<Item>
        columns={columns}
        opens={{ kind: 'rows' }}
        data={items}
        total={19}
        isLoading={false}
        emptyTitle="None"
        viewAll={{ to: '/visits', label: 'Every visit' }}
      />,
    )
    expect(html.match(/<tr/g)).toHaveLength(11)
    expect(html).not.toContain('aria-sort')
    expect(html).toContain('>Every visit</a>')
  })
})

describe('filters that name themselves (L4)', () => {
  const options = [
    { value: 'active', label: 'Active' },
    { value: 'stopped', label: 'Stopped' },
  ]

  it('FilterSelect says "Any Status" while off and "Status: Active" on', () => {
    const off = renderToStaticMarkup(<FilterSelect label="Status" options={options} value="" onValueChange={noop} />)
    expect(off).toContain('aria-label="Any Status"')
    const on = renderToStaticMarkup(<FilterSelect label="Status" options={options} value="active" onValueChange={noop} />)
    expect(on).toContain('aria-label="Status: Active"')
    expect(on).toContain('Status: Active')
  })

  it('MultiChoice with a label shows the first pick and +N, not a chip each', () => {
    const html = renderToStaticMarkup(
      <MultiChoice label="Rooms" options={['Hall', 'Office', 'Porch']} value={['Hall', 'Porch']} onValueChange={noop} aria-label="Filter by rooms" />,
    )
    expect(html).toContain('data-slot="multi-choice-summary"')
    expect(html).toMatch(/Rooms: Hall.*\+1/)
    expect(html).not.toContain('Remove Porch')
  })

  it('FilterBar puts search, the primary filters and Filters on one line', () => {
    const html = renderToStaticMarkup(
      <FilterBar
        search={{ value: '', onChange: noop, placeholder: 'Search by name' }}
        primary={<FilterSelect label="Status" options={options} value="" onValueChange={noop} />}
        secondary={<FilterSelect label="Kind" options={options} value="" onValueChange={noop} />}
        active={[{ id: 'kind', label: 'Kind: Active', onRemove: noop }]}
        onClear={noop}
      />,
    )
    expect(html).toContain('aria-label="Search"')
    expect(html).toContain('placeholder="Search by name"')
    expect(html).toContain('aria-label="Any Status"')
    expect(html).toContain('Kind: Active')
  })
})
