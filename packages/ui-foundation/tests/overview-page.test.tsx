// The overview standard's page and card anatomy (O1, O4), by markup: what
// a tile and a WidgetCard draw for a part's data and states. Opening a
// tile, Escape and the phone's accordion are clicked in
// e2e/overview-page.spec.ts. Rendered on the server, so the page is wide.
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { OverviewPage, type OverviewPart } from '../src/components/app/overview-page'
import { WidgetCard } from '../src/components/app/widget-card'

const render = (node: ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)
const NOW = new Date('2026-11-11T12:00:00')

const part = (over: Partial<OverviewPart> = {}): OverviewPart => ({
  id: 'savings',
  title: 'Savings',
  to: '/accounts',
  value: '$24,800',
  line: '+$1,120 since August',
  freshness: { label: 'Balances entered', at: '2026-08-02', staleAfter: '2026-11-01', now: NOW },
  detail: <p>Two accounts</p>,
  ...over,
})

describe('OverviewPage', () => {
  it('draws the title as the h1, Needs you, and a tile per part, all closed', () => {
    const html = render(
      <OverviewPage title="Household" needs={[{ text: '2 deals at their target', to: '/deals' }]} parts={[part(), part({ id: 'deals', title: 'Deals', value: '2 now' })]} />,
    )
    expect(html).toMatch(/<h1[^>]*>Household<\/h1>/)
    expect(html).toContain('2 deals at their target')
    expect(html.match(/data-slot="overview-tile"/g)).toHaveLength(2)
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(2)
    expect(html).toContain('$24,800')
    expect(html).toContain('data-state="stale"')
    expect(html).not.toContain('Two accounts')
  })

  it('draws no Needs you when nothing waits', () => {
    expect(render(<OverviewPage title="Household" parts={[part()]} />)).not.toContain('needs-you')
  })

  it('opens the part named by defaultOpen below the grid, its title a link to `to`', () => {
    const html = render(<OverviewPage title="Household" parts={[part()]} defaultOpen="savings" />)
    expect(html).toContain('aria-expanded="true"')
    const detail = html.slice(html.indexOf('data-slot="overview-detail"'))
    expect(detail).toContain('href="/accounts"')
    expect(detail).toContain('Two accounts')
    expect(detail).toContain('+$1,120 since August')
    // The tile controls the detail.
    const controls = /aria-controls="([^"]+)"/.exec(html)![1]
    expect(html).toContain(`id="${controls}" data-slot="overview-detail"`)
  })

  it('says each state in the tile: loading, an error, nothing yet', () => {
    const html = render(
      <OverviewPage
        title="Household"
        parts={[
          part({ id: 'a', isLoading: true }),
          part({ id: 'b', error: { kind: 'network', message: 'Down' } }),
          part({ id: 'c', empty: { action: { label: 'Add the first line', to: '/new' } } }),
        ]}
      />,
    )
    expect(html).toContain('data-state="loading"')
    expect(html).toContain("Couldn&#x27;t load")
    expect(html).toContain('Nothing yet')
    expect(html).not.toContain('$24,800')
  })

  it("draws an empty part's detail as PartEmpty with its one way to start", () => {
    const html = render(
      <OverviewPage title="Household" defaultOpen="c" parts={[part({ id: 'c', empty: { action: { label: 'Add the first line', to: '/new' } } })]} />,
    )
    expect(html).toContain('data-slot="part-empty"')
    expect(html).toContain('Add the first line')
  })
})

describe('WidgetCard anatomy', () => {
  it('makes the title a link with a chevron, then value, line and freshness', () => {
    const html = render(
      <WidgetCard title="Deals" to="/deals" value="2 now" line="at their target" freshness={{ label: 'Prices checked', at: '2026-11-11', now: NOW }} isLoading={false} isEmpty={false} emptyMessage="None" />,
    )
    expect(html).toMatch(/<h2[^>]*><a[^>]*href="\/deals"[^>]*>.*Deals.*<svg/)
    expect(html).toContain('data-slot="widget-card-value"')
    expect(html).toContain('at their target')
    expect(html).toContain('Prices checked')
  })

  it('shows its value as the folded summary', () => {
    const html = render(<WidgetCard title="Deals" value="2 now" collapsible defaultCollapsed isLoading={false} isEmpty={false} emptyMessage="None" />)
    expect(html).toContain('data-slot="widget-card-summary"')
  })

  it('is drawn as before without the anatomy', () => {
    const html = render(
      <WidgetCard title="Deals" isLoading={false} isEmpty={false} emptyMessage="None">
        <p>Rows</p>
      </WidgetCard>,
    )
    expect(html).not.toContain('widget-card-anatomy')
    expect(html).not.toContain('widget-card-title-link')
  })
})
