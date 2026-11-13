import type { ComponentType } from 'react'
import type { IconComponent } from '@/components/app/icon-component'

export type NavItem = {
  /**
   * The route this entry links to. It may carry a query string, to open a
   * list on a saved view ('/widgets?status=active'): the entry is matched
   * on its path alone, so it's still current anywhere under /widgets.
   */
  to: string
  label: string
  icon: ComponentType
  /** Active only on an exact match (use for '/'); otherwise on any sub-path too. */
  end?: boolean
  /**
   * A module's own pages, listed under this entry (one level deep): its
   * channels under YouTube, its series under Comics. They show while the
   * page is this entry or one of them (`open: 'current'`), or always
   * (`'always'`). On the icon rail they're named in this entry's tooltip.
   * A long module's pages can sit under small headings: a child can be a
   * group (`{ label: 'Money', items }`), and the tooltip then names the
   * headings.
   */
  children?: readonly NavChild[]
  /** When `children` show: while you're in them (`'current'`, the default) or `'always'`. */
  open?: 'current' | 'always'
  /**
   * A number on the entry that asks you to act (unread articles, records
   * to fill in), drawn at its end in the muted tone; a dot on the icon
   * rail. None, or 0, shows nothing. The app passes it from a query.
   */
  count?: number
  /**
   * What the count counts, for screen readers: 'unread' reads "24
   * unread". Without it the number is read alone.
   */
  countLabel?: string
}

/**
 * A small heading over some of a module's pages, in its entry's
 * `children`: Finance's Money, Spending and Taxes.
 */
export type NavItemGroup = {
  label: string
  items: readonly NavItem[]
}

/** One of an entry's `children`: a page, or a heading over pages. */
export type NavChild = NavItem | NavItemGroup

export function isNavItemGroup(child: NavChild): child is NavItemGroup {
  return 'items' in child
}

/** An entry's pages, its groups' included, in order. */
export function childItems(item: NavItem): NavItem[] {
  return (item.children ?? []).flatMap((child) => (isNavItemGroup(child) ? child.items : [child]))
}

/**
 * The rail's tooltip for an entry: its label, then what's under it, by
 * heading where it has them ("Finance: Money, Spending, Taxes").
 */
export function navTooltip(item: NavItem): string {
  const children = item.children ?? []
  if (!children.length) return item.label
  return `${item.label}: ${children.map((child) => child.label).join(', ')}`
}

/**
 * How a sidebar group draws its entries: a list, icon beside label
 * (`'list'`, the default), or a grid of tiles, icon over a short label,
 * three to a row, with no visible heading (`'tiles'`). Set for the whole
 * nav with `AppShell`'s `navLook`, or per section with its `look`.
 */
export type NavLook = 'list' | 'tiles'

/** A labelled group of sidebar entries: one module's pages, say. */
export type NavSection = {
  label: string
  items: readonly NavItem[]
  /**
   * The label folds the section away: a button with a chevron. Whether
   * it's open is remembered per browser, by the section's label. The
   * section holding the page you're on is always open, and the icon rail
   * shows every section's items whatever their state.
   */
  collapsible?: boolean
  /** Whether a collapsible section starts open for someone who has never folded it. Defaults to true. */
  defaultOpen?: boolean
  /**
   * Where the section sits: in order with the rest (`'top'`, the
   * default), or at the sidebar's foot, under every other section
   * (`'bottom'`: a Tools group, say).
   */
  placement?: 'top' | 'bottom'
  /**
   * This section's look, over `AppShell`'s `navLook`: `'tiles'` draws its
   * entries as a grid of icon tiles, its label kept for screen readers
   * only, and the current entry's pages listed under the grid. A tiles
   * section doesn't fold (`collapsible` is ignored). On the icon rail it's
   * the rail's icons, as any section. A `bottomBar` item for it opens its
   * sheet as tiles too, the current entry's pages under them.
   */
  look?: NavLook
}

/** One entry of `AppShell`'s `nav`: a page, or a labelled section of pages. */
export type NavEntry = NavItem | NavSection

export function isNavSection(entry: NavEntry): entry is NavSection {
  return 'items' in entry
}

/** A sidebar group as rendered: an optional label over its items. */
export type NavGroup = {
  label?: string
  items: readonly NavItem[]
  /** From its section: the label folds it (NavSection's `collapsible`). */
  collapsible?: boolean
  defaultOpen?: boolean
  /** From its section: at the sidebar's foot (NavSection's `placement`). */
  placement?: 'bottom'
  /** From its section: its own look (NavSection's `look`), over the shell's. */
  look?: NavLook
}

