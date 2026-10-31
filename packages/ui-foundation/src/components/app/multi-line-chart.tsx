// Several values over time on one plot (4.51): a net worth beside its
// assets and debts, or a balance's history beside low, middle and high
// projections. LineChart's sibling, plain SVG the same way: each series is
// its own <svg> drawing in currentColor in a text tone, so the package's
// glyph check measures it like any icon, and a dashed series (a
// projection, a plan) reads apart from a solid one in either theme. A
// legend under the plot names each series with its latest value, so the
// colours never carry the meaning alone.
//
// The picture is for the eye: a screen reader gets the figure's name, a
// summary (each series from its first to its last value, the target) and
// a table with a column per series, all visually hidden. The four states:
// a skeleton at `height` while loading, one quiet line when no series has
// a point, a dot for a series of one point, and the chart.
import { cn } from 'cn'
import { Skeleton } from '@/components/ui/skeleton'
import { seriesLayout, type LineChartPoint } from '@/lib/line-chart-layout'

export type ChartTone = 'info' | 'success' | 'warning' | 'destructive' | 'muted'

export type ChartSeries = {
  /** The series' name in the legend and the table: "Net worth". */
  label: string
  /** Its values, oldest first. */
  points: readonly LineChartPoint[]
  /** Its colour, a text tone that clears 3:1 on a card. Defaults to `info`. */
  tone?: ChartTone
  /** Dashed: a projection or a plan, not something measured. */
  dashed?: boolean
}

export type MultiLineChartProps = {
  /** The figure's name: "Net worth over time". */
  label: string
  /** The series, drawn in this order (the last on top) and listed in the legend. */
  series: readonly ChartSeries[]
  /** A dashed line at a value to reach: `{ y: 1_500_000, label: 'Target' }`, in `success-text`. */
  target?: { y: number; label: string }
  /** A value as shown: `usd`. Defaults to the number as the browser writes it. */
  formatY?: (y: number) => string
  /** A point's x as shown: `formatPlainDate`. Defaults to x as given. */
  formatX?: (x: LineChartPoint['x']) => string
  /** The plot's height in px; the chart fills its container's width. */
  height?: number
  isLoading?: boolean
  /** What shows when no series has a point. */
  emptyMessage?: string
  className?: string
}

const TONE: Record<ChartTone, string> = {
  info: 'text-info-text',
  success: 'text-success-text',
  warning: 'text-warning-text',
  destructive: 'text-destructive-text',
  muted: 'text-muted-foreground',
}
const DOT: Record<ChartTone, string> = {
  info: 'bg-info-text',
  success: 'bg-success-text',
  warning: 'bg-warning-text',
  destructive: 'bg-destructive-text',
  muted: 'bg-muted-foreground',
}

const defaultY = (y: number) => y.toLocaleString()
const defaultX = (x: LineChartPoint['x']) => String(x)
const percent = (fraction: number) => `${fraction * 100}%`
const DASH = '6 4'

