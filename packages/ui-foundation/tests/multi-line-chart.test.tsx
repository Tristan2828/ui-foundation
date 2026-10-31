// MultiLineChart (4.51) and LineChart's projection: where several series
// go on one plot (src/lib/line-chart-layout.ts seriesLayout), and what
// each renders for a screen reader. How they look and their contrast are
// e2e/line-chart.spec.ts's and storybook-visual's.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LineChart } from '../src/components/app/line-chart'
import { MultiLineChart } from '../src/components/app/multi-line-chart'
import { seriesLayout } from '../src/lib/line-chart-layout'

const usd = (y: number) => `$${y}`

describe('seriesLayout', () => {
  it('shares one x range: a series that starts later starts further right', () => {
    const layout = seriesLayout([
      [
        { x: '2026-01-01', y: 1 },
        { x: '2026-01-11', y: 2 },
      ],
      [
        { x: '2026-01-06', y: 3 },
        { x: '2026-01-11', y: 4 },
      ],
    ])
    expect(layout.places[0].map((place) => place.x)).toEqual([0, 1])
    expect(layout.places[1].map((place) => place.x)).toEqual([0.5, 1])
  })

  it('shares one y range over every value and the target', () => {
    const layout = seriesLayout([[{ x: 1, y: 10 }, { x: 2, y: 20 }], [{ x: 1, y: 100 }, { x: 2, y: 50 }]], 200)
    expect(layout.domain.min).toBeLessThan(10)
    expect(layout.domain.max).toBeGreaterThan(200)
    expect(layout.places[1][0].y).toBeLessThan(layout.places[0][1].y)
    expect(layout.targetY).toBeLessThan(layout.places[1][0].y)
  })

  it('spaces named points evenly over the longest series', () => {
    const layout = seriesLayout([
      [{ x: 'a', y: 1 }, { x: 'b', y: 1 }, { x: 'c', y: 1 }],
      [{ x: 'a', y: 2 }, { x: 'b', y: 2 }],
    ])
    expect(layout.places[1].map((place) => place.x)).toEqual([0, 0.5])
  })

  it('puts one point, alone, mid-plot', () => {
    expect(seriesLayout([[{ x: '2026-01-01', y: 5 }]]).places[0]).toEqual([{ x: 0.5, y: 0.5 }])
  })
})

const SERIES = [
  { label: 'Assets', tone: 'success' as const, points: [{ x: '2026-01-31', y: 100 }, { x: '2026-02-28', y: 120 }] },
  { label: 'Projected', dashed: true, points: [{ x: '2026-02-28', y: 120 }, { x: '2026-03-31', y: 150 }] },
]

describe('<MultiLineChart>', () => {
  it('loading: a skeleton at its height, busy, named', () => {
    const html = renderToStaticMarkup(<MultiLineChart label="Net worth" series={[]} isLoading height={90} />)
    expect(html).toContain('data-state="loading"')
    expect(html).toContain('height:90px')
    expect(html).toContain('Loading Net worth')
  })

  it('no points in any series: the empty line', () => {
    const html = renderToStaticMarkup(<MultiLineChart label="Net worth" series={[{ label: 'A', points: [] }]} />)
    expect(html).toMatch(/<figure[^>]*data-state="empty"[^>]*aria-label="Net worth"/)
    expect(html).toContain('No points yet')
  })

  it('a series of one point is a dot', () => {
    const html = renderToStaticMarkup(<MultiLineChart label="Net worth" series={[{ label: 'A', points: [{ x: 1, y: 2 }] }]} />)
    expect(html).not.toContain('<polyline')
    expect(html).toContain('data-slot="multi-line-chart-dot"')
  })

  it('the chart: a line per series, dashed where asked, a legend, and a table with a column per series', () => {
    const html = renderToStaticMarkup(
      <MultiLineChart label="Net worth" series={SERIES} target={{ y: 140, label: 'Target' }} formatY={usd} />,
    )
    expect(html.match(/<polyline/g)).toHaveLength(2)
    expect(html.match(/<polyline[^>]*stroke-dasharray/g)).toHaveLength(1)
    expect(html).toContain('text-success-text')
    expect(html).toContain(
      'Assets from $100 on 2026-01-31 to $120 on 2026-02-28; Projected from $120 on 2026-02-28 to $150 on 2026-03-31; Target $140',
    )
    const rows = [...html.matchAll(/<tr><th scope="row">([^<]*)<\/th><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g)].map((row) =>
      row.slice(1),
    )
    expect(rows).toEqual([
      ['2026-01-31', '$100', ''],
      ['2026-02-28', '$120', '$120'],
      ['2026-03-31', '', '$150'],
    ])
  })
})

describe('<LineChart projection>', () => {
  const POINTS = [{ x: '2026-01-01', y: 10 }, { x: '2027-01-01', y: 20 }]
  const AHEAD = [{ x: '2028-01-01', y: 30 }, { x: '2029-01-01', y: 45 }]

  it('carries the line on dashed from its last point, and names where it ends', () => {
    const html = renderToStaticMarkup(
      <LineChart label="Balance" points={POINTS} projection={{ label: 'Projected', points: AHEAD }} mark="max" formatY={usd} />,
    )
    expect(html).toContain('data-slot="line-chart-projection"')
    // From the last measured point (the plot's 1/3 across) to the projection's end.
    expect(html).toMatch(/<polyline points="33\.[0-9]+,[0-9.]+ 66\.[0-9]+,[0-9.]+ 100,[0-9.]+"[^>]*stroke-dasharray="6 4"/)
    expect(html).toContain('Projected $45 on 2029-01-01')
    // The mark stays on what was measured: the highest is $20, not $45.
    expect(html).toMatch(/data-slot="line-chart-mark"[^]*>\$20</)
    expect(html).toContain('<td>$45 (Projected)</td>')
  })

  it('without a projection, nothing changes', () => {
    const html = renderToStaticMarkup(<LineChart label="Balance" points={POINTS} />)
    expect(html).not.toContain('line-chart-projection')
  })
})
