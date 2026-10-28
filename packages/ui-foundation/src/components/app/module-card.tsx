// A place on a hub page (issue #224): one of the app's modules, or a site
// outside it, as a small card in a strip across the top of the page.
//
// - The band: the place's icon, tinted with its categorical slot, and its
//   name, on a 10% wash of the same slot over the card. The band is the
//   link to the place (`to`, or `href` for another site, which opens in a
//   new tab with the external-link mark).
// - The body: one live number (`value`, in type-numeric's tabular figures)
//   and a short `note` under it ("open", "due today"). No `value` means no
//   number, not an empty state: a place outside the app has none.
// - The foot: one `action` link ("Today", "Start").
//
// States work like WidgetCard's, for the number only: a skeleton the
// number's size while loading, and on an error a short line and Retry
// inside the card, so one failing place never hides the others. The band
// and the action stay usable in every state.
//
// ModuleStrip lays the cards out: equal columns of 170px or more that
// wrap (six to eight across a desktop), and on a phone three columns of
// smaller tiles with no action, each tile a whole link (the band link's
// target stretched over the card) at least 44px tall. Retry sits above
// that target. data-density="compact" tightens the band and the body.
import { Children, useId, type ReactNode } from 'react'
import { Link, type To } from 'react-router'
import { AlertCircleIcon, ExternalLinkIcon } from 'lucide-react'
import { cn } from 'cn'
import type { AppError } from '@/api/contracts'
import type { IconComponent } from '@/components/app/icon-component'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/** One of the twelve categorical slots (design-language.md "Categorical colour"). */
export type CategorySlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

/** Where a module card's band goes: a route in the app, or another site. */
export type ModuleCardPlace = { to: To; href?: never } | { href: string; to?: never }

/** A link on a module card: a route in the app (`to`), or another site (`href`, opens in a new tab). */
export type ModuleCardLink = { label: string } & ModuleCardPlace

export type ModuleCardProps = ModuleCardPlace & {
  /** The place's name, on the band. */
  title: string
  /**
   * The place's icon: a Lucide icon, or a brand mark for another site.
   * Decorative: the title names the place.
   */
  icon: IconComponent
  /** The slot the icon and the band's wash take. Without one, the icon is muted and the band plain. */
  category?: CategorySlot
  /** The live number: `5`, or a short string (`'1–10 m'`). Omitted: no number. */
  value?: number | string
  /** A few words under the number: "open", "due today", "Opens its own app". */
  note?: string
  /** One link at the foot of the card (hidden on a phone, where the tile is the link). */
  action?: ModuleCardLink
  /** True while the number loads. */
  isLoading?: boolean
  error?: AppError | null
  onRetry?: () => void
  className?: string
}

// Whole class names per slot, so Tailwind generates them.
const ICON_CLASS: Record<CategorySlot, string> = {
  1: 'text-category-1',
  2: 'text-category-2',
  3: 'text-category-3',
  4: 'text-category-4',
  5: 'text-category-5',
  6: 'text-category-6',
  7: 'text-category-7',
  8: 'text-category-8',
  9: 'text-category-9',
  10: 'text-category-10',
  11: 'text-category-11',
  12: 'text-category-12',
}

// The band's wash: the slot at 10% over the card, so foreground text on
// it keeps its contrast (axe measures it in both themes).
const BAND_CLASS: Record<CategorySlot, string> = {
  1: 'bg-category-1/10',
  2: 'bg-category-2/10',
  3: 'bg-category-3/10',
  4: 'bg-category-4/10',
  5: 'bg-category-5/10',
  6: 'bg-category-6/10',
  7: 'bg-category-7/10',
  8: 'bg-category-8/10',
  9: 'bg-category-9/10',
  10: 'bg-category-10/10',
  11: 'bg-category-11/10',
  12: 'bg-category-12/10',
}

// The band link. On a phone its ::after covers the whole card, so the tile
// is one target; the focus ring moves to that ::after with it.
const BAND_LINK_CLASS =
  'group/band flex min-h-9 items-center gap-2 px-3 py-1.5 type-label text-foreground outline-none ' +
  'focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 ' +
  'density-compact:min-h-8 density-compact:py-1 ' +
  'max-sm:gap-1.5 max-sm:px-2 max-sm:after:absolute max-sm:after:inset-0 max-sm:after:rounded-xl ' +
  'max-sm:focus-visible:ring-0 max-sm:focus-visible:after:ring-3 max-sm:focus-visible:after:ring-inset ' +
  'max-sm:focus-visible:after:ring-ring/50'

