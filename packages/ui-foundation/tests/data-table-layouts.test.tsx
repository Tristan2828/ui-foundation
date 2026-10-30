// DataTable's card layouts (issue #252): the switch, each card layout's
// cards in a list, `groupBy` headings over them, and each state. Sizes and
// the switch in use are e2e/data-table-layouts.spec.ts's.
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DataTable, type DataTableCardLayout, type DataTableProps } from '../src/components/app/data-table'

type Item = { id: number; name: string; day: string }

const columns: LegacyColumnDef<Item, unknown>[] = [{ id: 'name', header: 'Item', cell: ({ row }) => row.original.name }]
const items: Item[] = [
  { id: 1, name: 'Desk lamp', day: 'Today' },
  { id: 2, name: 'Bookshelf', day: 'Today' },
  { id: 3, name: 'Rug', day: 'Yesterday' },
]
const icon = () => null
const layouts: DataTableCardLayout<Item>[] = [
  { id: 'grid', label: 'Grid', icon, renderCard: (item) => <b>card {item.name}</b> },
  { id: 'compact', label: 'Compact', icon, arrange: 'list', renderCard: (item) => <i>line {item.name}</i> },
]
const noop = () => {}

function render(props: Partial<DataTableProps<Item>> = {}) {
  return renderToStaticMarkup(
    <DataTable<Item>
      columns={columns}
      data={items}
      total={items.length}
      page={1}
      pageSize={25}
      onPageChange={noop}
      sorting={[]}
      onSortingChange={noop}
      isLoading={false}
      emptyTitle="Nothing yet"
      getRowId={(row) => String(row.id)}
      layouts={layouts}
      {...props}
    />,
  )
}

describe('DataTable layouts', () => {
  it('without layouts, no switch', () => {
    expect(render({ layouts: undefined })).not.toContain('data-table-layout-switch')
  })

  it('shows a switch with the table first, and the table until another is picked', () => {
    const html = render()
    expect(html).toContain('data-slot="data-table-layout-switch"')
    expect(html).toContain('aria-label="Layout"')
    expect([...html.matchAll(/<span class="max-sm:sr-only">([^<]+)<\/span>/g)].map(([, label]) => label)).toEqual(['Table', 'Grid', 'Compact'])
    expect(html).toContain('<table')
    expect(html).toContain('data-layout="table"')
  })

  it("names the table's entry as asked", () => {
    expect(render({ tableLayout: { label: 'Rows' } })).toContain('>Rows</span>')
  })

  it('draws a card layout as a list of cards, and still pages', () => {
    const html = render({ layout: 'grid' })
    expect(html).not.toContain('<table')
    expect(html).toContain('data-layout="grid"')
    expect(html.match(/data-slot="data-table-card"/g)).toHaveLength(3)
    expect(html).toContain('<b>card Bookshelf</b>')
    expect(html).toContain('1–3 of 3')
  })

  it('puts each group under its own heading in a card layout', () => {
    const html = render({ layout: 'compact', groupBy: (item) => ({ key: item.day, label: item.day }), groupSummary: (rows) => `${rows.length} items` })
    const headings = [...html.matchAll(/<h2[^>]*><span[^>]*>([^<]+)<\/span><span[^>]*>([^<]+)<\/span><\/h2>/g)].map(([, label, summary]) => `${label} ${summary}`)
    expect(headings).toEqual(['Today 2 items', 'Yesterday 1 items'])
    expect(html.match(/<ul/g)).toHaveLength(2)
  })

  it("shows the table for a layout it doesn't have", () => {
    expect(render({ layout: 'big' })).toContain('<table')
  })

  it('loading, empty and error in a card layout', () => {
    const loading = render({ layout: 'grid', isLoading: true, data: [] })
    expect(loading).toContain('data-state="loading"')
    expect(loading).not.toContain('<table')
    expect(render({ layout: 'grid', data: [], total: 0 })).toContain('Nothing yet')
    expect(render({ layout: 'grid', error: { kind: 'server', message: 'Down for a moment' } })).toContain('Down for a moment')
  })
})
