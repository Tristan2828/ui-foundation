// DataTable's groupings (the Group menu) and detail panel, as markup: None
// by default, the groups' order and headings, a multi-value row under each
// of its values, the grouped column hidden, and the panel's rows marked.
// Picking, folding and the keys are e2e/data-table-grouping.spec.ts's.
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DataTable, type DataTableGrouping, type DataTableProps } from '../src/components/app/data-table'
import { groupByValues } from '../src/components/app/table-groups'

type Chore = { id: number; title: string; status: string; areas: string[] }

const columns: LegacyColumnDef<Chore, unknown>[] = [
  { id: 'title', header: 'Chore', cell: ({ row }) => row.original.title },
  { id: 'status', header: 'Status', cell: ({ row }) => `status:${row.original.status}` },
  { id: 'areas', header: 'Area', cell: ({ row }) => row.original.areas.join(', ') },
]
const chores: Chore[] = [
  { id: 1, title: 'Kettle', status: 'todo', areas: ['kitchen'] },
  { id: 2, title: 'Leaves', status: 'doing', areas: ['garden'] },
  { id: 3, title: 'Bins', status: 'todo', areas: ['garage', 'garden'] },
  { id: 4, title: 'Keys', status: 'done', areas: [] },
]
const groupings: DataTableGrouping<Chore>[] = [
  {
    id: 'status',
    label: 'Status',
    options: [
      { value: 'todo', label: 'To do' },
      { value: 'doing', label: 'Doing' },
      { value: 'done', label: 'Done' },
    ],
    value: (chore) => chore.status,
  },
  {
    id: 'areas',
    label: 'Area',
    options: [
      { value: 'kitchen', label: 'Kitchen' },
      { value: 'garden', label: 'Garden' },
      { value: 'garage', label: 'Garage' },
    ],
    value: (chore) => chore.areas,
    emptyLabel: 'No area',
  },
]
const noop = () => {}