/**
 * The sidebar groups for a nav, in order. A flat nav (no sections) is the
 * one "Navigation" group it always was. Otherwise each section is its own
 * labelled group, and each run of plain items between them an unlabelled one.
 * Sections placed at the bottom come last, in their own order.
 */
export function navGroups(nav: readonly NavEntry[]): NavGroup[] {
  if (!nav.some(isNavSection)) return [{ label: 'Navigation', items: nav as readonly NavItem[] }]
  const groups: NavGroup[] = []
  let run: NavItem[] = []
  for (const entry of nav) {
    if (isNavSection(entry)) {
      if (run.length) groups.push({ items: run })
      run = []
      groups.push({
        label: entry.label,
        items: entry.items,
        ...(entry.collapsible && { collapsible: true, defaultOpen: entry.defaultOpen ?? true }),
        ...(entry.placement === 'bottom' && { placement: 'bottom' as const }),
        ...(entry.look && { look: entry.look }),
      })
    } else {
      run.push(entry)
    }
  }
  if (run.length) groups.push({ items: run })
  return [...groups.filter((group) => !group.placement), ...groups.filter((group) => group.placement)]
}

/** Each item and, after it, its children: every page a list of items links. */
export function withChildren(items: readonly NavItem[]): NavItem[] {
  return items.flatMap((item) => [item, ...childItems(item)])
}

/** Every page in a nav, sections' items and children included, in order. */
export function navItems(nav: readonly NavEntry[]): NavItem[] {
  return nav.flatMap((entry) => withChildren(isNavSection(entry) ? entry.items : [entry]))
}

/**
 * Whether an item's children show: always, or while the current page
 * (`activeTo`) is the item or one of its children.
 */
export function childrenOpen(item: NavItem, activeTo: string | undefined): boolean {
  if (!item.children?.length) return false
  return item.open === 'always' || item.to === activeTo || childItems(item).some((child) => child.to === activeTo)
}

/**
 * The path a `to` names, without its query string or hash: what an entry is
 * matched on, and what the a11y suite compares with the rendered sidebar.
 */
