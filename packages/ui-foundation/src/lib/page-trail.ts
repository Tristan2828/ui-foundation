// PageTrail's fitting (src/components/app/page-trail.tsx): how many
// crumbs fold into its "…" menu so the trail fits on one line.

/**
 * How many crumbs after the first to fold into the "…" menu so the trail
 * fits `available`: 0 when it all fits, at most all but the first and the
 * last. `widths` are each crumb's, `separator` the gap a separator takes
 * (with its spacing), `ellipsis` the menu button's.
 */
export function crumbsToFold(widths: readonly number[], separator: number, ellipsis: number, available: number): number {
  const count = widths.length
  if (count <= 2) return 0
  const sum = (from: number) => widths.slice(from).reduce((total, width) => total + width, 0)
  if (sum(0) + separator * (count - 1) <= available) return 0
  for (let folded = 1; folded < count - 1; folded++) {
    // The first, the menu, then every crumb after the folded ones.
    const shown = count - 1 - folded
    const width = widths[0] + ellipsis + sum(folded + 1) + separator * (shown + 1)
    if (width <= available) return folded
  }
  return count - 2
}
