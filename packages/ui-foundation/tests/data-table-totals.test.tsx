// DataTable's `totals` (issue #225): a <tfoot> row, its label a row
// header in the first visible column, each value under its own column, a
// hidden column's left out, and no row at all beside no rows. Where it
// sits on screen (aligned, pinned, scrolling) is e2e/data-table.spec.ts's.
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DataTable, type DataTableProps, type DataTableTotals } from '../src/components/app/data-table'

type Item = { id: number; name: string; price: string; weight: string }

const columns: LegacyColumnDef<Item, unknown>[] = [
  { id: 'name', header: 'Item', cell: ({ row }) => row.original.name },
  { id: 'price', header: 'Price', meta: { align: 'right' }, cell: ({ row }) => row.original.price },
  { id: 'weight', header: 'Weight', cell: ({ row }) => row.original.weight },
  { id: 'actions', header: 'Actions', meta: { align: 'center' }, cell: () => null },
]

const items: Item[] = [
  { id: 1, name: 'Desk lamp', price: '$34.50', weight: '1.2 kg' },
  { id: 2, name: 'Bookshelf', price: '$189.00', weight: '32 kg' },
]

const totals: DataTableTotals = { label: 'Total · 2 items', cells: { name: 'not shown', price: '$223.50', weight: '33.2 kg' } }

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
      {...props}
    />,
  )
}

const footerCells = (html: string) =>
  [...(html.match(/<tfoot[^>]*>(.*)<\/tfoot>/)?.[1] ?? '').matchAll(/<(th|td)([^>]*)>(.*?)<\/\1>/g)].map(
    ([, tag, attributes, text]) => ({ tag, attributes, text }),
  )

describe('DataTable totals', () => {
  it('without it, no footer', () => {
    expect(render()).not.toContain('<tfoot')
  })

  it('puts the label in a row header in the first column, then each value under its column', () => {
    const cells = footerCells(render({ totals }))
    expect(cells.map(({ tag, text }) => [tag, text])).toEqual([
      ['th', 'Total · 2 items'],
      ['td', '$223.50'],
      ['td', '33.2 kg'],
      ['td', ''],
    ])
    expect(cells[0].attributes).toContain('scope="row"')
    // A column's own alignment carries down to its footer cell.
    expect(cells[3].attributes).toMatch(/class="[^"]*text-center/)
    expect(cells[1].attributes).toMatch(/class="[^"]*text-right/)
  })

  it("right-aligns a 'right' column's header and cells", () => {
    const html = render()
    expect(html).toMatch(/<th[^>]*class="[^"]*text-right[^"]*"[^>]*>Price<\/th>/)
    expect(html).toMatch(/<td[^>]*class="[^"]*text-right[^"]*"[^>]*>\$34.50<\/td>/)
  })

  it('leaves out a hidden column, and a value for it', () => {
    const cells = footerCells(render({ totals, visibleColumns: ['name', 'price', 'actions'] }))
    expect(cells.map(({ text }) => text)).toEqual(['Total · 2 items', '$223.50', ''])
  })

  it('pins the label with the first column, and the last cell with the last', () => {
    const cells = footerCells(render({ totals, pinFirstColumn: true, pinLastColumn: true }))
    expect(cells[0].attributes).toMatch(/class="[^"]*sticky left-0/)
    expect(cells[0].text).toContain('Total · 2 items')
    expect(cells.at(-1)!.attributes).toMatch(/class="[^"]*sticky right-0/)
  })

  it('shows no row while loading, on error, or with no rows', () => {
    expect(render({ totals, isLoading: true, data: [], total: 0 })).not.toContain('<tfoot')
    expect(render({ totals, error: { kind: 'server', message: 'Down' } })).not.toContain('<tfoot')
    expect(render({ totals, data: [], total: 0 })).not.toContain('<tfoot')
  })
})
