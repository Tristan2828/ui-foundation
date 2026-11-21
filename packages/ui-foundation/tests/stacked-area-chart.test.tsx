// StackedAreaChart's layout and markup. Its shape in a browser and its
// colours are e2e/stacked-area-chart.spec.ts's and fixtures-visual's.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StackedAreaChart, type StackedAreaChartProps } from '../src/components/app/stacked-area-chart'
import { stackedLayout } from '../src/lib/line-chart-layout'

describe('stackedLayout', () => {
  const layout = stackedLayout(['a', 'b', 'c'], [
    [10, 20, 30],
    [5, 5, 10],
  ])
  it('stacks each band on the ones below it, the top edge the total', () => {
    expect(layout.totals).toEqual([15, 25, 40])
    expect(layout.domain).toEqual({ min: 0, max: 44 })
    const at = (y: number) => (44 - y) / 44
    expect(layout.bands[0].bottom).toEqual([at(0), at(0), at(0)])
    expect(layout.bands[0].top).toEqual([at(10), at(20), at(30)])
    expect(layout.bands[1].bottom).toEqual(layout.bands[0].top)
    expect(layout.bands[1].top).toEqual([at(15), at(25), at(40)])
  })
  it('places names evenly, and days by their time', () => {
    expect(layout.across).toEqual([0, 0.5, 1])
    const days = stackedLayout(['2026-01-01', '2026-01-02', '2026-01-05'], [[1, 1, 1]])
    expect(days.across).toEqual([0, 0.25, 1])
  })
  it('puts one x mid-plot', () => {
    expect(stackedLayout(['2026-01-01'], [[3]]).across).toEqual([0.5])
  })
})

const props = (over: Partial<StackedAreaChartProps> = {}): StackedAreaChartProps => ({
  label: 'Holdings',
  xs: ['Jan', 'Feb', 'Mar'],
  series: [
    { label: 'Stocks', values: [60, 70, 75] },
    { label: 'Bonds', values: [30, -5] },
    { label: 'Cash', values: [10, 10, 25], category: 5 },
  ],
  ...over,
})
const render = (p: StackedAreaChartProps) => renderToStaticMarkup(<StackedAreaChart {...p} />)

describe('StackedAreaChart', () => {
  it('shows a named skeleton at its height while loading', () => {
    const html = render(props({ isLoading: true, height: 140 }))
    expect(html).toContain('data-state="loading"')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('Loading Holdings')
    expect(html).toContain('height:140px')
  })

  it('is empty with no xs, no series, or nothing but zeros', () => {
    expect(render(props({ xs: [] }))).toContain('data-state="empty"')
    expect(render(props({ series: [] }))).toContain('data-state="empty"')
    const zeros = render(props({ series: [{ label: 'A', values: [0, 0, 0] }], emptyMessage: 'Nothing held' }))
    expect(zeros).toContain('data-state="empty"')
    expect(zeros).toContain('Nothing held')
  })

  it('draws and tables a missing or negative value as 0', () => {
    const html = render(props())
    expect(html.match(/data-slot="stacked-area-chart-band"/g)).toHaveLength(3)
    // Bonds: 30, then -5 and a missing value, both 0.
    expect(html).toMatch(/<th scope="row">Feb<\/th><td>70<\/td><td>0<\/td><td>10<\/td><td>80<\/td>/)
    expect(html).toMatch(/<th scope="row">Mar<\/th><td>75<\/td><td>0<\/td><td>25<\/td><td>100<\/td>/)
  })

  it('draws one snapshot as a stacked column, with no polygon', () => {
    const html = render(props({ xs: ['Jan'], series: props().series.map((one) => ({ ...one, values: one.values.slice(0, 1) })) }))
    expect(html.match(/data-slot="stacked-area-chart-segment"/g)).toHaveLength(3)
    expect(html).not.toContain('<polygon')
    expect(html).toContain('justify-center')
  })

  it('lists the top band first with its value and share, then the total', () => {
    const legend = render(props()).split('data-slot="stacked-area-chart-legend"')[1].split('</ul>')[0]
    const text = legend.replace(/^[^>]*>/, '').replace(/<[^>]+>/g, '|').split('|').filter(Boolean)
    expect(text).toEqual(['Cash', '25 · 25%', 'Bonds', '0 · 0%', 'Stocks', '75 · 75%', 'Total', '100'])
  })

  it('summarises the total and each band for a screen reader', () => {
    expect(render(props())).toContain(
      '<figcaption class="sr-only">Total from 100 on Jan to 100 on Mar; Stocks 75 (75%); Bonds 0 (0%); Cash 25 (25%)</figcaption>',
    )
    const one = render(props({ xs: ['Jan'], series: [{ label: 'A', values: [4] }] }))
    expect(one).toContain('Total 4 on Jan; A 4 (100%)')
  })

  it('tables a column per band and a Total, a row per x', () => {
    const html = render(props())
    expect(html).toContain('<th scope="col">When</th><th scope="col">Stocks</th><th scope="col">Bonds</th><th scope="col">Cash</th><th scope="col">Total</th>')
    expect(html.match(/<th scope="row">/g)).toHaveLength(3)
  })

  it('gives a band with no category its place + 1', () => {
    const html = render(props())
    expect(html).toContain('text-category-1')
    expect(html).toContain('text-category-2')
    expect(html).toContain('text-category-5')
    expect(html).not.toContain('text-category-3')
  })
})
