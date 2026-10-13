import type { ComponentType } from 'react'

export type NavItem = {
  /** The route this entry links to. */
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
      groups.push({ label: entry.label, items: entry.items })
    } else {
      run.push(entry)
    }
  }
  if (run.length) groups.push({ items: run })
  return groups
}

function matches(item: NavItem, pathname: string): boolean {
  if (item.end) return pathname === item.to
  if (pathname === item.to) return true
  // On a path-segment boundary: '/tasks' is active on '/tasks/3', not on
  // '/tasks-archive'.
  return pathname.startsWith(item.to.endsWith('/') ? item.to : `${item.to}/`)
}

/**
 * The `to` of the one entry to mark active: the most specific that matches.
 * With '/tasks' and '/tasks/categories' both in the nav, '/tasks/categories/2'
 * marks Categories only, and '/tasks/3' marks Tasks.
 */
export function activeNavTo(nav: readonly NavEntry[], pathname: string): string | undefined {
  let best: string | undefined
  for (const entry of nav) {
    for (const item of isNavSection(entry) ? entry.items : [entry]) {
      if (matches(item, pathname) && (best === undefined || item.to.length > best.length)) best = item.to
    }
  }
  return best
}
