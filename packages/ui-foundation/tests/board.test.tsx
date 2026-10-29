// Board's columns, cards and states, rendered to markup. Dragging and the
// Move menu are e2e/board.spec.ts's.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Board, type BoardProps } from '../src/components/app/board'

type Item = { id: number; name: string; stage: 'a' | 'b' | 'gone' }
const ITEMS: Item[] = [
  { id: 1, name: 'One', stage: 'a' },
  { id: 2, name: 'Two', stage: 'b' },
  { id: 3, name: 'Three', stage: 'gone' },
]

const props = (over: Partial<BoardProps<Item, Item['stage']>> = {}): BoardProps<Item, Item['stage']> => ({
  'aria-label': 'Items',
  columns: [
    { value: 'a', label: 'A', empty: 'No A' },
    { value: 'b', label: 'B', count: 40, footer: 'Showing 1 of 40' },
  ],
  items: ITEMS,
  getId: (item) => item.id,
  getColumn: (item) => item.stage,
  getName: (item) => item.name,
  renderCard: (item) => <span>{item.name}</span>,
  onMove: () => {},
  ...over,
})

const render = (p: BoardProps<Item, Item['stage']>) => renderToStaticMarkup(<Board {...p} />)

describe('Board', () => {
  it('puts each card in its value’s column and leaves out a value with no column', () => {
    const html = render(props())
    const [, a, b] = html.split('data-slot="board-column"')
    expect(a).toContain('One')
    expect(a).not.toContain('Two')
    expect(b).toContain('Two')
    expect(html).not.toContain('Three')
  })

  it('counts a column’s cards, or shows its own count, and its footer', () => {
    const html = render(props({ items: [ITEMS[1]] }))
    expect(html).toMatch(/>A<span[^>]*>0</)
    expect(html).toMatch(/>B<span[^>]*>40</)
    expect(html).toContain('Showing 1 of 40')
    expect(html).toContain('No A')
  })

  it('makes cards draggable with a Move button only when it can move them', () => {
    expect(render(props())).toContain('draggable="true"')
    expect(render(props())).toContain('aria-label="Move One"')
    const readOnly = render(props({ onMove: undefined }))
    expect(readOnly).not.toContain('draggable="true"')
    expect(readOnly).not.toContain('Move One')
  })

  it('heads its columns at h2, or at the level it is given', () => {
    expect(render(props())).toMatch(/<h2[^>]*>A</)
    const nested = render(props({ headingLevel: 3 }))
    expect(nested).toMatch(/<h3[^>]*>A</)
    expect(nested).not.toContain('<h2')
  })

  it('has an empty status line for what a move announces', () => {
    expect(render(props())).toMatch(/<span role="status" class="sr-only"><\/span>/)
  })

  it('has a loading, an empty and an error state for the whole board', () => {
    expect(render(props({ isLoading: true }))).toContain('data-state="loading"')
    const empty = render(props({ items: [ITEMS[2]], emptyTitle: 'No items yet' }))
    expect(empty).toContain('data-state="empty"')
    expect(empty).toContain('No items yet')
    const failed = render(props({ error: { kind: 'network', message: 'Offline' }, onRetry: () => {} }))
    expect(failed).toContain('data-state="error"')
    expect(failed).toContain('Try again')
  })
})
