// DataTable's framed look (`look="framed"`, 4.100) and ListHeader's
// sibling-list switch (`siblings`), as markup: the card and its two bars,
// the tools ending at the table's edge (the card takes `width`'s fit, not
// the toolbar row), one settings button in place of Columns and Group,
// views above the card, and the plain look unchanged. The menu's contents,
// the phone and the widths in a browser are e2e/data-table-framed.spec.ts's.
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DataTable, type DataTableProps } from '../src/components/app/data-table'
import { ListHeader, type ListHeaderProps } from '../src/components/app/list-header'

type Item = { id: number; name: string; status: string }

const columns: LegacyColumnDef<Item, unknown>[] = [
  { id: 'name', header: 'Name', cell: ({ row }) => row.original.name },
  { id: 'status', header: 'Status', cell: ({ row }) => row.original.status },
]

const items: Item[] = [
  { id: 1, name: 'Fern', status: 'Thriving' },
  { id: 2, name: 'Basil', status: 'Resting' },
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
      toolbar={<input aria-label="Search" />}
      {...props}
    />,
  )
}

const tag = (html: string, slot: string, attribute = 'data-slot') =>
  html.match(new RegExp(`<[^>]*${attribute}="${slot}"[^>]*>`))?.[0] ?? ''
const at = (html: string, text: string) => html.indexOf(text)

const GROUPINGS = [
  { id: 'status', label: 'Status', options: [{ value: 'Thriving', label: 'Thriving' }], value: (item: Item) => item.status },
]

describe('DataTable look="framed"', () => {
  it('puts the toolbar, the rows and the pager in one card, in that order', () => {
    const html = render({ look: 'framed' })
    expect(html).toContain('data-look="framed"')
    const frame = tag(html, 'data-table-frame')
    expect(frame).toContain('rounded-lg border')
    const top = at(html, 'data-slot="data-table-top-bar"')
    const search = at(html, 'aria-label="Search"')
    const table = at(html, 'data-slot="table"')
    const pager = at(html, 'data-slot="data-table-pagination"')
    expect(at(html, 'data-slot="data-table-frame"')).toBeLessThan(top)
    expect(top).toBeLessThan(search)
    expect(search).toBeLessThan(table)
    expect(table).toBeLessThan(pager)
    expect(tag(html, 'data-table-pagination')).toContain('border-t')
  })

  it("fits the card, tools and all, to the table (7A): the toolbar can't reach past it", () => {
    const html = render({ look: 'framed' })
    expect(tag(html, 'data-table-frame')).toContain('w-fit')
    // The plain look fits only the body; its toolbar keeps the whole width.
    const plain = render()
    expect(plain).not.toContain('data-table-frame')
    expect(tag(plain, 'data-table-body')).toContain('w-fit')
    // width="full" fills the area, framed or not.
    expect(tag(render({ look: 'framed', width: 'full' }), 'data-table-frame')).not.toContain('w-fit')
  })

  it('folds Columns and Group into one settings button with a name', () => {
    const html = render({
      look: 'framed',
      columnsMenu: { storageKey: 'test:framed:columns' },
      groupings: GROUPINGS,
    })
    expect(tag(html, 'table-settings', 'data-tool')).toContain('aria-label="Table Settings"')
    expect(html).not.toContain('data-slot="data-table-columns-menu"')
    expect(html).not.toContain('data-slot="data-table-group-menu"')
  })

  it("names the grouping that's on, and marks the button, since the bar no longer says it", () => {
    const html = render({ look: 'framed', groupings: GROUPINGS, grouping: 'status', onGroupingChange: noop })
    const button = tag(html, 'table-settings', 'data-tool')
    expect(button).toContain('aria-label="Table Settings, Grouped by Status"')
    expect(button).toContain('data-set="true"')
    // Fold All stays a button of its own in the bar while grouped.
    expect(html).toContain('data-slot="data-table-fold-all"')
  })

  it('has no settings button with nothing to set', () => {
    expect(render({ look: 'framed' })).not.toContain('table-settings')
  })

  it('keeps the saved views above the card, outside its bar', () => {
    const html = render({
      look: 'framed',
      views: { all: { label: 'All' }, resting: { label: 'Resting' } },
      activeView: 'all',
    })
    expect(at(html, 'data-slot="data-table-views"')).toBeGreaterThan(-1)
    expect(at(html, 'data-slot="data-table-views"')).toBeLessThan(at(html, 'data-slot="data-table-frame"'))
  })

  it('draws the empty and error states inside the card, with no pager', () => {
    const empty = render({ look: 'framed', data: [], total: 0 })
    expect(at(empty, 'data-state="empty"')).toBeGreaterThan(at(empty, 'data-slot="data-table-frame"'))
    expect(empty).not.toContain('data-table-pagination')
    const failed = render({ look: 'framed', error: { kind: 'server', message: 'The server had a problem.' } })
    expect(failed).toContain('The server had a problem.')
    expect(failed).toContain('data-table-top-bar')
  })

  it('leaves the plain look as it was: Columns and Group as buttons with words', () => {
    const html = render({ columnsMenu: { storageKey: 'test:plain:columns' }, groupings: GROUPINGS })
    expect(html).toContain('data-slot="data-table-columns-menu"')
    expect(html).toContain('data-slot="data-table-group-menu"')
    expect(html).not.toContain('table-settings')
    expect(html).not.toContain('data-look')
  })

  it('a capped related list in a frame has no pager bar', () => {
    const html = render({ look: 'framed', limit: 1 })
    expect(html).not.toContain('data-table-pagination')
  })
})

