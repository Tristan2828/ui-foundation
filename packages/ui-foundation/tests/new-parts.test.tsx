// The page standards' small parts: what each draws for the data it's given,
// by markup. Their looks (the narrow timeline, the tooltip) are measured in
// the fixtures' checks (e2e/fixtures-visual.spec.ts).
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { Freshness } from '../src/components/app/freshness'
import { isStale } from '../src/lib/freshness'
import { ListHeader } from '../src/components/app/list-header'
import { NeedsYou } from '../src/components/app/needs-you'
import { PartEmpty } from '../src/components/app/part-empty'
import { Timeline, type TimelineItem } from '../src/components/app/timeline'
import { ValueList } from '../src/components/app/value-list'
import { WidgetCard } from '../src/components/app/widget-card'

const render = (node: ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)
const items = (labels: string[]) => labels.map((label) => ({ label }))

describe('ValueList', () => {
  it('shows every value up to max, with no +N', () => {
    const html = render(<ValueList items={items(['Back', 'Neck'])} />)
    expect(html).toContain('>Back<')
    expect(html).toContain('>Neck<')
    expect(html).not.toContain('value-list-more')
  })

  it('folds the rest into +N, named for a screen reader', () => {
    const html = render(<ValueList items={items(['Back', 'Neck', 'General', 'Sleep'])} />)
    expect(html).toContain('>Back<')
    expect(html).not.toContain('>General<')
    expect(html).toContain('aria-label="2 more: General, Sleep"')
    expect(html).toContain('+2')
  })

  it("takes max, and the app's own node in place of the chip", () => {
    const html = render(
      <ValueList max={1} items={[{ label: 'Home', node: <svg data-mark="home" /> }, { label: 'Garden' }]} />,
    )
    expect(html).toContain('data-mark="home"')
    expect(html).toContain('aria-label="1 more: Garden"')
  })

  it('says None to a screen reader, and shows a dash, when empty', () => {
    const html = render(<ValueList items={[]} />)
    expect(html).toContain('data-state="empty"')
    expect(html).toContain('>None<')
    expect(html).toContain('>—<')
  })
})

describe('Timeline', () => {
  const entries = (n: number): TimelineItem[] =>
    Array.from({ length: n }, (_, i) => ({ id: `e${i}`, date: `Nov ${i + 1}`, body: `Entry ${i + 1}` }))

  it('shows the first five of a longer history, with Show All N', () => {
    const html = render(<Timeline label="Changes" items={entries(7)} />)
    expect(html.match(/data-slot="timeline-item"/g)).toHaveLength(5)
    expect(html).toContain('Entry 5')
    expect(html).not.toContain('Entry 6')
    expect(html).toContain('Show All 7')
    expect(html).toContain('aria-expanded="false"')
  })

  it('has no Show All when it all fits, and takes another initial', () => {
    expect(render(<Timeline label="Changes" items={entries(5)} />)).not.toContain('Show All')
    const html = render(<Timeline label="Changes" items={entries(4)} initial={2} />)
    expect(html.match(/data-slot="timeline-item"/g)).toHaveLength(2)
    expect(html).toContain('Show All 4')
  })

  it("names the list, dates the entry for machines, and shows the kind and the entry's control", () => {
    const html = render(
      <Timeline
        label="Changes"
        items={[{ id: 'a', date: 'Nov 2', dateTime: '2026-11-02', kind: 'Visit', body: 'Raised it.', edit: <button>Edit</button> }]}
      />,
    )
    expect(html).toContain('aria-label="Changes"')
    expect(html).toContain('<time dateTime="2026-11-02">Nov 2</time>')
    expect(html).toContain('>Visit<')
    expect(html).toContain('<button>Edit</button>')
  })

  it('says Nothing yet when empty', () => {
    const html = render(<Timeline label="Changes" items={[]} />)
    expect(html).toContain('data-state="empty"')
    expect(html).toContain('Nothing yet')
  })
})

describe('NeedsYou', () => {
  it('draws nothing at all when nothing waits', () => {
    expect(render(<NeedsYou items={[]} />)).toBe('')
  })

  it('is a region named by its heading, each line a link, in the warning tone unless told otherwise', () => {
    const html = render(
      <NeedsYou
        items={[
          { text: 'Balances are old', to: '/accounts' },
          { text: 'A document is overdue', to: '/taxes', tone: 'destructive' },
        ]}
      />,
    )
    expect(html).toMatch(/<section aria-labelledby="[^"]+" data-slot="needs-you"/)
    expect(html).toMatch(/<h2 id="[^"]+"[^>]*>Needs You<\/h2>/)
    expect(html).toContain('href="/accounts"')
    expect(html).toContain('href="/taxes"')
    expect(html).toContain('data-tone="warning"')
    expect(html).toContain('data-tone="destructive"')
  })
})

