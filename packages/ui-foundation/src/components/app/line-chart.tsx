// A small value-over-time chart for a record's page (#238): one series (a
// price checked daily, a weight, a balance) against an optional dashed
// target, with its lowest, highest or latest point marked. Plain SVG, no
// chart library: one line, a few dozen points, nothing to zoom.
//
// Colours are text tokens, so each clears 3:1 on the card in both themes:
// the line in `info-text`, the target in `success-text`. Each is its own
// <svg> drawing in currentColor, so the package's glyph check measures it
// like any icon. The plot stretches to its box (preserveAspectRatio
// "none", strokes that don't scale), and the dots and words on it are
// HTML placed by percentage, so nothing is squashed at any width.
//
// The picture is for the eye: a screen reader gets the figure's name,
// a summary (first, last, lowest, highest, the target) and a table of
// every point, all visually hidden.
//
// A `projection` (4.51) carries the line on past its last point, dashed in
// the same colour: where a balance may go, not where it went. It shares
// the plot's x and y ranges, so the target and the projection meet where
// they would.
//
// `levels` (4.64) is for a value that is one of a few named steps (a
// confidence, Very low to High): each y is its step's index. The steps
// are named down the plot's left with a faint rule at each, the range is
// every step, and the line holds each value until the next point, then
// steps. A value reads by its name, in the summary and the table too,
// unless `formatY` says otherwise. The four states: a skeleton at
// `height` while loading, one quiet line with no points, a dot (no line)
// for one point, and the chart.
import { cn } from 'cn'
import { Skeleton } from '@/components/ui/skeleton'
import { chartLayout, steppedPlaces, type LineChartMark, type LineChartPoint } from '@/lib/line-chart-layout'

export type { LineChartMark, LineChartPoint } from '@/lib/line-chart-layout'

export type LineChartProps = {
  /** The figure's name: "Price over time". */
  label: string
  /** The values, oldest first. */
  points: readonly LineChartPoint[]
  /** A dashed line at a value to reach or stay under: `{ y: 99, label: 'Buy at' }`. */
  target?: { y: number; label: string }
  /**
   * Where the line may go next, drawn dashed on from its last point:
   * `{ label: 'Projected', points }`, oldest first, each after the last of
   * `points`. The mark is only ever on `points`.
   */
  projection?: { label: string; points: readonly LineChartPoint[] }
  /** Which point to mark with a dot and its value: the lowest, the highest or the latest. */
  mark?: LineChartMark
  /**
   * Named steps, lowest first: `['Very low', 'Low', 'Moderate', 'High']`.
   * Each point's y is its step's index. The steps are named on the plot's
   * left, the range is all of them, and the line steps (4.64).
   */
  levels?: readonly string[]
  /** A value as shown: `usd`. Defaults to the number as the browser writes it. */
  formatY?: (y: number) => string
  /** A point's x as shown: `formatPlainDate`. Defaults to x as given. */
  formatX?: (x: LineChartPoint['x']) => string
  /** The plot's height in px; the chart fills its container's width. */
  height?: number
  isLoading?: boolean
  /** What shows with no points. */
  emptyMessage?: string
  className?: string
}

const defaultY = (y: number) => y.toLocaleString()
const defaultX = (x: LineChartPoint['x']) => String(x)
const percent = (fraction: number) => `${fraction * 100}%`

// Words on the plot sit beside a point, kept inside the plot at its
// edges, on a plate of the card's colour so a line under them doesn't
// cross them.
const PLATE = 'rounded-sm bg-card px-1'
function besides(x: number) {
  return x > 0.75 ? '-translate-x-full -ml-1.5' : 'ml-1.5'
}

