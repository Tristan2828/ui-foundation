// A module's overview page (overview standard O1): what sums a module up
// rather than lists it. The title (the page's h1), an optional strip of
// key numbers (`stats`, a KeyStats), NeedsYou from `needs` (nothing when
// it's empty), then the module's parts:
//
// - from 48rem up, a grid of tiles, each at least 170px, as many as fit.
//   A tile is a button: the part's icon and title, its `value` in the
//   numeric type, and its `freshness`. A click opens the part's detail
//   below the grid, one at a time (`aria-expanded`, `aria-controls` the
//   detail); a second click, or Escape inside the detail, closes it.
//   The detail is the part's WidgetCard: the title as a link to `to`
//   with a chevron, `value`, `line`, the app's own `detail`, `freshness`.
// - under 48rem, the same WidgetCards as an accordion (WidgetCardGroup):
//   each folded to one line with its value, opening one folds the others.
//
// A part owns its states as a WidgetCard does: `isLoading` (a skeleton in
// the tile and the card), `error` (a dash in the tile, ErrorState with
// `onRetry` in the card), and `empty` (a part with nothing yet: "Nothing
// yet" in the tile, PartEmpty with its one way to start in the card).
//
// The breakpoint is read with matchMedia; on the server, or where it's
// missing (a test's DOM), the page is drawn wide.
import { useId, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react'
import type { To } from 'react-router'
import { cn } from 'cn'
import type { AppError } from '@/api/contracts'
import { Freshness, type FreshnessProps } from '@/components/app/freshness'
import type { IconComponent } from '@/components/app/icon-component'
import { NeedsYou, type NeedsYouItem } from '@/components/app/needs-you'
import type { PartEmptyState } from '@/components/app/part-empty'
import { WidgetCard, WidgetCardGroup } from '@/components/app/widget-card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyText } from './empty-value'

export type OverviewPart = {
  /** Unique on the page: the tile's and the card's id. */
  id: string
  title: string
  /** Decorative: the title names the part. */
  icon?: IconComponent
  /** Where the part's full list or page is: its detail's title links there. */
  to: To
  /** The headline: a number or a word or two ("$412,300", "3 of 7"). */
  value?: ReactNode
  /** One muted line under the value, in the detail: what it means. */
  line?: ReactNode
  /** How old the value is, in the tile and the detail. */
  freshness?: FreshnessProps
  /** What the detail shows under the value: a few rows (WidgetList), a small chart. */
  detail?: ReactNode
  /** A part with nothing yet: given, the part is empty, and its detail offers this one way to start. */
  empty?: PartEmptyState
  isLoading?: boolean
  error?: AppError | null
  onRetry?: () => void
}

export type OverviewPageProps = {
  /** The page's h1: the module's name. */
  title: string
  parts: readonly OverviewPart[]
  /** What waits on the user, collected from the parts: NeedsYou under the title. */
  needs?: readonly NeedsYouItem[]
  /** A strip of key numbers under the title (a KeyStats), before Needs you. */
  stats?: ReactNode
  /** Controls at the title's end. */
  actions?: ReactNode
  /** The part open at first; none when left out. */
  defaultOpen?: string | null
  className?: string
}

const WIDE_QUERY = '(min-width: 48rem)'
const canMatchMedia = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
function subscribeWide(listener: () => void) {
  if (!canMatchMedia()) return () => {}
  const query = window.matchMedia(WIDE_QUERY)
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}
const useIsWide = () =>
  useSyncExternalStore(
    subscribeWide,
    () => !canMatchMedia() || window.matchMedia(WIDE_QUERY).matches,
    () => true,
  )

export function OverviewPage({
  title,
  parts,
  needs = [],
  stats,
  actions,
  defaultOpen = null,
  className,
}: OverviewPageProps) {
  const wide = useIsWide()
  const detailId = useId()
  const [openId, setOpenId] = useState<string | null>(defaultOpen)
  const open = parts.find((part) => part.id === openId)
  const tileId = (id: string) => `${detailId}-tile-${id}`
  // Escape in the detail closes it and puts focus back on its tile.
  const onDetailKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || openId === null) return
    const tile = document.getElementById(tileId(openId))
    setOpenId(null)
    tile?.focus()
  }

  return (
    <div data-slot="overview-page" className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="type-page-title text-foreground">{title}</h1>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {stats}
      <NeedsYou items={needs} />
      {wide ? (
        <>
          <ul data-slot="overview-tiles" className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2.5">
            {parts.map((part) => (
              <li key={part.id} className="flex min-w-0">
                <OverviewTile
                  id={tileId(part.id)}
                  part={part}
                  open={part.id === openId}
                  controls={detailId}
                  onToggle={() => setOpenId(part.id === openId ? null : part.id)}
                />
              </li>
            ))}
          </ul>
          <div id={detailId} data-slot="overview-detail" onKeyDown={onDetailKeyDown}>
            {open && <PartCard part={open} />}
          </div>
        </>
      ) : (
        <WidgetCardGroup accordion defaultOpen={openId} className="flex flex-col gap-2.5">
          {parts.map((part) => (
            <PartCard key={part.id} part={part} />
          ))}
        </WidgetCardGroup>
      )}
    </div>
  )
}

function PartCard({ part }: { part: OverviewPart }) {
  return (
    <WidgetCard
      id={part.id}
      title={part.title}
      icon={part.icon}
      to={part.to}
      value={part.value}
      line={part.line}
      freshness={part.freshness}
      isLoading={part.isLoading ?? false}
      error={part.error}
      onRetry={part.onRetry}
      isEmpty={part.empty !== undefined}
      emptyMessage={part.empty?.text ?? 'Nothing here yet'}
      empty={part.empty}
      emptySummary="Nothing yet"
      className="w-full"
    >
      {part.detail}
    </WidgetCard>
  )
}

function OverviewTile({
  id,
  part,
  open,
  controls,
  onToggle,
}: {
  id: string
  part: OverviewPart
  open: boolean
  controls: string
  onToggle: () => void
}) {
  const { icon: Icon } = part
  const state = part.error ? 'error' : part.isLoading ? 'loading' : part.empty ? 'empty' : 'success'
  return (
    <button
      type="button"
      id={id}
      data-slot="overview-tile"
      data-state={state}
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className={cn(
        'glow-edge flex w-full min-w-0 flex-col items-start gap-0.5 rounded-lg bg-card px-3 py-2.5 text-left text-card-foreground',
        'shadow-(--card-shadow) ring-1 ring-border outline-none hover:bg-muted',
        'focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:ring-2 aria-expanded:ring-primary',
      )}
    >
      <span className="flex min-w-0 max-w-full items-center gap-1.5 type-label text-muted-foreground">
        {Icon && <Icon aria-hidden="true" className="size-4 shrink-0 text-link" />}
        <span className="truncate">{part.title}</span>
      </span>
      {state === 'loading' ? (
        <>
          <Skeleton data-state="loading" className="my-1 h-6 w-16" />
          <span className="sr-only">Loading</span>
        </>
      ) : state === 'error' ? (
        <EmptyText data-state="error" label="Couldn't load" className="type-numeric text-muted-foreground" />
      ) : state === 'empty' ? (
        <span data-state="empty" className="py-0.5 type-body text-muted-foreground">
          Nothing yet
        </span>
      ) : (
        part.value !== undefined && (
          <span data-slot="overview-tile-value" className="max-w-full truncate type-numeric text-foreground">
            {part.value}
          </span>
        )
      )}
      {state === 'success' && part.freshness && <Freshness {...part.freshness} />}
    </button>
  )
}
