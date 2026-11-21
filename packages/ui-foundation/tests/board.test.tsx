// Board's columns, cards and states, rendered to markup. Dragging and the
// Move menu are e2e/board.spec.ts's.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Board, type BoardProps } from '../src/components/app/board'
import { dropPlace, endPlace, moreCount, neighboursOf, orderTargets, placeNumber, shownCount } from '../src/components/app/board-order'

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
    expect(failed).toContain('Try Again')
  })
})

describe('Board with none of the 4.131 props', () => {
  // The markup of a board given none of the order, group or header props, but for React's generated ids.
  const markup = (p: BoardProps<Item, Item['stage']>) => render(p).replace(/_R_[A-Za-z0-9]+_/g, '«id»')
  it('renders the same markup as 4.130 did', () => {
    expect(markup(props())).toMatchSnapshot()
    expect(markup(props({ onMove: undefined, headingLevel: 3 }))).toMatchSnapshot()
  })
})

describe('Board’s order helpers', () => {
  const ids = [1, 2, 3, 4]
  it('places a drop before or after a card, and in a gap', () => {
    expect(dropPlace(ids, 0, 9)).toEqual({ beforeId: 1, afterId: null })
    expect(dropPlace(ids, 2, 9)).toEqual({ beforeId: 3, afterId: 2 })
    expect(dropPlace(ids, 4, 9)).toEqual({ beforeId: null, afterId: 4 })
  })
  it('after the last shown card, lands before the first hidden one', () => {
    // Shown: 1, 2 (a page of two); the drop is after 2, so before 3.
    expect(dropPlace(ids, 2, 9)).toEqual({ beforeId: 3, afterId: 2 })
  })
  it('lands at a folded group’s end', () => {
    expect(dropPlace(ids, ids.length, 9)).toEqual({ beforeId: null, afterId: 4 })
    expect(endPlace(ids, 9)).toEqual({ beforeId: null, afterId: 4 })
    expect(endPlace(ids, 4)).toEqual({ beforeId: null, afterId: 3 })
    expect(endPlace([], 9)).toEqual({ beforeId: null, afterId: null })
  })
  it('reports nothing for a drop that leaves the card where it is', () => {
    expect(dropPlace(ids, 1, 2)).toBeNull()
    expect(dropPlace(ids, 2, 2)).toBeNull()
    expect(dropPlace(ids, 4, 4)).toBeNull()
    expect(dropPlace(ids, 3, 2)).toEqual({ beforeId: 4, afterId: 3 })
    expect(dropPlace(['1', '2'], 1, 1)).toBeNull()
  })
  it('works out each Order item’s target, and when it can’t apply', () => {
    expect(orderTargets(ids, 3)).toEqual({
      up: { beforeId: 2, afterId: 1 },
      down: { beforeId: null, afterId: 4 },
      top: { beforeId: 1, afterId: null },
    })
    expect(orderTargets(ids, 2).up).toEqual({ beforeId: 1, afterId: null })
    expect(orderTargets(ids, 1)).toEqual({ up: undefined, down: { beforeId: 3, afterId: 2 }, top: undefined })
    expect(orderTargets(ids, 4).down).toBeUndefined()
    expect(orderTargets([7], 7)).toEqual({ up: undefined, down: undefined, top: undefined })
  })
  it('numbers a card’s new place, and finds its neighbours', () => {
    expect(placeNumber(ids, 4, { beforeId: 1, afterId: null })).toEqual({ k: 1, n: 4 })
    expect(placeNumber(ids, 1, { beforeId: null, afterId: 4 })).toEqual({ k: 4, n: 4 })
    expect(neighboursOf(ids, 2)).toEqual({ beforeId: 3, afterId: 1 })
    expect(neighboursOf(ids, 9)).toBeNull()
  })
  it('counts a page and Show N More', () => {
    expect(shownCount(5, 3, 1)).toBe(3)
    expect(moreCount(5, 3, 1)).toBe(2)
    expect(moreCount(8, 3, 1)).toBe(3)
    expect(shownCount(5, 3, 2)).toBe(5)
    expect(moreCount(5, 3, 2)).toBe(0)
    expect(shownCount(5, undefined, 1)).toBe(5)
  })
})

describe('Board’s 4.131 props', () => {
  type Grouped = Item & { size: 'quick' | 'big' }
  const GROUPED: Grouped[] = [
    { id: 1, name: 'One', stage: 'a', size: 'quick' },
    { id: 2, name: 'Two', stage: 'a', size: 'big' },
    { id: 4, name: 'Four', stage: 'a', size: 'quick' },
    { id: 5, name: 'Five', stage: 'a', size: 'quick' },
  ]
  const grouped = (over: Partial<BoardProps<Grouped, Item['stage'], Grouped['size']>> = {}) =>
    renderToStaticMarkup(
      <Board<Grouped, Item['stage'], Grouped['size']>
        aria-label="Items"
        columns={[
          {
            value: 'a',
            label: 'A',
            groups: [
              { value: 'quick', label: 'Quick' },
              { value: 'big', label: 'Big', defaultOpen: false },
            ],
          },
          { value: 'b', label: 'B', description: 'Caption', note: '2 waiting', lead: true },
        ]}
        items={GROUPED}
        getId={(item) => item.id}
        getColumn={(item) => item.stage}
        getGroup={(item) => item.size}
        getName={(item) => item.name}
        renderCard={(item) => <span>{item.name}</span>}
        onMove={() => {}}
        ordered
        pageSize={2}
        {...over}
      />,
    )

  it('heads a group one level under its column, with its count, folded or open', () => {
    const html = grouped()
    expect(html).toMatch(/<h3[^>]*><button[^>]*aria-expanded="true"[^>]*>.*Quick <span[^>]*>3</)
    expect(html).toMatch(/aria-expanded="false"[^>]*>.*Big <span[^>]*>1</)
    expect(html).not.toContain('Two')
    expect(grouped({ headingLevel: 3 })).toMatch(/<h4[^>]*><button/)
  })

  it('counts a column by its groups, and pages each group', () => {
    const html = grouped()
    expect(html).toMatch(/>A<span[^>]*>4</)
    expect(html).toContain('Show 1 More')
    expect(html).toContain('One')
    expect(html).not.toContain('Five')
  })

  it('draws the slots: a caption, a note, the lead outline', () => {
    const html = grouped()
    expect(html).toContain('Caption')
    expect(html).toContain('2 waiting')
    expect(html).toContain('border-2 border-foreground bg-background')
  })

  it('names the menu ⋯ "Actions for" with the app’s items, else "Move"', () => {
    expect(grouped()).toContain('aria-label="Move One"')
    expect(grouped({ menu: () => <span>Copy</span> })).toContain('aria-label="Actions for One"')
  })

  it('adds a row of counts with phone="counts"', () => {
    const html = grouped({ phone: 'counts', columns: [{ value: 'a', label: 'A', shortName: 'Ay' }, { value: 'b', label: 'B' }] })
    expect(html).toContain('aria-label="Items: columns"')
    expect(html).toMatch(/aria-pressed="true"[^>]*><span[^>]*>4<\/span> <span[^>]*>Ay</)
  })
})
