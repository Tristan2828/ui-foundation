// AppShell's bottom bar on a phone (#240): Home and a few of the nav's
// sections in thumb reach, where the sidebar is a sheet behind the
// header's menu button. An item is a link, or a nav section by its label,
// which opens a sheet from the bottom listing that section's entries (and
// their children, under them, by heading where they have them), or with
// `sheet: 'tiles'` a grid of the entries as tiles, icon over label, like
// a phone's home screen. The sheet closes on navigation, as the
// sidebar's does. The item holding the current page is marked
// (`aria-current`). An entry's `count` shows on the phone as it does in
// the sidebar: a badge on a bar item's icon (a page's own, or the sum of a
// section's), in a tile's corner, at a sheet link's end; nothing at 0 or
// while loading, "99+" past 99, and read after the label ("News, 7 new").
// Shown below the md breakpoint only (the sidebar's own
// mobile breakpoint); the shell pads its content by the bar's height and
// the phone's safe area, so a page's last row clears it.
import { useId, useState } from 'react'
import { Link, useLocation } from 'react-router'
import {
  bottomBarCount,
  bottomBarCurrent,
  bottomBarSection,
  bottomBarTiles,
  childItems,
  childRuns,
  childrenOpen,
  isNavItemGroup,
  navCountSpoken,
  navCountText,
  type BottomBarItem,
  type NavChild,
  type NavEntry,
  type NavItem,
  type NavLook,
} from '@/components/app/app-shell-nav'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const ITEM_CLASS =
  'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 type-caption text-muted-foreground ' +
  'outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current]:text-foreground aria-[current]:font-medium ' +
  '[&_svg]:size-5 [&_svg]:shrink-0'

const SHEET_LINK_CLASS =
  'flex min-h-11 items-center gap-3 rounded-md px-3 type-body text-foreground outline-none ' +
  'hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-accent aria-[current=page]:font-medium ' +
  '[&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground'

/**
 * What the shell pads its content's bottom by on a phone: its own p-6,
 * plus the bar (4rem and its 1px border) and the phone's safe area.
 */
export const BOTTOM_BAR_PADDING = 'max-md:pb-[calc(--spacing(22)+1px+env(safe-area-inset-bottom))]'

// A link's label, and with a count its name: "News, 7 new". The name is
// one hidden text, the drawn label and count aria-hidden, so it reads
// exactly that (a hidden span beside the label would add a space before
// the comma).
function CountedLabel({
  label,
  count,
  countLabel,
  className,
}: {
  label: string
  count?: number
  countLabel?: string
  className: string
}) {
  const spoken = navCountSpoken(count, countLabel)
  if (spoken === undefined) return <span className={className}>{label}</span>
  return (
    <>
      <span aria-hidden="true" className={className}>
        {label}
      </span>
      <span className="sr-only">{`${label}, ${spoken}`}</span>
    </>
  )
}

// A tile's count in its corner, as the sidebar's tiles have it.
// Its link's name reads it (CountedLabel).
function TileCount({ count }: { count?: number }) {
  const text = navCountText(count)
  if (text === undefined) return null
  return (
    <span
      aria-hidden="true"
      data-slot="nav-count"
      className="absolute top-1 right-1.5 type-caption leading-none text-foreground tabular-nums"
    >
      {text}
    </span>
  )
}

// A bar item's icon, with its count as a badge on its corner: the
// primary's fill, ringed in the bar's background so it stands off the
// icon. Sized in em, so it grows with the type at large density.
function BarIcon({ icon: Icon, count }: { icon: BottomBarItem['icon']; count?: number }) {
  const text = navCountText(count)
  return (
    <span className="relative inline-flex">
      <Icon aria-hidden="true" />
      {text !== undefined && (
        <span
          aria-hidden="true"
          data-slot="bottom-bar-count"
          className="absolute -top-1.5 left-[calc(100%-0.5rem)] inline-flex h-[1.5em] min-w-[1.5em] items-center justify-center rounded-full bg-primary px-[0.35em] type-caption leading-none font-medium text-primary-foreground tabular-nums ring-2 ring-background"
        >
          {text}
        </span>
      )}
    </span>
  )
}

