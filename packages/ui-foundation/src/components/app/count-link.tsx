// A count linking to the related records (cell pattern 20): how many
// records of another entity point at this row, as a link to that entity's
// list filtered to them (`/tasks?project=7`, the query string
// useTableUrlState reads).
//
// - Underlined at rest: a bare number doesn't look like it goes anywhere.
//   Foreground, not text-link: --link is for written text.
// - Zero is a plain 0, not a link (a list of nothing is a dead end) and
//   not an em dash (zero is a value).
// - The accessible name is the count, then `label`, so every row's link is
//   distinct ("3 open tasks in Kitchen remodel") and still starts with
//   what it shows.
import { Link, type To } from 'react-router'
import { cn } from 'cn'

export interface CountLinkProps {
  /** How many related records there are. Count what `to` lists. */
  count: number
  /** The other entity's list, filtered to this row: `/tasks?project=7`. */
  to: To
  /**
   * What's counted and for which row, read after the count: `open tasks in
   * Kitchen remodel` (`open task` for one).
   */
  label: string
  className?: string
}

export function CountLink({ count, to, label, className }: CountLinkProps) {
  if (count === 0) return <span className={cn('tabular-nums', className)}>0</span>
  return (
    <Link
      to={to}
      aria-label={`${count} ${label}`}
      className={cn(
        'rounded-sm tabular-nums text-foreground underline underline-offset-4 outline-none',
        'hover:decoration-2 focus-visible:ring-3 focus-visible:ring-ring/50',
        className,
      )}
    >
      {count}
    </Link>
  )
}
