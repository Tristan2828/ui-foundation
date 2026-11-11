// The way back from a page: the record it belongs to, each page above it,
// and the page itself (`Notes › Project plan › Getting Started › Setup`), as a
// breadcrumb (shadcn's Breadcrumb). Pages nest to any depth, so a trail
// can be any length: when it doesn't fit on one line, the crumbs after the
// first are folded into a "…" menu, from the top down, until it does; the
// first and the page itself always show, the page's own name cut short
// with an ellipsis if even that is too wide (a phone). Every crumb but the
// last is a link (through the router when there is one); the last is the
// page you're on (`aria-current="page"`).
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useInRouterContext } from 'react-router'
import { cn } from 'cn'
import { ChevronRightIcon } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { crumbsToFold } from '@/lib/page-trail'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

/** One step of the trail: its name, and where it goes (not the last one's). */
export type PageCrumb = {
  label: string
  /** Where the crumb goes. The last crumb, the page itself, needs none. */
  href?: string
}

export type PageTrailProps = {
  /**
   * From the top (the record, or the list it's in) down to the page
   * itself, last. Any number: one is just the page.
   */
  crumbs: readonly PageCrumb[]
  /** The trail's name for screen readers. Defaults to "Breadcrumb". */
  'aria-label'?: string
  className?: string
}

// A crumb's widest, so one long title can't take the whole line.
const CRUMB = 'block max-w-48 truncate'

function CrumbLink({ crumb, inRouter }: { crumb: PageCrumb; inRouter: boolean }) {
  if (!crumb.href) return <span className={cn(CRUMB, 'text-muted-foreground')}>{crumb.label}</span>
  return (
    <BreadcrumbLink
      className={CRUMB}
      title={crumb.label}
      render={inRouter ? <Link to={crumb.href} /> : <a href={crumb.href} />}
    >
      {crumb.label}
    </BreadcrumbLink>
  )
}

export function PageTrail({ crumbs, 'aria-label': ariaLabel, className }: PageTrailProps) {
  const inRouter = useInRouterContext()
  const navRef = useRef<HTMLElement>(null)
  const measureRef = useRef<HTMLOListElement>(null)
  const [folded, setFolded] = useState(0)
  const key = crumbs.map((crumb) => `${crumb.label}\u0000${crumb.href ?? ''}`).join('\u0001')

  // Measured from a copy of the whole trail nobody sees, each time the
  // trail's room or its crumbs change.
  useLayoutEffect(() => {
    const nav = navRef.current
    const measure = measureRef.current
    if (!nav || !measure) return
    const update = () => {
      const items = [...measure.querySelectorAll<HTMLElement>('[data-measure=crumb]')].map((item) => item.offsetWidth)
      const separator = measure.querySelector<HTMLElement>('[data-measure=separator]')?.offsetWidth ?? 0
      const ellipsis = measure.querySelector<HTMLElement>('[data-measure=ellipsis]')?.offsetWidth ?? 0
      // A separator's share of the list's gaps: one each side.
      const gap = parseFloat(getComputedStyle(measure).columnGap) || 0
      setFolded(crumbsToFold(items, separator + gap * 2, ellipsis, nav.clientWidth))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(nav)
    return () => observer.disconnect()
  }, [key])

  const last = crumbs.length - 1
  const hidden = crumbs.slice(1, 1 + folded)
  const shown: { crumb: PageCrumb; index: number }[] = crumbs
    .map((crumb, index) => ({ crumb, index }))
    .filter(({ index }) => index === 0 || index > folded)

  const separator = (id: string) => <BreadcrumbSeparator key={id} />
  const items: ReactNode[] = []
  shown.forEach(({ crumb, index }, at) => {
    if (at > 0) items.push(separator(`separator-${index}`))
    if (index === 0 && hidden.length > 0) {
      items.push(
        <BreadcrumbItem key="first" className="shrink-0">
          <CrumbLink crumb={crumb} inRouter={inRouter} />
        </BreadcrumbItem>,
        separator('separator-menu'),
        <BreadcrumbItem key="menu" className="shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={hidden.length === 1 ? 'Show 1 more page' : `Show ${hidden.length} more pages`}
              data-slot="page-trail-more"
              className="flex items-center rounded-md transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <BreadcrumbEllipsis />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-w-72">
              {hidden.map((item, offset) => (
                <DropdownMenuItem
                  key={offset}
                  render={item.href ? inRouter ? <Link to={item.href} /> : <a href={item.href} /> : undefined}
                  disabled={!item.href}
                >
                  <span className="truncate">{item.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </BreadcrumbItem>,
      )
      return
    }
    if (index === last)
      items.push(
        // The page itself: the one crumb that gives up its width last.
        <BreadcrumbItem key="page" className="min-w-0">
          {/* Text marked as the current page, not shadcn's role="link"
              with aria-disabled: a link that goes nowhere, which a test
              (or a screen reader's list of links) finds beside the
              sidebar's own "Home" (4.86, the trail in AppShell's bar). */}
          <BreadcrumbPage className="block truncate" title={crumb.label} role={undefined} aria-disabled={undefined}>
            {crumb.label}
          </BreadcrumbPage>
        </BreadcrumbItem>,
      )
    else
      items.push(
        <BreadcrumbItem key={`crumb-${index}`} className={index === 0 ? 'shrink-0' : 'min-w-0'}>
          <CrumbLink crumb={crumb} inRouter={inRouter} />
        </BreadcrumbItem>,
      )
  })

  return (
    <Breadcrumb ref={navRef} aria-label={ariaLabel ?? 'Breadcrumb'} data-slot="page-trail" className={cn('relative min-w-0', className)}>
      <BreadcrumbList className="flex-nowrap">{items}</BreadcrumbList>
      {/* The whole trail, unseen, for its widths: clipped, so it never widens the page. */}
      <div aria-hidden="true" className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden">
        <ol ref={measureRef} className="flex w-max gap-1.5 text-sm whitespace-nowrap">
          {crumbs.map((crumb, index) => (
            <li key={index} data-measure="crumb" className={index === last ? 'block' : CRUMB}>
              {crumb.label}
            </li>
          ))}
          <li data-measure="separator">
            <ChevronRightIcon className="size-3.5" />
          </li>
          <li data-measure="ellipsis" className="flex size-5" />
        </ol>
      </div>
    </Breadcrumb>
  )
}