// A tile: the entry's icon over its label, a finger's target at least.
const TILE_CLASS =
  'relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-background px-1.5 py-2.5 ' +
  'text-center type-caption text-foreground outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 ' +
  'aria-[current]:border-primary aria-[current]:font-medium [&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:text-link'

function SheetLink({ item, activeTo }: { item: NavItem; activeTo: string | undefined }) {
  const { to, label, icon: Icon, children, count, countLabel } = item
  const text = navCountText(count)
  return (
    <li>
      <Link
        to={to}
        aria-current={to === activeTo ? 'page' : undefined}
        className={SHEET_LINK_CLASS}
      >
        <Icon />
        <CountedLabel label={label} count={count} countLabel={countLabel} className="truncate" />
        {text !== undefined && (
          <span aria-hidden="true" data-slot="nav-count" className="ml-auto shrink-0 type-caption text-muted-foreground tabular-nums">
            {text}
          </span>
        )}
      </Link>
      {children && children.length > 0 && (
        <div className="ml-5 border-l border-border pl-2">
          <SheetChildren items={children} activeTo={activeTo} />
        </div>
      )}
    </li>
  )
}

function SheetGroup({ label, items, activeTo }: { label: string; items: readonly NavItem[]; activeTo: string | undefined }) {
  const headingId = useId()
  return (
    <li>
      <span id={headingId} className="block px-3 pt-2 pb-0.5 type-caption text-muted-foreground">
        {label}
      </span>
      <ul aria-labelledby={headingId} className="flex flex-col gap-0.5">
        {items.map((item) => (
          <SheetLink key={item.to} item={item} activeTo={activeTo} />
        ))}
      </ul>
    </li>
  )
}

function SheetChildren({ items, activeTo }: { items: readonly NavChild[]; activeTo: string | undefined }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((child) =>
        isNavItemGroup(child) ? (
          <SheetGroup key={`group:${child.label}`} label={child.label} items={child.items} activeTo={activeTo} />
        ) : (
          <SheetLink key={child.to} item={child} activeTo={activeTo} />
        ),
      )}
    </ul>
  )
}

// A page tile, under a tiles section's tiles: smaller, four to a row,
// still a finger's target.
const PAGE_TILE_CLASS =
  'relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-center type-caption ' +
  'text-foreground outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 ' +
  'aria-[current=page]:bg-accent aria-[current=page]:font-medium [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground'

