// AppShell's bottom bar on a phone (#240): Home and a few of the nav's
// sections in thumb reach, where the sidebar is a sheet behind the
// header's menu button. An item is a link, or a nav section by its label,
// which opens a sheet from the bottom listing that section's entries (and
// their children, under them, by heading where they have them), or with
// `sheet: 'tiles'` a grid of the entries as tiles, icon over label, like
// a phone's home screen. The sheet closes on navigation, as the
// sidebar's does. The item holding the current page is marked
// (`aria-current`). Shown below the md breakpoint only (the sidebar's own
// mobile breakpoint); the shell pads its content by the bar's height and
// the phone's safe area, so a page's last row clears it.
import { useId, useState } from 'react'
import { Link, useLocation } from 'react-router'
import {
  bottomBarCurrent,
  bottomBarSection,
  bottomBarTiles,
  childItems,
  childRuns,
  childrenOpen,
  isNavItemGroup,
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
  '[&>svg]:size-5 [&>svg]:shrink-0'

const SHEET_LINK_CLASS =
  'flex min-h-11 items-center gap-3 rounded-md px-3 type-body text-foreground outline-none ' +
  'hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-accent aria-[current=page]:font-medium ' +
  '[&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground'

/**
 * What the shell pads its content's bottom by on a phone: its own p-6,
 * plus the bar (4rem and its 1px border) and the phone's safe area.
 */
export const BOTTOM_BAR_PADDING = 'max-md:pb-[calc(--spacing(22)+1px+env(safe-area-inset-bottom))]'

// A tile: the entry's icon over its label, a finger's target at least.
const TILE_CLASS =
  'flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-background px-1.5 py-2.5 ' +
  'text-center type-caption text-foreground outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 ' +
  'aria-[current]:border-primary aria-[current]:font-medium [&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:text-link'

function SheetLink({ item, activeTo }: { item: NavItem; activeTo: string | undefined }) {
  const { to, label, icon: Icon, children } = item
  return (
    <li>
      <Link to={to} aria-current={to === activeTo ? 'page' : undefined} className={SHEET_LINK_CLASS}>
        <Icon />
        <span className="truncate">{label}</span>
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
  'flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-center type-caption ' +
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
            {run.items.map(({ to, label, icon: Icon }) => (
              <li key={to} className="flex min-w-0">
                <Link to={to} aria-current={to === activeTo ? 'page' : undefined} className={PAGE_TILE_CLASS}>
                  <Icon aria-hidden="true" />
                  <span className="max-w-full break-words">{label}</span>
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
          const { to, label, icon: Icon } = item
          // "page" on the module's own page, "true" on one of its pages.
          const current = to === activeTo ? 'page' : childItems(item).some((child) => child.to === activeTo) ? 'true' : undefined
          return (
            <li key={to} className="flex min-w-0">
              <Link to={to} aria-current={current} className={`${TILE_CLASS} flex-1`}>
                <Icon aria-hidden="true" />
                <span className="max-w-full break-words">{label}</span>
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
            const Icon = item.icon
            const isCurrent = index === current
            if ('to' in item) {
              return (
                <li key={`to:${item.to}`} className="flex min-w-0 flex-1">
                  <Link
                    to={item.to}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={ITEM_CLASS}
                  >
                    <Icon aria-hidden="true" />
                    <span className="max-w-full truncate">{item.label}</span>
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
                  <Icon aria-hidden="true" />
                  <span className="max-w-full truncate">{label}</span>
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
