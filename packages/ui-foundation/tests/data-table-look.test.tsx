// DataTable's list look (4.80): no zebra unless `striped`, the hover on
// every body row but a highlighted one, `width="content"` by default,
// `meta.clip`/`maxWidth`, and the rows-per-page menu. How they look and
// behave in a browser (hover colours, the tooltip, the menu, the widths) is
// e2e/data-table.spec.ts's.
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DataTable, type DataTableProps } from '../src/components/app/data-table'
import { resolvePageSize } from '../src/hooks/use-table-url-state'

type Item = { id: number; name: string; notes: string }

const columns: LegacyColumnDef<Item, unknown>[] = [
  { id: 'name', header: 'Item', cell: ({ row }) => row.original.name },
  { id: 'notes', header: 'Notes', meta: { clip: true }, cell: ({ row }) => row.original.notes },
]

const items: Item[] = [
  { id: 1, name: 'Desk lamp', notes: 'A long note about where the lamp came from and what it needs' },
  { id: 2, name: 'Bookshelf', notes: 'Short' },
]

const noop = () => {}

function render(props: Partial<DataTableProps<Item>> = {}) {
  return renderToStaticMarkup(
    <DataTable<Item>
      columns={columns}
      data={items}
      total={items.length}
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

const tbody = (html: string) => html.match(/<tbody[^>]*>/)?.[0] ?? ''

describe('DataTable stripes', () => {
  it('draws no zebra by default', () => {
    const body = tbody(render())
    expect(body).toContain('[&amp;_tr:nth-child(even)]:bg-transparent')
    expect(body).not.toContain('bg-muted/40')
  })

  it('striped brings them back, on pinned cells too', () => {
    const html = render({ striped: true, pinFirstColumn: true })
    expect(tbody(html)).toContain('[&amp;_tr:nth-child(even)]:bg-muted/40')
    expect(html).toContain('bg-(--table-stripe)')
  })
})

describe('DataTable hover', () => {
  it('lights every body row, and a highlighted row keeps its own look', () => {
    const rows = [...render({ highlightRow: (row) => row.id === 2 }).matchAll(/<tr[^>]*data-slot="table-row"[^>]*>/g)].map(
      ([tag]) => tag,
    )
    // The header row, then the two body rows.
    expect(rows[1]).toContain('hover:[&amp;&gt;td]:bg-(--table-hover)')
    expect(rows[2]).toContain('data-highlighted')
    expect(rows[2]).not.toContain('--table-hover')
  })

  it('the hand cursor only on rows that open', () => {
    expect(render()).not.toContain('cursor-pointer')
    expect(render({ opens: { kind: 'rows' } })).not.toContain('cursor-pointer')
    expect(render({ onRowClick: noop })).toContain('cursor-pointer')
  })
})

describe('DataTable width', () => {
  it('is content by default, the toolbar outside the part that fits', () => {
    const html = render({ toolbar: <div data-testid="toolbar" /> })
    expect(html).toContain('data-width="content"')
    expect(html.indexOf('data-testid="toolbar"')).toBeLessThan(html.indexOf('data-slot="data-table-body"'))
    expect(html.match(/<div[^>]*data-slot="data-table-body"[^>]*>/)?.[0]).toContain('w-fit')
  })

  it('full keeps the whole width', () => {
    const html = render({ width: 'full' })
    expect(html).toContain('data-width="full"')
    expect(html.match(/<div[^>]*data-slot="data-table-body"[^>]*>/)?.[0]).not.toContain('w-fit')
  })
})

describe('DataTable meta.clip and maxWidth', () => {
  it('cuts a clip column to one line at 24rem unless set', () => {
    const html = render()
    expect(html).toMatch(/data-slot="data-table-clip"[^>]*style="max-width:min\(24rem, 60cqw\)"/)
    const narrow = renderToStaticMarkup(
      <DataTable<Item>
        columns={[{ id: 'notes', header: 'Notes', meta: { clip: true, maxWidth: '12rem' }, cell: ({ row }) => row.original.notes }]}
        data={items}
        total={2}
        page={1}
        pageSize={50}
        onPageChange={noop}
        sorting={[]}
        onSortingChange={noop}
        isLoading={false}
        emptyTitle="Nothing yet"
      />,
    )
    expect(narrow).toMatch(/data-slot="data-table-clip"[^>]*style="max-width:min\(12rem, 60cqw\)"/)
  })

  it('maxWidth alone wraps at that width', () => {
    const html = renderToStaticMarkup(
      <DataTable<Item>
        columns={[{ id: 'notes', header: 'Notes', meta: { maxWidth: '16rem' }, cell: ({ row }) => row.original.notes }]}
        data={items}
        total={2}
        page={1}
        pageSize={50}
        onPageChange={noop}
        sorting={[]}
        onSortingChange={noop}
        isLoading={false}
        emptyTitle="Nothing yet"
      />,
    )
    expect(html).toContain('whitespace-normal')
    expect(html).toContain('max-width:16rem')
    expect(html).not.toContain('data-table-clip')
  })
})

describe('DataTable rows per page', () => {
  it('a menu in the bar with pageSizes and onPageSizeChange, none without', () => {
    expect(render({ pageSizes: [25, 50, 100], onPageSizeChange: noop })).toContain('aria-label="50 rows per page"')
    expect(render({ pageSizes: [25, 50, 100] })).not.toContain('data-table-page-size')
    expect(render()).not.toContain('data-table-page-size')
  })
})

describe('resolvePageSize', () => {
  const SIZES = [25, 50, 100]
  it("takes the URL's size, then the remembered one, then the default", () => {
    expect(resolvePageSize(SIZES, '100', '25', 50)).toBe(100)
    expect(resolvePageSize(SIZES, null, '25', 50)).toBe(25)
    expect(resolvePageSize(SIZES, null, null, 50)).toBe(50)
  })

  it('skips a size that is not one of the choices', () => {
    expect(resolvePageSize(SIZES, '100000', '7', 50)).toBe(50)
    expect(resolvePageSize(SIZES, 'abc', '100', 50)).toBe(100)
  })
})