// The current entry's pages under a tiles section's tiles (#6C): a
// hairline, then its pages as small tiles, each heading a hairline of its
// own with its list still named by it.
function SheetPageTiles({ items, activeTo }: { items: readonly NavItem[]; activeTo: string | undefined }) {
  const open = items.filter((item) => childrenOpen(item, activeTo))
  return open.map((item) => (
    <div key={item.to} role="group" aria-label={`${item.label} pages`} data-slot="app-shell-sheet-pages" className="flex flex-col">
      {childRuns(item).map((run, runIndex) => (
        <div key={run.label ?? `run:${runIndex}`} className="flex flex-col">
          <div role="separator" className="my-2 h-px bg-border" />
          <ul aria-label={run.label} className="grid grid-cols-4 gap-1.5">
            {run.items.map(({ to, label, icon: Icon, count, countLabel }) => (
              <li key={to} className="flex min-w-0">
                <Link
                  to={to}
                  aria-current={to === activeTo ? 'page' : undefined}
                  className={PAGE_TILE_CLASS}
                >
                  <Icon aria-hidden="true" />
                  <CountedLabel label={label} count={count} countLabel={countLabel} className="max-w-full break-words" />
                  <TileCount count={count} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  ))
}

// The tiles (#N8): one per entry. Its pages are left to the module itself,
// unless the section's look is tiles (#6C): then the current entry's are
// under the tiles. The tile holding the current page, its own or one of
// its pages, is marked.
function SheetTiles({
  items,
  activeTo,
  withPages,
}: {
  items: readonly NavItem[]
  activeTo: string | undefined
  withPages: boolean
}) {
  return (
    <>
      <ul data-slot="app-shell-sheet-tiles" className="grid grid-cols-3 gap-2">
        {items.map((item) => {
          const { to, label, icon: Icon, count, countLabel } = item
          // "page" on the module's own page, "true" on one of its pages.
          const current = to === activeTo ? 'page' : childItems(item).some((child) => child.to === activeTo) ? 'true' : undefined
          return (
            <li key={to} className="flex min-w-0">
              <Link
                to={to}
                aria-current={current}
                className={`${TILE_CLASS} flex-1`}
              >
                <Icon aria-hidden="true" />
                <CountedLabel label={label} count={count} countLabel={countLabel} className="max-w-full break-words" />
                <TileCount count={count} />
              </Link>
            </li>
          )
        })}
      </ul>
      {withPages && <SheetPageTiles items={items} activeTo={activeTo} />}
    </>
  )
}

export function BottomBar({
  items,
  nav,
  activeTo,
  navLook = 'list',
}: {
  items: readonly BottomBarItem[]
  nav: readonly NavEntry[]
  activeTo: string | undefined
  /** The shell's `navLook`: a section's sheet follows its look when its item sets no `sheet`. */
  navLook?: NavLook
}) {
  // The section open, and the location it was opened at: following a link
  // in the sheet (or anywhere) moves to a new location, which closes it.
  const [opened, setOpened] = useState<{ group: string; at: string } | null>(null)
  const { key } = useLocation()
  const openGroup = opened?.at === key ? opened.group : null
  const setOpenGroup = (group: string | null) => setOpened(group === null ? null : { group, at: key })

  // At most five: a sixth wouldn't fit a phone's width with its label.
  const shown = items.slice(0, 5)
  const current = bottomBarCurrent(shown, nav, activeTo)
  const section = openGroup === null ? undefined : bottomBarSection(nav, openGroup)
  const openItem = shown.find((item) => 'group' in item && item.group === openGroup)
  const tiles = openItem !== undefined && bottomBarTiles(openItem, section, navLook)
  // The current entry's pages show under the tiles when the section's own look is tiles.
  const withPages = (section?.look ?? navLook) === 'tiles'

  return (
    <>
      <nav
        aria-label="Bottom bar"
        data-slot="app-shell-bottom-bar"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="flex h-16 items-stretch gap-1 px-2 py-1.5">
          {shown.map((item, index) => {
            const isCurrent = index === current
            const { count, countLabel } = bottomBarCount(item, nav)
            if ('to' in item) {
              return (
                <li key={`to:${item.to}`} className="flex min-w-0 flex-1">
                  <Link
                    to={item.to}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={ITEM_CLASS}
                  >
                    <BarIcon icon={item.icon} count={count} />
                    <CountedLabel label={item.label} count={count} countLabel={countLabel} className="max-w-full truncate" />
                  </Link>
                </li>
              )
            }
            const label = item.label ?? item.group
            return (
              <li key={`group:${item.group}`} className="flex min-w-0 flex-1">
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={openGroup === item.group}
                  // The page is in this section: "current" for a group, not a page.
                  aria-current={isCurrent ? 'true' : undefined}
                  onClick={() => setOpenGroup(item.group)}
                  className={ITEM_CLASS}
                >
                  <BarIcon icon={item.icon} count={count} />
                  <CountedLabel label={label} count={count} countLabel={countLabel} className="max-w-full truncate" />
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
      <Sheet open={section !== undefined} onOpenChange={(open) => !open && setOpenGroup(null)}>
        <SheetContent side="bottom" className="max-h-[80dvh] gap-2 pb-[calc(--spacing(4)+env(safe-area-inset-bottom))] md:hidden">
          {section && (
            <>
              <SheetHeader className="pb-0">
                <SheetTitle>{section.label}</SheetTitle>
              </SheetHeader>
              <nav aria-label={section.label} className="overflow-y-auto px-2">
                {tiles ? (
                  <SheetTiles items={section.items} activeTo={activeTo} withPages={withPages} />
                ) : (
                  <SheetChildren items={section.items} activeTo={activeTo} />
                )}
              </nav>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
