// Where LineChart's points, target and mark go (#238), React-free so the
// rules are unit tested on their own (tests/line-chart-layout.test.ts).
// Positions are fractions of the plot, 0…1, x from the left and y from
// the top, so the chart fills whatever width it's given.

export type LineChartPoint = {
  /** A day (`'YYYY-MM-DD'`), a timestamp or any number. Points sit apart by it; if one isn't a time or a number, they're evenly spaced. */
  x: string | number
  y: number
}

export type LineChartMark = 'min' | 'max' | 'last'

export type ChartLayout = {
  /** Each point's place, in the order given. */
  places: { x: number; y: number }[]
  /** The y range drawn, bottom to top: the values and the target, with room around them. */
  domain: { min: number; max: number }
  /** The target line's height, if there's a target. */
  targetY?: number
  /** Which point the mark is on, if any. */
  markIndex?: number
}

// A point's position along x: a number as it is, a day or a timestamp as
// its time.
function along(x: string | number): number {
  return typeof x === 'number' ? x : Date.parse(x)
}

// Room above and below the values, as a share of their range, so the line
// never runs along the plot's edge.
const PAD = 0.1

export function chartLayout(points: readonly LineChartPoint[], target?: number, mark?: LineChartMark): ChartLayout {
  const values = points.map((point) => point.y)
  const all = target === undefined ? values : [...values, target]
  let min = Math.min(...all)
  let max = Math.max(...all)
  // One value (or all the same): a band around it, so the line sits mid-plot.
  const spread = max - min || Math.abs(max) || 1
  min -= spread * PAD
  max += spread * PAD
  const height = (y: number) => (max - y) / (max - min)

  const times = points.map((point) => along(point.x))
  const timed = times.every(Number.isFinite) && times.length > 1 && times.at(-1)! !== times[0]
  const first = timed ? Math.min(...times) : 0
  const span = timed ? Math.max(...times) - first : points.length - 1
  const across = (index: number) => (span === 0 ? 0.5 : ((timed ? times[index] : index) - first) / span)

  let markIndex: number | undefined
  if (points.length > 0 && mark) {
    if (mark === 'last') markIndex = points.length - 1
    else {
      const pick = mark === 'min' ? Math.min(...values) : Math.max(...values)
      // The latest of equal values: the one that's still true.
      markIndex = values.lastIndexOf(pick)
    }
  }

  return {
    places: points.map((point, index) => ({ x: across(index), y: height(point.y) })),
    domain: { min, max },
    targetY: target === undefined ? undefined : height(target),
    markIndex,
  }
}
