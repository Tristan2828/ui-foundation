import { describe, expect, it } from 'vitest'
import { cellColor, compareCells, isHeaderColumn, rehypeTables, type CellRun } from '../src/lib/markdown-table'

const run = (text: string, color: CellRun['color'] = null, bold = false): CellRun => ({ text, color, bold })

describe('cellColor', () => {
  it('is the colour when every run with words is in one highlight', () => {
    expect(cellColor([run('$4.99', 'green')])).toBe('green')
    expect(cellColor([run(' ', null), run('$4.99', 'green'), run(' ', null)])).toBe('green')
  })
  it('is none for words only partly highlighted, two colours, or an empty cell', () => {
    expect(cellColor([run('Only '), run('partly', 'amber')])).toBeNull()
    expect(cellColor([run('a', 'green'), run('b', 'red')])).toBeNull()
    expect(cellColor([])).toBeNull()
    expect(cellColor([run('  ', 'green')])).toBeNull()
  })
})

describe('isHeaderColumn', () => {
  it('is on when the first cells with words are all bold', () => {
    expect(isHeaderColumn([[run('Rice', null, true)], [run('Oats', null, true)]])).toBe(true)
    expect(isHeaderColumn([[run('Rice', null, true)], []])).toBe(true)
  })
  it('is off when one is not bold, or none has words', () => {
    expect(isHeaderColumn([[run('Rice', null, true)], [run('Oats')]])).toBe(false)
    expect(isHeaderColumn([[], []])).toBe(false)
    expect(isHeaderColumn([])).toBe(false)
  })
})

describe('compareCells', () => {
  it('sorts numbers by value, then words, empty cells last', () => {
    const cells = ['$12.49', '', 'Rice', '$4.99', '$1,299.50', 'apple', '-3 kg']
    expect([...cells].sort(compareCells)).toEqual(['-3 kg', '$4.99', '$12.49', '$1,299.50', 'apple', 'Rice', ''])
  })
})

type El = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: El[] }
const text = (value: string): El => ({ type: 'text', value })
const el = (tagName: string, children: El[], properties: Record<string, unknown> = {}): El => ({ type: 'element', tagName, properties, children })

describe('rehypeTables', () => {
  const tree = () =>
    el('root', [
      el('table', [
        el('thead', [el('tr', [el('th', [text('Item')]), el('th', [text('Price')])])]),
        el('tbody', [
          el('tr', [el('td', [el('strong', [text('Olive oil')])]), el('td', [el('mark', [text('$12.49')], { dataColor: 'green' })])]),
          el('tr', [el('td', [el('strong', [text('Rice')])]), el('td', [text('Only '), el('mark', [text('part')])])]),
        ]),
      ]),
    ])

  it('marks a cell whose whole text is one highlight, and makes bold first cells row headers', () => {
    const root = tree()
    rehypeTables()(root)
    const table = root.children![0]
    const [first, second] = table.children![1].children!
    expect(table.properties?.dataHeaderColumn).toBe('')
    expect(first.children![0].tagName).toBe('th')
    expect(first.children![0].properties?.scope).toBe('row')
    expect(first.children![1].properties?.dataColor).toBe('green')
    expect(second.children![1].properties?.dataColor).toBeUndefined()
  })

  it('leaves the first column alone when a first cell is not bold', () => {
    const root = tree()
    root.children![0].children![1].children![1].children![0] = el('td', [text('Rice')])
    rehypeTables()(root)
    const body = root.children![0].children![1].children!
    expect(root.children![0].properties?.dataHeaderColumn).toBeUndefined()
    expect(body[0].children![0].tagName).toBe('td')
  })
})
