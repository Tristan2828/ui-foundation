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
// `collapsible` (#233) folds a card to its header, for a hub with more
// widgets than a phone screen holds: a chevron button at the header's end
// (named by the title, `aria-expanded`, `aria-controls` the body), the
// header's link still there while folded. With `storageKey` the choice is
// remembered on this device (useRememberedFlag: localStorage, in memory
// where that's blocked). The body is hidden, not unmounted, so whatever
// the app keeps in it stays put.
//
// `summary` (#263) is one short value a folded card shows in its header
// ("3", "Due today"), so a hub of folded cards still reads at a glance.
// It follows the card's state: a small skeleton while loading, a muted
// dash ("Couldn't load" to a screen reader) on an error, `emptySummary`
// (or nothing) when empty. Opened, the summary goes and the body shows,
// the error in it as before. The chevron is described by it.
//
// WidgetCardGroup (#263) makes its cards an accordion: every card in it
// folds, opening one folds the others, and a click anywhere on a header
// (not on its link or another control) toggles it; the chevron stays the
// keyboard's way in. `accordion="mobile"` does that only below the
// sidebar's breakpoint (useIsMobile), so a desktop hub keeps each card's
// own `collapsible`. While the accordion is on it owns the folding and a
// card's `storageKey` is left alone.
//
// The header's link is an app route (`to`) or, for a widget about a
// service outside the app, its address (`href`, #248): that one opens in a
// new tab, with the outside-link mark and a screen reader's "(opens in a
// new tab)", as WidgetListItem's `href` does.
//
// WidgetList and WidgetListItem are the common body: rows with dividers,
// each a primary link (or plain text) truncated to one line, an optional
// muted note ("2 h ago") and an optional trailing element (a badge, a
// switch). A trailing control is labelled by the row's text: pass a
// function and it gets the id to put in `aria-labelledby`.
//
// Under data-density="compact" (#224) the card's padding drops to 12px and
// a row's to 4px, for a dense hub; text stays at type-body. On a phone a
// compact row is 44px tall and its link fills that height, so it stays a
// finger's target.
import { createContext, useContext, useId, useState, type MouseEvent, type ReactNode } from 'react'
import { Link, type To } from 'react-router'
import { ChevronDownIcon, ExternalLinkIcon } from 'lucide-react'
import { cn } from 'cn'
import type { AppError } from '@/api/contracts'
import { ErrorState } from '@/components/app/error-state'
import type { IconComponent } from '@/components/app/icon-component'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsMobile } from '@/hooks/use-mobile'
import { useRememberedFlag } from '@/hooks/use-remembered-flag'

export interface WidgetCardProps {
  title: string
  /**
   * The card's id, on its region: the one WidgetCardGroup's `defaultOpen`
   * names and useWidgetLayout orders (`"ready"`). Unique on the page.
   */
  id?: string
  /**
   * An icon shown before the title: a Lucide icon, or an app's own mark (an
   * outside service's logo on a card about that service). Decorative: the
   * title names the card.
   */
  icon?: IconComponent
  /** The title's heading level: 2 under the page's h1 (the default), deeper under a section. */
  headingLevel?: 2 | 3 | 4 | 5 | 6
  /**
   * A link on the right of the header to everything the widget samples:
   * `{ to: '/tasks?status=doing', label: 'All doing' }`, or an outside
   * address, opened in a new tab: `{ href: 'https://example.com', label:
   * 'Open Example' }`. Its accessible name is `label`, described by the
   * title, so several "All" links on one page stay distinct.
   */
  link?: WidgetCardLink
  isLoading: boolean
  error?: AppError | null
  onRetry?: () => void
  /** True once loaded with nothing to show. Ignored while loading or failed. */
  isEmpty: boolean
  /** The empty state's one line: "Nothing waiting". */
  emptyMessage: string
  /** How many rows the loading skeleton shows: the number the widget usually holds. */
  skeletonRows?: number
  /** A button at the header's end that folds the card to its header, and opens it again. */
  collapsible?: boolean
  /** Whether a collapsible card starts folded, until the person folds or opens it. */
  defaultCollapsed?: boolean
  /**
   * Remembers a collapsible card folded or open on this device, under this
   * key (name it for the app and the widget: `"my-app:hub.waiting"`).
   * Left out, it starts at `defaultCollapsed` on every visit.
   */
  storageKey?: string
  /**
   * One short value shown in the header while the card is folded: a count
   * (`3`), or a word or two (`"Due today"`). A skeleton while loading, a
   * muted dash on an error. Ignored while open.
   */
  summary?: ReactNode
  /** What a folded card's summary says when it's empty (`"None"`); nothing when left out. */
  emptySummary?: ReactNode
  children?: ReactNode
  className?: string
}

export type WidgetCardLink = { to: To; label: string; href?: never } | { href: string; label: string; to?: never }

const HEADER_LINK_CLASS =
  'shrink-0 rounded-sm type-label text-foreground underline underline-offset-4 outline-none ' +
  'hover:decoration-2 focus-visible:ring-3 focus-visible:ring-ring/50'

