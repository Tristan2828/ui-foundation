// Parts of a whole over time (4.132): several amounts that add up to a
// total, each a category (a portfolio by asset class), stacked from zero
// so the top edge is the total and both the growth and the mix show.
// MultiLineChart's sibling, plain SVG the same way: each band is its own
// <svg> drawing in currentColor in a categorical slot's text class, so the
// package's glyph check measures it like any icon, and a 1px card-coloured
// line runs between neighbours. A legend under the plot lists the top band
// first with its latest value and share, then the total, so the colours
// never carry the meaning alone.
//
// The bands share one `xs`; each band's `values` line up with it, and a
// missing or negative value counts as 0. The picture is for the eye: a
// screen reader gets the figure's name, a summary (the total from first to
// last, each band's latest value and share) and a table with a column per
// band and a Total column, all visually hidden. The states: a skeleton at
// `height` while loading, one quiet line when there is nothing to stack,
// one stacked column mid-plot for a single snapshot, and the bands.
import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategorySlot } from "@/components/app/module-card";
import { stackedLayout, type LineChartPoint } from "@/lib/line-chart-layout";

export type StackedSeries = {
  /** The band's name in the legend and the table: "US stocks". */
  label: string;
  /** One amount per x, in xs' order: 0 or more. A missing or negative value counts as 0. */
  values: readonly number[];
  /** Its colour, a categorical slot. Defaults to its place in `series` + 1 (1, 2, 3…). */
  category?: CategorySlot;
};

export type StackedAreaChartProps = {
  /** The figure's name: "Allocation over time". */
  label: string;
  /** The shared x of every band, oldest first: days ('YYYY-MM-DD'), numbers or names. */
  xs: readonly LineChartPoint["x"][];
  /** The bands, bottom first. Keep it to about six: the slots that stay apart for colour-blind readers. */
  series: readonly StackedSeries[];
  /** A value as shown: `usd`. Defaults to the number as the browser writes it. */
  formatY?: (y: number) => string;
  /** An x as shown: `formatPlainDate`. Defaults to x as given. */
  formatX?: (x: LineChartPoint["x"]) => string;
  /** The plot's height in px; the chart fills its container's width. */
  height?: number;
  isLoading?: boolean;
  /** What shows when there is nothing to stack. */
  emptyMessage?: string;
  className?: string;
};

// Whole class names, so Tailwind sees each one.
const CATEGORY: Record<CategorySlot, string> = {
  1: "text-category-1",
  2: "text-category-2",
  3: "text-category-3",
  4: "text-category-4",
  5: "text-category-5",
  6: "text-category-6",
  7: "text-category-7",
  8: "text-category-8",
  9: "text-category-9",
  10: "text-category-10",
  11: "text-category-11",
  12: "text-category-12",
};

const defaultY = (y: number) => y.toLocaleString();
const defaultX = (x: LineChartPoint["x"]) => String(x);
const percent = (fraction: number) => `${fraction * 100}%`;

const slotOf = (one: StackedSeries, index: number): CategorySlot =>
  one.category ?? (((index % 12) + 1) as CategorySlot);

