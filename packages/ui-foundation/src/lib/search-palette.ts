// The search palette's logic (src/components/app/search-palette.tsx,
// AppShell's `search`, #N6): the nav's pages filtered by name, the app's
// records grouped by kind, and the records opened lately, remembered on
// the device. Pure, apart from the storage the recent records are kept in.
import { childItems, isNavSection, type NavEntry } from '@/components/app/app-shell-nav'

/**
 * One record the app's `findRecords` found: its title, the page it opens
 * (`to`, through the router), the heading it's listed under (`kind`,
 * "Exercises"; "Records" without one), and a grey word beside it
 * (`detail`, the module it's in, say).
 */
export type SearchRecord = {
  title: string
  to: string
  kind?: string
  detail?: string
}

/** A record opened lately (`useRecentRecord`), as the palette lists it before you type. */
export type RecentRecord = {
  title: string
  to: string
  /** A grey word beside it, as a found record's `detail`. */
  detail?: string
}

/** A nav page as the palette lists it: "Finance · Accounts" for a module's own page. */
export type SearchPage = { label: string; name: string; to: string }

/** Every page in the nav, each once, a module's own pages named with their module. */
export function searchPages(nav: readonly NavEntry[]): SearchPage[] {
  const seen = new Set<string>()
  const pages: SearchPage[] = []
  const add = (page: SearchPage) => {
    if (seen.has(page.to)) return
    seen.add(page.to)
    pages.push(page)
  }
  for (const entry of nav) {
    for (const item of isNavSection(entry) ? entry.items : [entry]) {
      add({ label: item.label, name: item.label, to: item.to })
      for (const child of childItems(item)) add({ label: `${item.label} · ${child.label}`, name: child.label, to: child.to })
    }
  }
  return pages
}

// How close a name is to the text: the whole name, then a name starting
// with it, then a word starting with it, then anywhere. -1 is no match.
function closeness(name: string, text: string): number {
  const lower = name.toLowerCase()
  if (lower === text) return 0
  if (lower.startsWith(text)) return 1
  if (lower.split(/[\s·/-]+/).some((word) => word.startsWith(text))) return 2
  return lower.includes(text) ? 3 : -1
}

/**
 * The pages whose name (or module and name) has the text in it, the
 * closest first, then the nav's order; at most `limit`. No text: the
 * first `limit` pages.
 */
export function matchPages(pages: readonly SearchPage[], query: string, limit: number): SearchPage[] {
  const text = query.trim().toLowerCase()
  if (!text) return pages.slice(0, limit)
  return pages
    .map((page, index) => {
      const own = closeness(page.name, text)
      const full = closeness(page.label, text)
      // The page's own name counts first; its module's name next.
      const score = own >= 0 ? own : full >= 0 ? full + 4 : -1
      return { page, index, score }
    })
    .filter((match) => match.score >= 0)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map((match) => match.page)
}

/** The records under their kinds, each kind once, in the order its first record came. */
export function groupRecords(records: readonly SearchRecord[]): { kind: string; records: SearchRecord[] }[] {
  const groups = new Map<string, SearchRecord[]>()
  for (const record of records) {
    const kind = record.kind?.trim() || 'Records'
    const group = groups.get(kind)
    if (group) group.push(record)
    else groups.set(kind, [record])
  }
  return [...groups].map(([kind, list]) => ({ kind, records: list }))
}

// ---- The records opened lately, on this device ----

export const RECENT_RECORDS_KEY = 'ui-foundation:recent-records'
/** How many are kept; the palette shows its `recent` of them. */
export const RECENT_RECORDS_KEPT = 20

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function storage(): StorageLike | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isRecent(value: unknown): value is RecentRecord {
  if (typeof value !== 'object' || value === null) return false
  const { title, to, detail } = value as Record<string, unknown>
  return typeof title === 'string' && typeof to === 'string' && (detail === undefined || typeof detail === 'string')
}

/** The records opened lately, the latest first. Nothing when storage is missing or holds something else. */
export function readRecentRecords(store: StorageLike | null = storage()): RecentRecord[] {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(RECENT_RECORDS_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isRecent) : []
  } catch {
    return []
  }
}

/** Puts a record first among the recent ones (once, by its `to`), keeping the latest RECENT_RECORDS_KEPT. */
export function rememberRecentRecord(record: RecentRecord, store: StorageLike | null = storage()): void {
  const entry: RecentRecord = { title: record.title, to: record.to, ...(record.detail ? { detail: record.detail } : {}) }
  const next = [entry, ...readRecentRecords(store).filter((other) => other.to !== record.to)].slice(0, RECENT_RECORDS_KEPT)
  try {
    store?.setItem(RECENT_RECORDS_KEY, JSON.stringify(next))
  } catch {
    // Not remembered: storage is full or refused (a private window).
  }
}

/** Forgets every recent record (AppShell does on logout, so the next person doesn't see them). */
export function clearRecentRecords(store: StorageLike | null = storage()): void {
  try {
    store?.removeItem(RECENT_RECORDS_KEY)
  } catch {
    // Nothing to forget.
  }
}