function header(props: Partial<ListHeaderProps>, path = '/exercises') {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <ListHeader title="Exercises" count={5} newAction={{ label: 'New exercise', to: '/exercises/new' }} {...props} />
    </MemoryRouter>,
  )
}

const SIBLINGS = [
  { label: 'Exercises', to: '/exercises', count: 5 },
  { label: 'Targets', to: '/targets', count: 9 },
  { label: 'Weak spots', to: '/weak-spots', count: 4 },
]

describe('ListHeader siblings (7F)', () => {
  it('draws a named nav of links beside the title, the current one marked', () => {
    const html = header({ siblings: SIBLINGS })
    expect(html).toContain('<nav aria-label="Exercises Lists"')
    expect(html).toMatch(/aria-current="page"[^>]*href="\/exercises"|href="\/exercises"[^>]*aria-current="page"/)
    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    // The count follows the label, read as "Targets, 9".
    expect(html).toContain('Targets<span class="tabular-nums"><span class="sr-only">, </span>9</span>')
    // Between the title and the actions.
    expect(at(html, '<h1')).toBeLessThan(at(html, '<nav'))
    expect(at(html, '<nav')).toBeLessThan(at(html, 'New exercise'))
  })

  it("takes `current` over the path, for siblings told apart by the query", () => {
    const html = header({
      siblings: [
        { label: 'Open', to: '/tasks?state=open', current: false },
        { label: 'Done', to: '/tasks?state=done', current: true },
      ],
      siblingsLabel: 'Task lists',
    })
    expect(html).toContain('aria-label="Task lists"')
    expect(html).toMatch(/href="\/tasks\?state=done"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/tasks\?state=done"/)
    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
  })

  it('draws nothing for one sibling or none', () => {
    expect(header({ siblings: SIBLINGS.slice(0, 1) })).not.toContain('<nav')
    expect(header({})).not.toContain('<nav')
  })

  it('keeps ⋯ for what is left (Show deleted) beside the switch', () => {
    const html = header({ siblings: SIBLINGS, deleted: { shown: false, onShownChange: noop } })
    expect(html).toContain('aria-label="More for Exercises"')
  })
})