export function StackedAreaChart({
  label,
  xs,
  series,
  formatY = defaultY,
  formatX = defaultX,
  height = 160,
  isLoading = false,
  emptyMessage = "No points yet",
  className,
}: StackedAreaChartProps) {
  if (isLoading) {
    return (
      <div
        data-slot="stacked-area-chart"
        data-state="loading"
        aria-busy="true"
        className={cn("min-w-0", className)}
      >
        <span className="sr-only">Loading {label}</span>
        <Skeleton style={{ height }} className="w-full" />
      </div>
    );
  }
  // Cleaned once: what the plot, the legend, the summary and the table use.
  const values = series.map((one) =>
    xs.map((_, i) => Math.max(0, one.values[i] ?? 0)),
  );
  const layout = stackedLayout(xs, values);
  if (
    xs.length === 0 ||
    series.length === 0 ||
    layout.totals.every((total) => total === 0)
  ) {
    return (
      <figure
        data-slot="stacked-area-chart"
        data-state="empty"
        aria-label={label}
        className={cn("min-w-0", className)}
      >
        <p
          style={{ height }}
          className="flex items-center justify-center rounded-md border border-dashed border-border type-body text-muted-foreground"
        >
          {emptyMessage}
        </p>
      </figure>
    );
  }

  const last = xs.length - 1;
  const lastTotal = layout.totals[last];
  const share = (s: number) =>
    lastTotal === 0
      ? undefined
      : Math.round((values[s][last] / lastTotal) * 100);
  const withShare = (s: number) => {
    const part = share(s);
    return part === undefined
      ? formatY(values[s][last])
      : `${formatY(values[s][last])} (${part}%)`;
  };
  const summary = [
    xs.length === 1
      ? `Total ${formatY(layout.totals[0])} on ${formatX(xs[0])}`
      : `Total from ${formatY(layout.totals[0])} on ${formatX(xs[0])} to ${formatY(lastTotal)} on ${formatX(xs[last])}`,
    ...series.map((one, s) => `${one.label} ${withShare(s)}`),
  ].join("; ");
  const edge = (row: readonly number[]) =>
    row.map((y, i) => `${layout.across[i] * 100},${y * 100}`);

  return (
    <figure
      data-slot="stacked-area-chart"
      data-state="success"
      aria-label={label}
      className={cn("flex min-w-0 flex-col gap-1.5", className)}
    >
      <div
        aria-hidden="true"
        className="relative border-b border-border"
        style={{ height }}
      >
        {xs.length === 1 ? (
          // One snapshot: one stacked column mid-plot, a segment per band.
          <div
            data-slot="stacked-area-chart-column"
            className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2"
          >
            {series.map((one, s) => {
              if (values[s][0] === 0) return null;
              const { top, bottom } = layout.bands[s];
              return (
                <svg
                  key={s}
                  data-slot="stacked-area-chart-segment"
                  className={cn(
                    "absolute inset-x-0 w-full overflow-visible",
                    CATEGORY[slotOf(one, s)],
                  )}
                  style={{
                    top: percent(top[0]),
                    height: percent(bottom[0] - top[0]),
                  }}
                >
                  <rect width="100%" height="100%" fill="currentColor" />
                  <line
                    x1="0"
                    x2="100%"
                    y1="0"
                    y2="0"
                    strokeWidth={1}
                    className="stroke-card"
                  />
                </svg>
              );
            })}
          </div>
        ) : (
          series.map((one, s) => {
            if (values[s].every((value) => value === 0)) return null;
            const { top, bottom } = layout.bands[s];
            return (
              <svg
                key={s}
                data-slot="stacked-area-chart-band"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className={cn(
                  "absolute inset-0 size-full overflow-visible",
                  CATEGORY[slotOf(one, s)],
                )}
              >
                <polygon
                  points={[...edge(top), ...edge(bottom).reverse()].join(" ")}
                  fill="currentColor"
                />
                <polyline
                  points={edge(top).join(" ")}
                  fill="none"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  className="stroke-card"
                />
              </svg>
            );
          })
        )}
      </div>
      <div
        aria-hidden="true"
        className={cn(
          "flex gap-3 type-caption text-muted-foreground tabular-nums",
          xs.length === 1 ? "justify-center" : "justify-between",
        )}
      >
        <span>{formatX(xs[0])}</span>
        {xs.length > 1 && <span>{formatX(xs[last])}</span>}
      </div>
      <ul
        aria-hidden="true"
        data-slot="stacked-area-chart-legend"
        className="flex flex-wrap gap-x-4 gap-y-1 type-caption text-foreground"
      >
        {series
          .map((one, s) => ({ one, s }))
          .reverse()
          .map(({ one, s }) => {
            const part = share(s);
            return (
              <li key={s} className="flex items-center gap-1.5">
                <svg
                  viewBox="0 0 10 10"
                  className={cn("size-2.5 shrink-0", CATEGORY[slotOf(one, s)])}
                >
                  <rect width="10" height="10" rx="2" fill="currentColor" />
                </svg>
                <span>{one.label}</span>
                <span className="font-medium tabular-nums">
                  {formatY(values[s][last])}
                  {part !== undefined && ` · ${part}%`}
                </span>
              </li>
            );
          })}
        <li className="flex items-center gap-1.5 text-muted-foreground">
          <span>Total</span>
          <span className="font-medium tabular-nums">{formatY(lastTotal)}</span>
        </li>
      </ul>
      <figcaption className="sr-only">{summary}</figcaption>
      {/* A table ignores its own width, so a hidden box holds it: six columns would spill past a phone. */}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">When</th>
              {series.map((one, s) => (
                <th key={s} scope="col">
                  {one.label}
                </th>
              ))}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {xs.map((x, i) => (
              <tr key={`${String(x)}-${i}`}>
                <th scope="row">{formatX(x)}</th>
                {series.map((_, s) => (
                  <td key={s}>{formatY(values[s][i])}</td>
                ))}
                <td>{formatY(layout.totals[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
