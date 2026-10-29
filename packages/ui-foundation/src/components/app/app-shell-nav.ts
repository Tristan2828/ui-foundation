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
   */
  children?: readonly NavItem[]
  /** When `children` show: while you're in them (`'current'`, the default) or `'always'`. */
  open?: 'current' | 'always'
}

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
}

/**
 * The sidebar groups for a nav, in order. A flat nav (no sections) is the
 * one "Navigation" group it always was. Otherwise each section is its own
 * labelled group, and each run of plain items between them an unlabelled one.
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
      })
    } else {
      run.push(entry)
    }
  }
  if (run.length) groups.push({ items: run })
  return groups
}

/** Each item and, after it, its children: every page a list of items links. */
export function withChildren(items: readonly NavItem[]): NavItem[] {
  return items.flatMap((item) => [item, ...(item.children ?? [])])
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
  return item.open === 'always' || item.to === activeTo || item.children.some((child) => child.to === activeTo)
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
 * One item of `AppShell`'s `bottomBar`, the phone's bar of shortcuts: a
 * page, or one of the nav's sections by its label, which opens a sheet of
 * that section's entries. `label` is a shorter name for the bar
 * ("Household" for "Home and money").
 */
export type BottomBarItem =
  | { to: string; label: string; icon: IconComponent }
  | { group: string; label?: string; icon: IconComponent }

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
