// A small titled card on a hub page (issue #121): a few rows from one part
// of the app, loaded on their own. It owns the four required states the
// way DataTable and EntityView do, so every widget on a page skeletons,
// empties and fails alike:
//
// - loading: `skeletonRows` rows shaped like the list's, so the card
//   keeps its height when the data arrives;
// - empty: one quiet line the app supplies ("Nothing waiting");
// - error: ErrorState's compact form with a retry, inside the card, so a
//   failing widget never takes the page down;
// - success: the app's own children, usually a WidgetList.
//
// The title is a real heading (`headingLevel`, h2 by default, under the
// page's h1) and names the card's region, so each widget is in the page's
// outline and its landmarks. Height follows content (`self-start` in a
// grid), so a short widget doesn't stretch to its tallest neighbour.
//
// WidgetList and WidgetListItem are the common body: rows with dividers,
// each a primary link (or plain text) truncated to one line, an optional
// muted note ("2 h ago") and an optional trailing element (a badge, a
// switch). A trailing control is labelled by the row's text: pass a
// function and it gets the id to put in `aria-labelledby`.
import { useId, type ReactNode } from 'react'
import { Link, type To } from 'react-router'
import { ExternalLinkIcon, type LucideIcon } from 'lucide-react'
import { cn } from 'cn'
import type { AppError } from '@/api/contracts'
import { ErrorState } from '@/components/app/error-state'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export interface WidgetCardProps {
  title: string
  /** A Lucide icon shown before the title. Decorative: the title names the card. */
  icon?: LucideIcon
  /** The title's heading level: 2 under the page's h1 (the default), deeper under a section. */
  headingLevel?: 2 | 3 | 4 | 5 | 6
  /**
   * A link on the right of the header to everything the widget samples:
   * `{ to: '/tasks?status=doing', label: 'All doing' }`. Its accessible
   * name is `label`, described by the title, so several "All" links on one
   * page stay distinct.
   */
  link?: { to: To; label: string }
  isLoading: boolean
  error?: AppError | null
  onRetry?: () => void
  /** True once loaded with nothing to show. Ignored while loading or failed. */
  isEmpty: boolean
  /** The empty state's one line: "Nothing waiting". */
  emptyMessage: string
  /** How many rows the loading skeleton shows: the number the widget usually holds. */
  skeletonRows?: number
  children?: ReactNode
  className?: string
}

const HEADER_LINK_CLASS =
  'shrink-0 rounded-sm type-label text-foreground underline underline-offset-4 outline-none ' +
  'hover:decoration-2 focus-visible:ring-3 focus-visible:ring-ring/50'

export function WidgetCard({
  title,
  icon: Icon,
  headingLevel = 2,
  link,
  isLoading,
  error,
  onRetry,
  isEmpty,
  emptyMessage,
  skeletonRows = 3,
  children,
  className,
}: WidgetCardProps) {
  const headingId = useId()
  const Heading = `h${headingLevel}` as const
  const state = error ? 'error' : isLoading ? 'loading' : isEmpty ? 'empty' : 'success'

  return (
    <section
      aria-labelledby={headingId}
      data-slot="widget-card"
      data-state={state}
      className={cn('min-w-0 self-start', className)}
    >
      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <Heading id={headingId} className="flex min-w-0 items-center gap-2 type-section-title text-foreground">
            {Icon && <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
            <span className="truncate">{title}</span>
          </Heading>
          {link && (
            <Link to={link.to} aria-describedby={headingId} className={HEADER_LINK_CLASS}>
              {link.label}
            </Link>
          )}
        </CardHeader>
        <CardContent aria-busy={state === 'loading' || undefined}>
          {error ? (
            <ErrorState error={error} onRetry={onRetry} size="compact" />
          ) : state === 'loading' ? (
            <WidgetListSkeleton rows={skeletonRows} />
          ) : state === 'empty' ? (
            <p data-state="empty" className="py-2 type-body text-muted-foreground">
              {emptyMessage}
            </p>
          ) : (
            children
          )}
        </CardContent>
      </Card>
    </section>
  )
}

// One row's height, shared by the skeleton and the list so the card doesn't
// jump: py-2 around one line of type-body (or a small control).
const ROW_CLASS = 'flex min-h-9 items-center gap-3 py-2'

// Varied widths, so the skeleton reads as a list of titles, not a grid.
const SKELETON_WIDTHS = ['w-3/5', 'w-2/5', 'w-1/2', 'w-2/3', 'w-1/3', 'w-3/5']

function WidgetListSkeleton({ rows }: { rows: number }) {
  return (
    <div data-state="loading" className="flex flex-col divide-y divide-border">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className={ROW_CLASS}>
          <Skeleton className={cn('h-4', SKELETON_WIDTHS[row % SKELETON_WIDTHS.length])} />
          <Skeleton className="ml-auto h-4 w-12" />
        </div>
      ))}
    </div>
  )
}

/** The rows of a WidgetCard: a list with a divider between rows. */
export function WidgetList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ul data-slot="widget-list" className={cn('flex flex-col divide-y divide-border', className)}>
      {children}
    </ul>
  )
}

export interface WidgetListItemProps {
  /** The row's text: one line, cut with an ellipsis, the whole of it in the link's name and its tooltip. */
  children: string
  /** An app route: the row is a link to it. */
  to?: To
  /** An external address: the row is a link that opens in a new tab. Without `to` or `href` the row is plain text. */
  href?: string
  /** A small muted note after the text: "2 h ago", "holds 2". */
  note?: ReactNode
  /**
   * What ends the row: a badge, or a control. A control needs a name: pass
   * a function, and put the id it gets in the control's `aria-labelledby`,
   * so the row's text names it.
   */
  trailing?: ReactNode | ((rowTextId: string) => ReactNode)
  className?: string
}

const ROW_LINK_CLASS =
  'min-w-0 truncate rounded-sm font-medium text-foreground underline-offset-4 outline-none ' +
  'hover:underline focus-visible:underline focus-visible:ring-3 focus-visible:ring-ring/50'

export function WidgetListItem({ children, to, href, note, trailing, className }: WidgetListItemProps) {
  const textId = useId()
  const text =
    to !== undefined ? (
      <Link id={textId} to={to} title={children} className={ROW_LINK_CLASS}>
        {children}
      </Link>
    ) : href !== undefined ? (
      <a
        id={textId}
        href={href}
        target="_blank"
        rel="noreferrer"
        title={children}
        className={cn(ROW_LINK_CLASS, 'flex items-center gap-1')}
      >
        <span className="truncate">{children}</span>
        <ExternalLinkIcon aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    ) : (
      <span id={textId} title={children} className="min-w-0 truncate text-foreground">
        {children}
      </span>
    )

  return (
    <li data-slot="widget-list-item" className={cn(ROW_CLASS, 'type-body', className)}>
      {text}
      {(note !== undefined || trailing !== undefined) && (
        <span className="ml-auto flex shrink-0 items-center gap-3">
          {note !== undefined && <span className="type-caption tabular-nums text-muted-foreground">{note}</span>}
          {typeof trailing === 'function' ? trailing(textId) : trailing}
        </span>
      )}
    </li>
  )
}