export function navPathname(to: string): string {
  const end = to.search(/[?#]/)
  return end === -1 ? to : to.slice(0, end)
}

/** Every `to` in a nav, each once, in order: the pages its sidebar links. */
export function navTargets(nav: readonly NavEntry[]): string[] {
  return [...new Set(navItems(nav).map((item) => item.to))]
}

function matches(path: string, end: boolean | undefined, pathname: string): boolean {
  if (end) return pathname === path
  if (pathname === path) return true
  // On a path-segment boundary: '/tasks' is active on '/tasks/3', not on
  // '/tasks-archive'.
  return pathname.startsWith(path.endsWith('/') ? path : `${path}/`)
}

/**
 * The one entry to mark active: the most specific that matches, by the path
 * of its `to` (its query string ignored). With '/tasks' and
 * '/tasks/categories' both in the nav, '/tasks/categories/2' marks
 * Categories only, and '/tasks/3' marks Tasks. Of two entries with the same
 * path, the first.
 */
export function activeNavItem(nav: readonly NavEntry[], pathname: string): NavItem | undefined {
  let best: NavItem | undefined
  let bestLength = -1
  for (const item of navItems(nav)) {
    const path = navPathname(item.to)
    if (matches(path, item.end, pathname) && path.length > bestLength) {
      best = item
      bestLength = path.length
    }
  }
  return best
}

/** The `to` of the one entry to mark active (`activeNavItem`). */
export function activeNavTo(nav: readonly NavEntry[], pathname: string): string | undefined {
  return activeNavItem(nav, pathname)?.to
}

/**
 * The page the nav names for `pathname`, for the browser tab: the active
 * entry's label. None on the home entry ('/'), whose page is the app
 * itself, or on a page no entry covers.
 */
export function navPageLabel(nav: readonly NavEntry[], pathname: string): string | undefined {
  const item = activeNavItem(nav, pathname)
  return item && navPathname(item.to) !== '/' ? item.label : undefined
}

/**
 * Where a phone's back arrow goes: the current entry, when the page is
 * below it (a record under Accounts reads "‹ Accounts"). None on an
 * entry's own page, or a page no entry covers: the header keeps its menu
 * button there.
 */
export function navBackTarget(nav: readonly NavEntry[], pathname: string): { label: string; to: string } | undefined {
  const item = activeNavItem(nav, pathname)
  if (!item) return undefined
  const path = navPathname(item.to)
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return trimmed === path ? undefined : { label: item.label, to: item.to }
}

/**
 * The bar's trail for a page that names none of its own (#N5): the active
 * entry, after the entry it sits under when it's one of a module's own
 * pages ("Finance / Accounts"). The entry is the trail's last crumb even
 * on a page below it. Nothing on a page no entry covers.
 */
export function navTrail(nav: readonly NavEntry[], pathname: string): { label: string; href?: string }[] {
  const item = activeNavItem(nav, pathname)
  if (!item) return []
  const parent = navItems(nav).find((other) => childItems(other).includes(item))
  return parent ? [{ label: parent.label, href: parent.to }, { label: item.label }] : [{ label: item.label }]
}

/**
 * Where a phone's back arrow goes once a page has put up a trail of its
 * own (`usePageTrail`): the closest crumb above the page that links
 * somewhere, on a page below a nav entry (or one no entry covers), and
 * otherwise the entry (`navBackTarget`). An entry's own page keeps the
 * menu button, whatever its trail.
 */
export function trailBackTarget(
  nav: readonly NavEntry[],
  pathname: string,
  trail: readonly { label: string; href?: string }[] | null,
): { label: string; to: string } | undefined {
  const fromNav = navBackTarget(nav, pathname)
  if (!fromNav && activeNavItem(nav, pathname)) return undefined
  const above = trail
    ?.slice(0, -1)
    .reverse()
    .find((crumb) => crumb.href)
  return above?.href ? { label: above.label, to: above.href } : fromNav
}

/**
 * One item of `AppShell`'s `bottomBar`, the phone's bar of shortcuts: a
 * page, or one of the nav's sections by its label, which opens a sheet of
 * that section's entries. `label` is a shorter name for the bar
 * ("Household" for "Home and money").
 */
export type BottomBarItem =
  | { to: string; label: string; icon: IconComponent }
  | {
      group: string
      label?: string
      icon: IconComponent
      /**
       * How its sheet shows the section: a list of its entries with their
       * pages (`'list'`, the default), or a grid of tiles, one per entry,
       * icon over label, like a phone's home screen (`'tiles'`). Without
       * it, the section's look decides (`NavSection.look`, `navLook`).
       */
      sheet?: 'list' | 'tiles'
    }

/**
 * Whether a bottom bar item's sheet is tiles: its own `sheet`, or else
 * its section's look (the section's `look`, or the shell's `navLook`).
 */
export function bottomBarTiles(
  item: BottomBarItem,
  section: NavSection | undefined,
  navLook: NavLook = 'list',
): boolean {
  if (!('group' in item)) return false
  if (item.sheet) return item.sheet === 'tiles'
  return (section?.look ?? navLook) === 'tiles'
}

/**
 * The runs of an entry's pages, for a look with no headings: each group
 * its own run, named by its label, and each run of plain pages between
 * them an unnamed one.
 */
export function childRuns(item: NavItem): { label?: string; items: NavItem[] }[] {
  const runs: { label?: string; items: NavItem[] }[] = []
  let run: NavItem[] = []
  for (const child of item.children ?? []) {
    if (isNavItemGroup(child)) {
      if (run.length) runs.push({ items: run })
      run = []
      runs.push({ label: child.label, items: [...child.items] })
    } else {
      run.push(child)
    }
  }
  if (run.length) runs.push({ items: run })
  return runs
}

/** The nav's section with this label, if there is one. */
export function bottomBarSection(nav: readonly NavEntry[], label: string): NavSection | undefined {
  return nav.find((entry): entry is NavSection => isNavSection(entry) && entry.label === label)
}

/**
 * Which bar item holds the current page (`activeTo`, from activeNavTo):
 * the page's own link, or else the section it's in, children included.
 */
export function bottomBarCurrent(
  items: readonly BottomBarItem[],
  nav: readonly NavEntry[],
  activeTo: string | undefined,
): number | undefined {
  if (activeTo === undefined) return undefined
  const link = items.findIndex((item) => 'to' in item && item.to === activeTo)
  if (link !== -1) return link
  const group = items.findIndex(
    (item) =>
      'group' in item && withChildren(bottomBarSection(nav, item.group)?.items ?? []).some((entry) => entry.to === activeTo),
  )
  return group === -1 ? undefined : group
}