const ACTION_CLASS =
  'flex items-center gap-1 border-t border-border px-3 py-2 type-label text-foreground underline ' +
  'underline-offset-4 outline-none hover:decoration-2 focus-visible:ring-3 focus-visible:ring-inset ' +
  'focus-visible:ring-ring/50 density-compact:py-1.5 max-sm:hidden'

function NewTabMark() {
  return (
    <>
      <ExternalLinkIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="sr-only"> (opens in a new tab)</span>
    </>
  )
}

export function ModuleCard({
  title,
  icon: Icon,
  category,
  to,
  href,
  value,
  note,
  action,
  isLoading = false,
  error,
  onRetry,
  className,
}: ModuleCardProps) {
  const titleId = useId()
  const bodyId = useId()
  const state = error ? 'error' : isLoading ? 'loading' : 'success'

  const band = (
    <>
      <Icon
        aria-hidden="true"
        className={cn('size-4 shrink-0', category ? ICON_CLASS[category] : 'text-muted-foreground')}
      />
      <span id={titleId} className="min-w-0 flex-1 truncate underline-offset-4 group-hover/band:underline">
        {title}
      </span>
    </>
  )
  const bandProps = {
    'aria-describedby': bodyId,
    'data-slot': 'module-card-band',
    className: cn(BAND_LINK_CLASS, category && BAND_CLASS[category]),
  }

  return (
    <Card
      data-slot="module-card"
      data-state={state}
      className={cn('relative h-full min-w-0 gap-0 py-0', className)}
    >
      {href !== undefined ? (
        <a href={href} target="_blank" rel="noreferrer" {...bandProps}>
          {band}
          <NewTabMark />
        </a>
      ) : (
        <Link to={to as To} {...bandProps}>
          {band}
        </Link>
      )}
      <div
        id={bodyId}
        data-slot="module-card-body"
        aria-busy={state === 'loading' || undefined}
        className="flex flex-1 flex-col gap-0.5 px-3 py-2 density-compact:py-1.5 max-sm:px-2"
      >
        {state === 'error' ? (
          <>
            <p className="flex items-center gap-1.5 type-body text-foreground">
              <AlertCircleIcon aria-hidden="true" className="size-4 shrink-0 text-destructive-text" />
              <span className="min-w-0">
                Couldn't load
                {error?.message && <span className="sr-only">: {error.message}</span>}
              </span>
            </p>
            {onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                aria-describedby={titleId}
                className="relative z-10 mt-1 self-start"
              >
                Retry
              </Button>
            )}
          </>
        ) : state === 'loading' ? (
          <>
            <span className="sr-only">Loading</span>
            <Skeleton data-state="loading" className="my-0.5 h-6 w-12" />
          </>
        ) : (
          value !== undefined && (
            <span data-slot="module-card-value" className="type-numeric text-foreground">
              {value}
            </span>
          )
        )}
        {note && state !== 'error' && (
          <span className="truncate type-body text-muted-foreground" title={note}>
            {note}
          </span>
        )}
      </div>
      {action &&
        (action.href !== undefined ? (
          <a href={action.href} target="_blank" rel="noreferrer" aria-describedby={titleId} className={ACTION_CLASS}>
            <span className="truncate">{action.label}</span>
            <NewTabMark />
          </a>
        ) : (
          <Link to={action.to} aria-describedby={titleId} className={ACTION_CLASS}>
            <span className="truncate">{action.label}</span>
          </Link>
        ))}
    </Card>
  )
}

export interface ModuleStripProps {
  /** Names the strip's navigation landmark: "Places". */
  'aria-label': string
  /** ModuleCards, one per place. */
  children: ReactNode
  className?: string
}

/**
 * A hub's places, a ModuleCard each: equal columns of 170px or more that
 * wrap, and three columns of tiles on a phone.
 */
export function ModuleStrip({ 'aria-label': label, children, className }: ModuleStripProps) {
  return (
    <nav aria-label={label} data-slot="module-strip" className={className}>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(--spacing(42.5),1fr))]">
        {Children.map(children, (child) => child && <li className="min-w-0">{child}</li>)}
      </ul>
    </nav>
  )
}
