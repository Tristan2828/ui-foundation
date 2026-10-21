import type { ComponentType } from 'react'

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
  return [...new Set(nav.flatMap((entry) => (isNavSection(entry) ? entry.items : [entry]).map((item) => item.to)))]
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
  for (const entry of nav) {
    for (const item of isNavSection(entry) ? entry.items : [entry]) {
      const path = navPathname(item.to)
      if (matches(path, item.end, pathname) && path.length > bestLength) {
        best = item
        bestLength = path.length
      }
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
