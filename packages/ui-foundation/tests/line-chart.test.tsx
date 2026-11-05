// LineChart (#238): where its points, target and mark go
// (src/lib/line-chart-layout.ts), and what it renders for each state and
// for a screen reader. How it looks and its contrast are
// e2e/line-chart.spec.ts's and storybook-visual's.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LineChart } from '../src/components/app/line-chart'
import { chartLayout, steppedPlaces } from '../src/lib/line-chart-layout'

const DAYS = [
  { x: '2026-10-01', y: 120 },
  { x: '2026-10-02', y: 100 },
  { x: '2026-10-05', y: 110 },
]

describe('chartLayout', () => {
  it('spaces days by their dates, first at the left, last at the right', () => {
    expect(chartLayout(DAYS).places.map((place) => place.x)).toEqual([0, 0.25, 1])
  })

  it('spaces points evenly when an x is not a day or a number', () => {
    const named = [{ x: 'Mon', y: 1 }, { x: 'Tue', y: 2 }, { x: 'Fri', y: 3 }]
    expect(chartLayout(named).places.map((place) => place.x)).toEqual([0, 0.5, 1])
  })

  it('puts higher values nearer the top, with room above and below, the target included', () => {
    const layout = chartLayout(DAYS, 90)
    const [first, second] = layout.places
    expect(first.y).toBeLessThan(second.y)
    expect(layout.domain.min).toBeLessThan(90)
    expect(layout.domain.max).toBeGreaterThan(120)
    expect(layout.targetY).toBeGreaterThan(second.y)
    expect(Math.min(...layout.places.map((place) => place.y))).toBeGreaterThan(0)
  })

  it('marks the lowest, highest or latest point; the latest of equal values', () => {
    expect(chartLayout(DAYS, undefined, 'min').markIndex).toBe(1)
    expect(chartLayout(DAYS, undefined, 'max').markIndex).toBe(0)
    expect(chartLayout(DAYS, undefined, 'last').markIndex).toBe(2)
    expect(chartLayout([{ x: 1, y: 5 }, { x: 2, y: 3 }, { x: 3, y: 3 }], undefined, 'min').markIndex).toBe(2)
    expect(chartLayout(DAYS).markIndex).toBeUndefined()
  })

  it('puts one point, or equal values, mid-plot', () => {
    expect(chartLayout([{ x: '2026-10-01', y: 50 }]).places).toEqual([{ x: 0.5, y: 0.5 }])
    expect(chartLayout([{ x: 1, y: 0 }, { x: 2, y: 0 }]).places.map((place) => place.y)).toEqual([0.5, 0.5])
  })
})

describe('chartLayout with levels', () => {
  it('spans every level whatever the values, lowest level at the bottom', () => {
    const layout = chartLayout([{ x: 1, y: 3 }, { x: 2, y: 4 }], undefined, undefined, 5)
    expect(layout.domain.min).toBeLessThan(0)
    expect(layout.domain.max).toBeGreaterThan(4)
    const ys = layout.levelYs!
    expect(ys).toHaveLength(5)
    expect(ys[0]).toBeGreaterThan(ys[4])
    expect(layout.places[1].y).toBeCloseTo(ys[4])
  })

  it('has no level heights without levels', () => {
    expect(chartLayout(DAYS).levelYs).toBeUndefined()
  })

  it('steps: holds each value until the next point', () => {
    expect(steppedPlaces([{ x: 0, y: 1 }, { x: 0.5, y: 0.2 }, { x: 1, y: 0.6 }])).toEqual([
      { x: 0, y: 1 },
      { x: 0.5, y: 1 },
      { x: 0.5, y: 0.2 },
      { x: 1, y: 0.2 },
      { x: 1, y: 0.6 },
    ])
  })
})

const usd = (y: number) => `$${y.toFixed(2)}`

describe('<LineChart>', () => {
  it('loading: a skeleton at its height, busy, named', () => {
    const html = renderToStaticMarkup(<LineChart label="Price over time" points={[]} isLoading height={120} />)
    expect(html).toContain('data-state="loading"')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('height:120px')
    expect(html).toContain('Loading Price over time')
  })

  it('no points: the empty line, in a figure named by the label', () => {
    const html = renderToStaticMarkup(<LineChart label="Price over time" points={[]} />)
    expect(html).toMatch(/<figure[^>]*data-state="empty"[^>]*aria-label="Price over time"/)
    expect(html).toContain('No points yet')
  })

  it('one point: a dot and no line', () => {
    const html = renderToStaticMarkup(<LineChart label="Price" points={DAYS.slice(0, 1)} formatY={usd} />)
    expect(html).not.toContain('<polyline')
    expect(html).toContain('data-slot="line-chart-mark"')
    expect(html).toContain('One point: $120.00 on 2026-10-01')
  })

  it('the chart: a line, the target, the mark, and every value for a screen reader', () => {
    const html = renderToStaticMarkup(
      <LineChart label="Price" points={DAYS} target={{ y: 99, label: 'Buy at' }} mark="min" formatY={usd} />,
    )
    expect(html).toContain('<polyline')
    expect(html).toContain('stroke-dasharray')
    expect(html).toContain('Buy at $99.00')
    expect(html).toContain(
      'From $120.00 on 2026-10-01 to $110.00 on 2026-10-05; lowest $100.00 on 2026-10-02; highest $120.00 on 2026-10-01; Buy at $99.00',
    )
    const rows = [...html.matchAll(/<tr><th scope="row">([^<]*)<\/th><td>([^<]*)<\/td><\/tr>/g)].map((row) => [row[1], row[2]])
    expect(rows).toEqual([
      ['2026-10-01', '$120.00'],
      ['2026-10-02', '$100.00'],
      ['2026-10-05', '$110.00'],
    ])
  })

  it('levels: each step named on the plot, the values read by name', () => {
    const LEVELS = ['Very low', 'Low', 'Moderate', 'High']
    const html = renderToStaticMarkup(
      <LineChart
        label="Confidence over time"
        levels={LEVELS}
        points={[{ x: '2026-06-02', y: 0 }, { x: '2026-07-21', y: 2 }, { x: '2026-09-29', y: 3 }]}
        mark="last"
      />,
    )
    expect(html).toContain('data-slot="line-chart-levels"')
    expect([...html.matchAll(/data-slot="line-chart-level-rule"/g)]).toHaveLength(4)
    for (const name of LEVELS) expect(html).toContain(`>${name}</span>`)
    // Stepped: five places for three points.
    const line = html.match(/<polyline points="([^"]*)"/)![1]
    expect(line.split(' ')).toHaveLength(5)
    expect(html).toContain('From Very low on 2026-06-02 to High on 2026-09-29')
    expect(html).toContain('one of Very low, Low, Moderate, High')
    expect(html).toContain('<td>Moderate</td>')
  })
})
