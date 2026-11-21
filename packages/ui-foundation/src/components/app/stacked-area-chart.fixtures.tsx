import type { Meta, StoryObj } from '@/fixtures/types'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { LineChartPoint } from '@/lib/line-chart-layout'
import { StackedAreaChart, type StackedSeries } from './stacked-area-chart'

// StackedAreaChart (4.132), on a card: holdings by kind over six month-ends,
// each band a categorical slot stacked from zero, its top edge the total.
// All states is loading, no points, one snapshot (a stacked column) and a
// shorter chart of two bands. Axe, the token check and the glyph check
// (every band, segment and swatch is an <svg> in currentColor) measure both
// in both themes and every palette (e2e/fixtures-visual.spec.ts);
// e2e/stacked-area-chart.spec.ts checks the shape and what a screen reader
// gets.
const meta: Meta = {
  title: 'app/StackedAreaChart',
  parameters: { controls: { disable: true } },
}

export default meta

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const usd = (y: number) => money.format(y)
const month = (x: LineChartPoint['x']) =>
  new Date(`${String(x)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

const MONTHS = ['2026-04-30', '2026-05-31', '2026-06-30', '2026-07-31', '2026-08-31', '2026-09-30']
const HOLDINGS: StackedSeries[] = [
  { label: 'US stocks', values: [42000, 43500, 44100, 46800, 47200, 49500] },
  { label: 'International', values: [18000, 18400, 18900, 19300, 19100, 20200] },
  { label: 'Bonds', values: [15000, 15200, 15300, 15500, 15800, 16000] },
  { label: 'Cash', values: [8000, 7200, 9100, 6500, 7400, 6800] },
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
      <h1 className="type-page-title text-foreground">Investments</h1>
      <OnCard title="Over time">
        <StackedAreaChart label="Holdings over time" xs={MONTHS} series={HOLDINGS} formatY={usd} formatX={month} />
      </OnCard>
    </div>
  ),
}

export const AllStates: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-4">
      <OnCard title="Loading">
        <StackedAreaChart label="Holdings loading" xs={[]} series={[]} isLoading />
      </OnCard>
      <OnCard title="No points">
        <StackedAreaChart label="Holdings with no points" xs={[]} series={HOLDINGS} />
      </OnCard>
      <OnCard title="One snapshot">
        <StackedAreaChart
          label="Holdings, one snapshot"
          xs={[MONTHS[5]]}
          series={HOLDINGS.map((one) => ({ ...one, values: [one.values[5]] }))}
          formatY={usd}
          formatX={month}
        />
      </OnCard>
      <OnCard title="Shorter">
        <StackedAreaChart
          label="Two bands"
          xs={MONTHS.slice(3)}
          series={HOLDINGS.slice(0, 2).map((one) => ({ ...one, values: one.values.slice(3) }))}
          formatY={usd}
          formatX={month}
          height={120}
        />
      </OnCard>
    </div>
  ),
}