export function MultiLineChart({
  label,
  series,
  target,
  formatY = defaultY,
  formatX = defaultX,
  height = 160,
  isLoading = false,
  emptyMessage = 'No points yet',
  className,
}: MultiLineChartProps) {
  if (isLoading) {
    return (
      <div data-slot="multi-line-chart" data-state="loading" aria-busy="true" className={cn('min-w-0', className)}>
        <span className="sr-only">Loading {label}</span>
        <Skeleton style={{ height }} className="w-full" />
      </div>
    )
  }
  const drawn = series.filter((one) => one.points.length > 0)
  if (drawn.length === 0) {
    return (
      <figure data-slot="multi-line-chart" data-state="empty" aria-label={label} className={cn('min-w-0', className)}>
        <p
          style={{ height }}
          className="flex items-center justify-center rounded-md border border-dashed border-border type-body text-muted-foreground"
        >
          {emptyMessage}
        </p>
      </figure>
    )
  }

  const layout = seriesLayout(
    drawn.map((one) => one.points),
    target?.y,
  )
  // The x range's two ends, by where they sit on the plot.
  const ends = drawn.flatMap((one, s) => one.points.map((point, p) => ({ x: point.x, at: layout.places[s][p].x })))
  const left = ends.reduce((a, b) => (b.at < a.at ? b : a))
  const right = ends.reduce((a, b) => (b.at > a.at ? b : a))
  // Every x once, in order along the plot, for the table's rows.
  const rows = [...new Map(ends.sort((a, b) => a.at - b.at).map((end) => [String(end.x), end.x])).values()]
  const summary = [
    ...drawn.map((one) => {
      const first = one.points[0]
      const last = one.points[one.points.length - 1]
      return one.points.length === 1
        ? `${one.label}: ${formatY(first.y)} on ${formatX(first.x)}`
        : `${one.label} from ${formatY(first.y)} on ${formatX(first.x)} to ${formatY(last.y)} on ${formatX(last.x)}`
    }),
    target && `${target.label} ${formatY(target.y)}`,
  ]
    .filter(Boolean)
    .join('; ')

  return (
    <figure
      data-slot="multi-line-chart"
      data-state="success"
      aria-label={label}
      className={cn('flex min-w-0 flex-col gap-1.5', className)}
    >
      <div aria-hidden="true" className="relative border-b border-border" style={{ height }}>
        {target && layout.targetY !== undefined && (
          <>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible text-success-text">
              <line
                x1="0"
                x2="100"
                y1={layout.targetY * 100}
                y2={layout.targetY * 100}
                strokeWidth={1.5}
                strokeDasharray={DASH}
                vectorEffect="non-scaling-stroke"
                className="stroke-current"
              />
            </svg>
            <span
              className="absolute right-0 -translate-y-full rounded-sm bg-card px-1 type-caption text-success-text tabular-nums"
              style={{ top: percent(layout.targetY) }}
            >
              {target.label} {formatY(target.y)}
            </span>
          </>
        )}
        {drawn.map((one, s) => {
          const tone = one.tone ?? 'info'
          const places = layout.places[s]
          if (places.length === 1) {
            return (
              <span
                key={s}
                data-slot="multi-line-chart-dot"
                className={cn('absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card', DOT[tone])}
                style={{ left: percent(places[0].x), top: percent(places[0].y) }}
              />
            )
          }
          return (
            <svg
              key={s}
              data-slot="multi-line-chart-series"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className={cn('absolute inset-0 size-full overflow-visible', TONE[tone])}
            >
              <polyline
                points={places.map((place) => `${place.x * 100},${place.y * 100}`).join(' ')}
                fill="none"
                strokeWidth={2}
                strokeDasharray={one.dashed ? DASH : undefined}
                strokeLinejoin="round"
                strokeLinecap={one.dashed ? undefined : 'round'}
                vectorEffect="non-scaling-stroke"
                className="stroke-current"
              />
            </svg>
          )
        })}
      </div>
      <div aria-hidden="true" className="flex justify-between gap-3 type-caption text-muted-foreground tabular-nums">
        <span>{formatX(left.x)}</span>
        {right.at > left.at && <span>{formatX(right.x)}</span>}
      </div>
      <ul aria-hidden="true" data-slot="multi-line-chart-legend" className="flex flex-wrap gap-x-4 gap-y-1 type-caption text-foreground">
        {drawn.map((one, s) => (
          <li key={s} className="flex items-center gap-1.5">
            <svg viewBox="0 0 16 4" className={cn('h-1 w-4 shrink-0', TONE[one.tone ?? 'info'])}>
              <line x1="0" x2="16" y1="2" y2="2" strokeWidth={2} strokeDasharray={one.dashed ? '4 2' : undefined} className="stroke-current" />
            </svg>
            <span>{one.label}</span>
            <span className="font-medium tabular-nums">{formatY(one.points[one.points.length - 1].y)}</span>
          </li>
        ))}
      </ul>
      <figcaption className="sr-only">{summary}</figcaption>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">When</th>
            {drawn.map((one, s) => (
              <th key={s} scope="col">
                {one.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={String(x)}>
              <th scope="row">{formatX(x)}</th>
              {drawn.map((one, s) => {
                const point = one.points.find((p) => String(p.x) === String(x))
                return <td key={s}>{point ? formatY(point.y) : ''}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
