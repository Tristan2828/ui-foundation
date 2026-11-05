import type { Meta, StoryObj } from '@/fixtures/types'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { formatPlainDate } from '@/lib/plain-date'
import { LineChart, type LineChartPoint } from './line-chart'

// LineChart (#238), on a card as a record's page puts it: a price checked
// most days against a "Buy at" target, its lowest point marked. All
// states is each of the four (loading, no points, one point, the chart)
// and the other marks. Axe, the token check and the glyph check (the line
// and the target are each an <svg> in currentColor) measure both in both
// themes (e2e/fixtures-visual.spec.ts); e2e/line-chart.spec.ts checks
// the shape and what a screen reader gets.
const meta: Meta = {
  title: 'app/LineChart',
  parameters: { controls: { disable: true } },
}

export default meta

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const usd = (y: number) => money.format(y)
const day = (x: LineChartPoint['x']) => formatPlainDate(String(x), { month: 'short', day: 'numeric' })

// A gap on Oct 5–7: the points sit apart by their day, not evenly.
const PRICES: LineChartPoint[] = [
  { x: '2026-10-01', y: 129.99 },
  { x: '2026-10-02', y: 129.99 },
  { x: '2026-10-03', y: 124.5 },
  { x: '2026-10-04', y: 119 },
  { x: '2026-10-08', y: 109.99 },
  { x: '2026-10-09', y: 104.25 },
  { x: '2026-10-10', y: 112 },
  { x: '2026-10-12', y: 101.5 },
  { x: '2026-10-14', y: 99.99 },
  { x: '2026-10-16', y: 106 },
  { x: '2026-10-20', y: 105 },
]

function OnCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <h2 className="type-section-title text-foreground">{title}</h2>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export const Default: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-4">
      <h1 className="type-page-title text-foreground">Standing desk</h1>
      <OnCard title="Price">
        <LineChart label="Price over time" points={PRICES} target={{ y: 99, label: 'Buy at' }} mark="min" formatY={usd} formatX={day} />
      </OnCard>
    </div>
  ),
}

export const AllStates: StoryObj = {
  name: 'All states',
  render: () => (
    <div className="flex flex-col gap-4">
      <h1 className="type-page-title text-foreground">Every state</h1>
      <OnCard title="Loading">
        <LineChart label="Price while loading" points={[]} isLoading formatY={usd} formatX={day} />
      </OnCard>
      <OnCard title="No points">
        <LineChart label="Price with no points" points={[]} formatY={usd} formatX={day} />
      </OnCard>
      <OnCard title="One point">
        <LineChart label="Price with one point" points={PRICES.slice(0, 1)} target={{ y: 99, label: 'Buy at' }} formatY={usd} formatX={day} />
      </OnCard>
      <OnCard title="Latest marked">
        <LineChart label="Price, latest marked" points={PRICES} mark="last" formatY={usd} formatX={day} height={120} />
      </OnCard>
      <OnCard title="Highest marked">
        <LineChart label="Weight, highest marked" points={PRICES.map(({ x, y }) => ({ x, y: y / 2 }))} mark="max" formatX={day} />
      </OnCard>
    </div>
  ),
}

// A balance's history carried on dashed (4.51): where it may go by 2030,
// against the target it's meant to reach.
const BALANCES: LineChartPoint[] = [
  { x: '2024-01-01', y: 41000 },
  { x: '2024-07-01', y: 47500 },
  { x: '2025-01-01', y: 52000 },
  { x: '2025-07-01', y: 61000 },
  { x: '2026-01-01', y: 66500 },
]
const AHEAD: LineChartPoint[] = [
  { x: '2027-01-01', y: 80000 },
  { x: '2028-01-01', y: 95000 },
  { x: '2029-01-01', y: 111000 },
  { x: '2030-01-01', y: 128000 },
]
const year = (x: LineChartPoint['x']) => String(x).slice(0, 4)

export const Projection: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-4">
      <h1 className="type-page-title text-foreground">Savings</h1>
      <OnCard title="Balance">
        <LineChart
          label="Balance and projection"
          points={BALANCES}
          projection={{ label: 'Projected', points: AHEAD }}
          target={{ y: 120000, label: 'Target' }}
          mark="last"
          formatY={usd}
          formatX={year}
        />
      </OnCard>
    </div>
  ),
}