export function WidgetCard({
  id,
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
  collapsible = false,
  defaultCollapsed = false,
  storageKey,
  summary,
  emptySummary,
  children,
  className,
}: WidgetCardProps) {
  const headingId = useId()
  const contentId = useId()
  const summaryId = useId()
  const ownId = useId()
  const cardId = id ?? ownId
  const group = useContext(GroupContext)
  const inAccordion = group !== null && group.active
  const Heading = `h${headingLevel}` as const
  const state = error ? 'error' : isLoading ? 'loading' : isEmpty ? 'empty' : 'success'
  const [folded, setFolded] = useRememberedFlag(
    collapsible && storageKey !== undefined ? `${storageKey}:collapsed` : undefined,
    defaultCollapsed,
  )
  const collapsed = inAccordion ? group.openId !== cardId : collapsible && folded
  const foldable = inAccordion || collapsible
  const toggle = () => (inAccordion ? group.setOpenId(collapsed ? cardId : null) : setFolded(!collapsed))
  const summaryShown = collapsed && (summary !== undefined || emptySummary !== undefined)
  // In an accordion the whole header toggles, except where the click lands
  // on its link or another control (the chevron toggles on its own).
  const onHeaderClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!inAccordion) return
    if ((event.target as Element).closest('a, button, input, select, textarea, [role="switch"]')) return
    toggle()
  }

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      data-slot="widget-card"
      data-state={state}
      data-collapsed={collapsed || undefined}
      className={cn('min-w-0 self-start', className)}
    >
      <Card className="density-compact:[--card-spacing:--spacing(3)]">
        <CardHeader
          onClick={onHeaderClick}
          className={cn('flex items-center justify-between gap-3', inAccordion && 'cursor-pointer select-none')}
        >
          <Heading id={headingId} className="flex min-w-0 items-center gap-2 type-section-title text-foreground">
            {Icon && <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
            <span className="truncate">{title}</span>
          </Heading>
          {(link || foldable || summaryShown) && (
            <div className="flex shrink-0 items-center gap-1">
              {summaryShown && (
                <span id={summaryId} data-slot="widget-card-summary" className="mr-2 flex items-center">
                  <WidgetCardSummary state={state} summary={summary} emptySummary={emptySummary} />
                </span>
              )}
              {link?.href !== undefined ? (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-describedby={headingId}
                  className={cn(HEADER_LINK_CLASS, 'inline-flex items-center gap-1')}
                >
                  {link.label}
                  <ExternalLinkIcon aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                link && (
                  <Link to={link.to} aria-describedby={headingId} className={HEADER_LINK_CLASS}>
                    {link.label}
                  </Link>
                )
              )}
              {foldable && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-labelledby={headingId}
                  aria-describedby={summaryShown ? summaryId : undefined}
                  aria-expanded={!collapsed}
                  aria-controls={contentId}
                  onClick={toggle}
                  // The button's own open look (a filled background) would
                  // read as pressed: the chevron says it.
                  className="-my-1 -mr-1.5 aria-expanded:not-hover:bg-transparent"
                >
                  <ChevronDownIcon aria-hidden="true" className={cn('transition-transform', collapsed && '-rotate-90')} />
                </Button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent id={contentId} hidden={collapsed} aria-busy={state === 'loading' || undefined}>
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

// A folded card's one value, by state. Loading's skeleton is about one
// number wide; an error's dash says "Couldn't load" to a screen reader,
// the error itself waiting in the body.
function WidgetCardSummary({
  state,
  summary,
  emptySummary,
}: {
  state: 'loading' | 'error' | 'empty' | 'success'
  summary: ReactNode
  emptySummary: ReactNode
}) {
  if (state === 'loading') {
    return (
      <>
        <Skeleton data-state="loading" className="h-4 w-8" />
        <span className="sr-only">Loading</span>
      </>
    )
  }
  if (state === 'error') {
    return (
      <span data-state="error" className="type-label text-muted-foreground">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Couldn't load</span>
      </span>
    )
  }
  if (state === 'empty') {
    return emptySummary === undefined ? null : (
      <span data-state="empty" className="type-label text-muted-foreground">
        {emptySummary}
      </span>
    )
  }
  return <span className="type-label tabular-nums text-foreground">{summary}</span>
}

type GroupState = { active: boolean; openId: string | null; setOpenId: (id: string | null) => void }

const GroupContext = createContext<GroupState | null>(null)

export interface WidgetCardGroupProps {
  /**
   * One card open at a time: `true` always, `"mobile"` only below the
   * sidebar's breakpoint (a desktop hub keeps each card's own
   * `collapsible`), `false` never (the group is a plain wrapper).
   */
  accordion?: boolean | 'mobile'
  /** The `id` of the card open at first; all folded (showing their summaries) when left out. */
  defaultOpen?: string | null
  children: ReactNode
  /** The wrapper's classes: the hub's grid of cards, usually. */
  className?: string
}

/** Wraps a hub's WidgetCards so that opening one folds the others (on a phone only, with `accordion="mobile"`). */
export function WidgetCardGroup({ accordion = true, defaultOpen = null, children, className }: WidgetCardGroupProps) {
  const isMobile = useIsMobile()
  const [openId, setOpenId] = useState<string | null>(defaultOpen)
  const active = accordion === 'mobile' ? isMobile : accordion
  return (
    <GroupContext.Provider value={{ active, openId, setOpenId }}>
      <div data-slot="widget-card-group" data-accordion={active || undefined} className={className}>
        {children}
      </div>
    </GroupContext.Provider>
  )
}

// One row's height, shared by the skeleton and the list so the card doesn't
// jump: py-2 around one line of type-body (or a small control). Compact
// is 32px (6px around the line); on a phone it's 44px, the link's own
// padding making up the height (ROW_LINK_CLASS).
const ROW_CLASS =
  'flex min-h-9 items-center gap-3 py-2 density-compact:min-h-8 density-compact:py-1 ' +
  'max-sm:density-compact:min-h-11 max-sm:density-compact:py-0'

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
  'hover:underline focus-visible:underline focus-visible:ring-3 focus-visible:ring-ring/50 ' +
  'max-sm:density-compact:py-3'

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