describe('Freshness', () => {
  const NOW = new Date(2026, 10, 11)

  it('says what and when, quietly, while it is fresh', () => {
    const html = render(<Freshness label="Prices checked" at="2026-11-10" staleAfter="2026-12-10" now={NOW} />)
    expect(html).toContain('data-state="fresh"')
    expect(html).toContain('text-muted-foreground')
    expect(html).toContain('<time dateTime="2026-11-10">Nov 10</time>')
    expect(html).not.toContain('out of date')
  })

  it('turns to the warning tone, with its icon, once staleAfter has passed', () => {
    const html = render(<Freshness label="Balances entered" at="2026-08-02" staleAfter="2026-11-02" now={NOW} />)
    expect(html).toContain('data-state="stale"')
    expect(html).toContain('text-warning-text')
    expect(html).toContain('<svg')
    expect(html).toContain('>Aug 2<')
    expect(html).toContain(', out of date')
  })

  it('adds the year to a date before this one', () => {
    const html = render(<Freshness label="Balances entered" at="2025-03-04" now={NOW} />)
    expect(html).toContain('>Mar 4, 2025<')
  })

  it('says never when there is no date, and is never in the warning tone', () => {
    const html = render(<Freshness label="Prices checked" at={null} staleAfter="2000-01-01" now={NOW} />)
    expect(html).toContain('data-state="never"')
    expect(html).toContain('Prices checked: never')
  })

  it('isStale: before now is stale, after it is not, and a missing or unreadable limit never is', () => {
    expect(isStale('2026-11-10', NOW)).toBe(true)
    expect(isStale(new Date(2026, 10, 12), NOW)).toBe(false)
    expect(isStale(undefined, NOW)).toBe(false)
    expect(isStale('soon', NOW)).toBe(false)
  })
})

describe('ListHeader', () => {
  it('is the title with its count and New alone, with no menu when it has nothing to hold', () => {
    const html = render(<ListHeader title="Reminders" count={12} newAction={{ label: 'New reminder', to: '/reminders/new' }} />)
    expect(html).toContain('Reminders')
    expect(html).toContain('>12<')
    expect(html).toContain('href="/reminders/new"')
    expect(html).not.toContain('list-header-more')
  })

  it('keeps one related link out as a button, and Show Deleted in a menu', () => {
    const html = render(
      <ListHeader
        title="Medications"
        links={[{ label: 'Change log', to: '/medications/changes' }]}
        deleted={{ shown: false, onShownChange: () => {} }}
      />,
    )
    expect(html).toContain('href="/medications/changes"')
    expect(html).toContain('data-slot="list-header-more"')
    expect(html).toContain('aria-label="More for Medications"')
  })

  it('folds two or more links into the menu (closed here), leaving no link out', () => {
    const html = render(
      <ListHeader
        title="Tasks"
        links={[
          { label: 'Board', to: '/tasks/board' },
          { label: 'Spin', to: '/tasks/spin' },
        ]}
      />,
    )
    expect(html).not.toContain('href="/tasks/board"')
    expect(html).toContain('data-slot="list-header-more"')
  })

  it('keeps an empty status region, and fills it with the notice while deleted records show', () => {
    const off = render(<ListHeader title="Tasks" deleted={{ shown: false, onShownChange: () => {} }} />)
    expect(off).toMatch(/<div role="status"[^>]*><\/div>/)
    const on = render(<ListHeader title="Tasks" deleted={{ shown: true, onShownChange: () => {}, noun: 'tasks' }} />)
    expect(on).toContain('Showing deleted tasks.')
    expect(on).toContain('Back to the List')
  })
})

describe('PartEmpty and WidgetCard empty', () => {
  it('says Nothing here yet with one button, a link or a function', () => {
    const link = render(<PartEmpty action={{ label: 'Add the first line', to: '/budget/new' }} />)
    expect(link).toContain('Nothing here yet')
    expect(link).toContain('href="/budget/new"')
    expect(link).toContain('Add the first line')
    const plain = render(<PartEmpty text="No deals" action={{ label: 'Add one', onClick: () => {} }} />)
    expect(plain).toContain('No deals')
    expect(plain).toContain('<button')
  })

  it('has no button without an action', () => {
    expect(render(<PartEmpty />)).not.toContain('<button')
  })

  it("draws a WidgetCard's empty in place of its emptyMessage, only when it is empty", () => {
    const base = {
      title: 'Budget',
      isLoading: false,
      emptyMessage: 'Not set up',
      empty: { action: { label: 'Add the first line', to: '/b' } },
    }
    const empty = render(<WidgetCard {...base} isEmpty />)
    expect(empty).toContain('data-slot="part-empty"')
    expect(empty).toContain('Add the first line')
    expect(empty).not.toContain('Not set up')
    const full = render(
      <WidgetCard {...base} isEmpty={false}>
        rows
      </WidgetCard>,
    )
    expect(full).not.toContain('part-empty')
    expect(render(<WidgetCard {...base} empty={undefined} isEmpty />)).toContain('Not set up')
  })
})