export function LineChart({
  label,
  points,
  target,
  projection,
  mark,
  levels,
  formatY: formatYGiven,
  formatX = defaultX,
  height = 160,
  isLoading = false,
  emptyMessage = 'No points yet',
  className,
}: LineChartProps) {
  const formatY = formatYGiven ?? (levels ? (y: number) => levels[Math.round(y)] ?? String(y) : defaultY)
  if (isLoading) {
    return (
      <div data-slot="line-chart" data-state="loading" aria-busy="true" className={cn('min-w-0', className)}>
        <span className="sr-only">Loading {label}</span>
        <Skeleton style={{ height }} className="w-full" />
      </div>
    )
  }
  if (points.length === 0) {
    return (
      <figure data-slot="line-chart" data-state="empty" aria-label={label} className={cn('min-w-0', className)}>
        <p
          style={{ height }}
          className="flex items-center justify-center rounded-md border border-dashed border-border type-body text-muted-foreground"
        >
          {emptyMessage}
        </p>
      </figure>
    )
  }

  const ahead = projection?.points ?? []
  const steps = levels && levels.length > 0 ? levels.length : undefined
  const layout = {
    ...chartLayout([...points, ...ahead], target?.y, undefined, steps),
    markIndex: chartLayout(points, undefined, mark).markIndex,
  }
  const toLine = (places: readonly { x: number; y: number }[]) =>
    (steps ? steppedPlaces(places) : places).map((place) => `${place.x * 100},${place.y * 100}`).join(' ')
  const projected = ahead.length > 0 ? layout.places.slice(points.length - 1) : []
  const lastX = ahead.length > 0 ? ahead[ahead.length - 1].x : points[points.length - 1].x
  const values = points.map((point) => point.y)
  const lowest = values.indexOf(Math.min(...values))
  const highest = values.indexOf(Math.max(...values))
  const line = toLine(layout.places.slice(0, points.length))
  const marked = layout.markIndex === undefined ? undefined : layout.places[layout.markIndex]
  const single = points.length === 1 ? layout.places[0] : undefined
  const dot = marked ?? single
  const describe = (index: number) => `${formatY(points[index].y)} on ${formatX(points[index].x)}`
  const summary = [
    points.length === 1 ? `One point: ${describe(0)}` : `From ${describe(0)} to ${describe(points.length - 1)}`,
    points.length > 2 && `lowest ${describe(lowest)}`,
    points.length > 2 && `highest ${describe(highest)}`,
    projection && ahead.length > 0 && `${projection.label} ${formatY(ahead[ahead.length - 1].y)} on ${formatX(lastX)}`,
    target && `${target.label} ${formatY(target.y)}`,
  ]
    .filter(Boolean)
    .join('; ')

  return (
    <figure
      data-slot="line-chart"
      data-state="success"
      aria-label={label}
      className={cn('grid min-w-0 gap-x-2 gap-y-1.5', steps ? 'grid-cols-[auto_minmax(0,1fr)]' : 'grid-cols-1', className)}
    >
      {steps && (
        <div aria-hidden="true" data-slot="line-chart-levels" className="relative" style={{ height }}>
          {levels!.map((name, index) => (
            <span
              key={name}
              className="absolute right-0 -translate-y-1/2 type-caption whitespace-nowrap text-muted-foreground"
              style={{ top: percent(layout.levelYs![index]) }}
            >
              {name}
            </span>
          ))}
          {/* Holds the column's width: the names above are placed absolutely. */}
          <span className="invisible flex h-0 flex-col overflow-hidden type-caption whitespace-nowrap">
            {levels!.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </span>
        </div>
      )}
      <div aria-hidden="true" className="relative border-b border-border" style={{ height }}>
        {steps &&
          layout.levelYs!.map((y, index) => (
            <span
              key={index}
              data-slot="line-chart-level-rule"
              className="absolute inset-x-0 border-t border-dashed border-border"
              style={{ top: percent(y) }}
            />
          ))}
        {target && layout.targetY !== undefined && (
          <>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible text-success-text">
              <line
                x1="0"
                x2="100"
                y1={layout.targetY * 100}
                y2={layout.targetY * 100}
                strokeWidth={1.5}
                strokeDasharray="6 4"
                vectorEffect="non-scaling-stroke"
                className="stroke-current"
              />
            </svg>
            <span
              className={cn('absolute right-0 -translate-y-full type-caption text-success-text tabular-nums', PLATE)}
              style={{ top: percent(layout.targetY) }}
            >
              {target.label} {formatY(target.y)}
            </span>
          </>
        )}
        {points.length > 1 && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible text-info-text">
            <polyline
              points={line}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className="stroke-current"
            />
          </svg>
        )}
        {projected.length > 1 && (
          <svg
            data-slot="line-chart-projection"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible text-info-text"
          >
            <polyline
              points={toLine(projected)}
              fill="none"
              strokeWidth={2}
              strokeDasharray="6 4"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="stroke-current"
            />
          </svg>
        )}
        {dot && (
          <>
            <span
              data-slot="line-chart-mark"
              className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-info-text ring-2 ring-card"
              style={{ left: percent(dot.x), top: percent(dot.y) }}
            />
            <span
              className={cn(
                'absolute type-caption font-medium text-foreground tabular-nums',
                PLATE,
                besides(dot.x),
                // Under the lowest point, where the line isn't; over any other.
                mark === 'min' ? 'mt-1' : '-translate-y-full -mt-1',
              )}
              style={{ left: percent(dot.x), top: percent(dot.y) }}
            >
              {formatY(points[marked ? layout.markIndex! : 0].y)}
            </span>
          </>
        )}
      </div>
      <div aria-hidden="true" className={cn('flex justify-between gap-3 type-caption text-muted-foreground tabular-nums', steps && 'col-start-2')}>
        <span>{formatX(points[0].x)}</span>
        {(points.length > 1 || ahead.length > 0) && <span>{formatX(lastX)}</span>}
      </div>
      <figcaption className="sr-only">{steps ? `${summary}; one of ${levels!.join(', ')}` : summary}</figcaption>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point, index) => (
            <tr key={index}>
              <th scope="row">{formatX(point.x)}</th>
              <td>{formatY(point.y)}</td>
            </tr>
          ))}
          {ahead.map((point, index) => (
            <tr key={`ahead-${index}`}>
              <th scope="row">{formatX(point.x)}</th>
              <td>
                {formatY(point.y)} ({projection!.label})
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
