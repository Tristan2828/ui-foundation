import type { Meta, StoryObj } from '@/fixtures/types'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { LineChartPoint } from '@/lib/line-chart-layout'
import { MultiLineChart, type ChartSeries } from './multi-line-chart'

// MultiLineChart (4.51), on a card: a net worth beside its assets and
// what's owed, and a balance's history running into low, middle and high
// projections against a target. All states is each of the four. Axe, the
// token check and the glyph check (every series and legend swatch is an
// <svg> in currentColor) measure both in both themes
// (e2e/fixtures-visual.spec.ts); e2e/line-chart.spec.ts checks the shape
// and what a screen reader gets.
const meta: Meta = {
  title: 'app/MultiLineChart',
  parameters: { controls: { disable: true } },
}

export default meta

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const usd = (y: number) => money.format(y)
const month = (x: LineChartPoint['x']) =>
  new Date(`${String(x)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
const year = (x: LineChartPoint['x']) => String(x).slice(0, 4)

const MONTHS = ['2026-04-30', '2026-05-31', '2026-06-30', '2026-07-31', '2026-08-31', '2026-09-30']
const NET_WORTH: ChartSeries[] = [
  { label: 'Assets', tone: 'success', points: MONTHS.map((x, i) => ({ x, y: 182000 + i * 3100 })) },
  { label: 'Owed', tone: 'destructive', points: MONTHS.map((x, i) => ({ x, y: 64000 - i * 900 })) },
  { label: 'Net worth', tone: 'info', points: MONTHS.map((x, i) => ({ x, y: 118000 + i * 4000 })) },
]

const HISTORY = ['2023', '2024', '2025', '2026'].map((y, i) => ({ x: `${y}-01-01`, y: 60000 + i * 22000 }))
const grow = (rate: number) =>
  [2026, 2030, 2034, 2038, 2042].map((y) => ({ x: `${y}-01-01`, y: Math.round(126000 * (1 + rate) ** (y - 2026)) }))
const RETIREMENT: ChartSeries[] = [
  { label: 'Invested', tone: 'info', points: HISTORY },
  { label: 'Low (4%)', tone: 'muted', dashed: true, points: grow(0.04) },
  { label: 'Middle (6%)', tone: 'info', dashed: true, points: grow(0.06) },
  { label: 'High (8%)', tone: 'warning', dashed: true, points: grow(0.08) },
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
      <h1 className="type-page-title text-foreground">Net worth</h1>
      <OnCard title="Over time">
        <MultiLineChart label="Net worth over time" series={NET_WORTH} formatY={usd} formatX={month} />
      </OnCard>
    </div>
  ),
}

export const Projections: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-4">
      <h1 className="type-page-title text-foreground">Retirement</h1>
      <OnCard title="Projection">
        <MultiLineChart
          label="Invested and projected"
          series={RETIREMENT}
          target={{ y: 300000, label: 'Target' }}
          formatY={usd}
          formatX={year}
          height={200}
        />
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
        <MultiLineChart label="Net worth while loading" series={[]} isLoading formatY={usd} formatX={month} />
      </OnCard>
      <OnCard title="No points">
        <MultiLineChart
          label="Net worth with no points"
          series={[{ label: 'Net worth', points: [] }]}
          formatY={usd}
          formatX={month}
        />
      </OnCard>
      <OnCard title="One point each">
        <MultiLineChart
          label="Net worth with one point"
          series={NET_WORTH.map((one) => ({ ...one, points: one.points.slice(0, 1) }))}
          formatY={usd}
          formatX={month}
          height={120}
        />
      </OnCard>
    </div>
  ),
}