function render(props: Partial<DataTableProps<Chore>> = {}) {
  return renderToStaticMarkup(
    <DataTable<Chore>
      columns={columns}
      data={chores}
      total={chores.length}
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

// Each heading's label, count and summary, in order.
const headings = (html: string) =>
  [...html.matchAll(/<button type="button" aria-expanded="true"[^>]*>.*?<span class="type-label[^"]*">([^<]+)<\/span><span[^>]*>(\d+)<\/span><\/button>(?:<span[^>]*>([^<]*)<\/span>)?/g)].map(
    ([, label, count, summary]) => [label, Number(count), summary].filter((part) => part !== undefined).join(' '),
  )
const titles = (html: string) => [...html.matchAll(/<td[^>]*>(Kettle|Leaves|Bins|Keys)<\/td>/g)].map(([, title]) => title)

describe('groupByValues', () => {
  const valueOf = (chore: Chore) => chore.areas
  const options = groupings[1].options

  it("orders groups by the options, an unknown value after them, and no value last", () => {
    const runs = groupByValues([...chores, { id: 5, title: 'Shed', status: 'todo', areas: ['shed'] }], valueOf, options, 'No area')
    expect(runs.map((run) => `${run.label}:${run.rows.map((row) => row.title).join('+')}`)).toEqual([
      'Kitchen:Kettle',
      'Garden:Leaves+Bins',
      'Garage:Bins',
      'shed:Shed',
      'No area:Keys',
    ])
  })

  it('puts a row under each of its values once, and an empty string counts as none', () => {
    const runs = groupByValues(
      [{ id: 9, title: 'Twice', status: 'todo', areas: ['garden', 'garden', ''] }, { id: 10, title: 'Blank', status: 'todo', areas: [''] }],
      valueOf,
      options,
      'No area',
    )
    expect(runs.map((run) => [run.label, run.rows.length])).toEqual([
      ['Garden', 1],
      ['No area', 1],
    ])
  })

  it('takes a single value, and null or undefined as none', () => {
    const runs = groupByValues(chores, (chore) => (chore.id === 4 ? null : chore.status), groupings[0].options, 'Not set')
    expect(runs.map((run) => run.label)).toEqual(['To do', 'Doing', 'Not set'])
  })
})

describe('DataTable groupings', () => {
  it('without groupings, no menu and the table as it was', () => {
    const html = render()
    expect(html).not.toContain('data-table-group-menu')
    expect(html).not.toContain('table-group')
  })

  it('None is the default: a menu, every column, no headings, no Fold all', () => {
    const html = render({ groupings })
    expect(html).toContain('data-slot="data-table-group-menu"')
    expect(html).toMatch(/data-table-group-menu[^>]*>.*?Group<\/button>/)
    expect(html).not.toContain('data-table-fold-all')
    expect(html).not.toContain('table-group-heading')
    expect(html).toContain('status:todo')
    expect(titles(html)).toEqual(['Kettle', 'Leaves', 'Bins', 'Keys'])
  })

  it("an id the table doesn't have is None", () => {
    expect(render({ groupings, grouping: 'colour' })).not.toContain('table-group-heading')
  })

  it("groups in the options' order with counts and summaries, and hides the grouped column", () => {
    const html = render({ groupings, grouping: 'status', groupSummary: (rows, group) => `${group.key}:${rows.length}` })
    expect(headings(html)).toEqual(['To do 2 todo:2', 'Doing 1 doing:1', 'Done 1 done:1'])
    expect(titles(html)).toEqual(['Kettle', 'Bins', 'Leaves', 'Keys'])
    expect(html).not.toContain('status:todo')
    expect(html).not.toMatch(/<th[^>]*>Status<\/th>/)
    expect(html).toContain('>Area<')
    expect(html).toMatch(/data-table-group-menu[^>]*>.*?Group: Status<\/button>/)
    expect(html).toContain('data-slot="data-table-fold-all"')
    expect(html).toContain('>Fold all<')
  })

  it('shows a multi-value row under each of its values, and one with none last', () => {
    const html = render({ groupings, grouping: 'areas' })
    expect(headings(html)).toEqual(['Kitchen 1', 'Garden 2', 'Garage 1', 'No area 1'])
    expect(titles(html)).toEqual(['Kettle', 'Leaves', 'Bins', 'Bins', 'Keys'])
  })

  it('takes the place of groupBy while on', () => {
    const groupBy = () => ({ key: 'all', label: 'Everything' })
    expect(render({ groupings, groupBy })).toContain('Everything')
    expect(render({ groupings, groupBy, grouping: 'status' })).not.toContain('Everything')
  })

  it("keeps groupBy's headings as they were: no button, no count", () => {
    const html = render({ groupBy: (chore) => ({ key: chore.status, label: chore.status }), groupSummary: (rows) => `${rows.length} chores` })
    expect(html).not.toContain('aria-expanded="')
    expect(html).toContain('<span class="type-label text-foreground">todo</span><span class="type-caption text-muted-foreground tabular-nums">1 chores</span>')
  })
})

describe('DataTable detailPanel', () => {
  it('without it, rows take no selection, tab stop or key', () => {
    const html = render()
    expect(html).not.toContain('aria-selected')
    expect(html).not.toContain('data-row-key')
    expect(html).not.toMatch(/<tr[^>]*tabindex/)
  })

  it('with it, every row is one place in the list, nothing picked, the first the tab stop', () => {
    const html = render({ detailPanel: (chore) => <p>panel {chore.title}</p> })
    expect(html.match(/aria-selected="false"/g)).toHaveLength(4)
    expect(html.match(/<tr[^>]*tabindex="0"/g)).toHaveLength(1)
    expect(html).toMatch(/data-row-key="1"[^>]*tabindex="0"/)
    expect(html).not.toContain('panel ')
    expect(html).not.toContain('data-table-detail"')
  })

  it("under a multi-value grouping a row's two places have their own keys", () => {
    const html = render({ groupings, grouping: 'areas', detailPanel: () => null })
    expect([...html.matchAll(/data-row-key="([^"]+)"/g)].map(([, key]) => key)).toEqual([
      'kitchen:1',
      'garden:2',
      'garden:3',
      'garage:3',
      ':4',
    ])
  })
})
