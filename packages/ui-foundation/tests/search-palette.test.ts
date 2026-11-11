// The search palette's logic (AppShell's `search`, #N6): the nav's pages
// and how they match, the records under their kinds, and the records
// opened lately. The palette itself is checked in a browser:
// e2e/app-shell-trail-search.spec.ts.
import { HomeIcon, LandmarkIcon, ListIcon, WalletIcon } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import type { NavEntry } from '../src/components/app/app-shell-nav'
import {
  clearRecentRecords,
  groupRecords,
  matchPages,
  readRecentRecords,
  RECENT_RECORDS_KEPT,
  RECENT_RECORDS_KEY,
  rememberRecentRecord,
  searchPages,
} from '../src/lib/search-palette'

const nav: NavEntry[] = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  {
    label: 'Home and money',
    items: [
      { to: '/tasks', label: 'Tasks', icon: ListIcon },
      {
        to: '/finance',
        label: 'Finance',
        icon: WalletIcon,
        children: [
          { label: 'Money', items: [{ to: '/finance/accounts', label: 'Accounts', icon: LandmarkIcon }] },
          { to: '/finance/budget', label: 'Budget', icon: ListIcon },
        ],
      },
    ],
  },
  { label: 'Tools', placement: 'bottom', items: [{ to: '/tasks', label: 'Tasks again', icon: ListIcon }] },
]

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

describe('searchPages', () => {
  it("lists every page once, a module's own named with it", () => {
    expect(searchPages(nav)).toEqual([
      { label: 'Home', name: 'Home', to: '/' },
      { label: 'Tasks', name: 'Tasks', to: '/tasks' },
      { label: 'Finance', name: 'Finance', to: '/finance' },
      { label: 'Finance · Accounts', name: 'Accounts', to: '/finance/accounts' },
      { label: 'Finance · Budget', name: 'Budget', to: '/finance/budget' },
    ])
  })
})

describe('matchPages', () => {
  const pages = searchPages(nav)
  const labels = (query: string, limit = 10) => matchPages(pages, query, limit).map((page) => page.label)

  it('puts the closest name first: whole, starting, a word, anywhere, then the module', () => {
    expect(labels('budget')).toEqual(['Finance · Budget'])
    expect(labels('fin')).toEqual(['Finance', 'Finance · Accounts', 'Finance · Budget'])
    expect(labels('ount')).toEqual(['Finance · Accounts'])
    expect(labels('  TASKS ')).toEqual(['Tasks'])
  })

  it('finds nothing for a name no page has, and the first pages for no text', () => {
    expect(labels('lamp')).toEqual([])
    expect(labels('   ', 2)).toEqual(['Home', 'Tasks'])
  })

  it('stops at the limit', () => {
    expect(labels('a', 2)).toHaveLength(2)
  })
})

describe('groupRecords', () => {
  it('lists each kind once, in the order its first record came, and records with none under Records', () => {
    expect(
      groupRecords([
        { title: 'A', to: '/a', kind: 'Tasks' },
        { title: 'B', to: '/b' },
        { title: 'C', to: '/c', kind: 'Books' },
        { title: 'D', to: '/d', kind: 'Tasks' },
      ]),
    ).toEqual([
      {
        kind: 'Tasks',
        records: [
          { title: 'A', to: '/a', kind: 'Tasks' },
          { title: 'D', to: '/d', kind: 'Tasks' },
        ],
      },
      { kind: 'Records', records: [{ title: 'B', to: '/b' }] },
      { kind: 'Books', records: [{ title: 'C', to: '/c', kind: 'Books' }] },
    ])
  })
})

describe('recent records', () => {
  it('keeps the latest first, each once by where it goes', () => {
    const store = memoryStorage()
    rememberRecentRecord({ title: 'Fix the gate', to: '/tasks/3' }, store)
    rememberRecentRecord({ title: 'Dune', to: '/books/2', detail: 'Book' }, store)
    rememberRecentRecord({ title: 'Fix the gate latch', to: '/tasks/3' }, store)
    expect(readRecentRecords(store)).toEqual([
      { title: 'Fix the gate latch', to: '/tasks/3' },
      { title: 'Dune', to: '/books/2', detail: 'Book' },
    ])
  })

  it(`keeps only the latest ${RECENT_RECORDS_KEPT}`, () => {
    const store = memoryStorage()
    for (let index = 0; index < RECENT_RECORDS_KEPT + 5; index++)
      rememberRecentRecord({ title: `R${index}`, to: `/r/${index}` }, store)
    const recent = readRecentRecords(store)
    expect(recent).toHaveLength(RECENT_RECORDS_KEPT)
    expect(recent[0]).toEqual({ title: `R${RECENT_RECORDS_KEPT + 4}`, to: `/r/${RECENT_RECORDS_KEPT + 4}` })
  })

  it('reads nothing from storage holding something else, or no storage', () => {
    expect(readRecentRecords(memoryStorage({ [RECENT_RECORDS_KEY]: 'not json' }))).toEqual([])
    expect(readRecentRecords(memoryStorage({ [RECENT_RECORDS_KEY]: '{"title":"x"}' }))).toEqual([])
    expect(
      readRecentRecords(memoryStorage({ [RECENT_RECORDS_KEY]: '[{"title":"x","to":"/x"},{"title":1}]' })),
    ).toEqual([{ title: 'x', to: '/x' }])
    expect(readRecentRecords(null)).toEqual([])
  })

  it('forgets them all', () => {
    const store = memoryStorage()
    rememberRecentRecord({ title: 'Dune', to: '/books/2' }, store)
    clearRecentRecords(store)
    expect(readRecentRecords(store)).toEqual([])
  })
})
