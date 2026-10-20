// AppShell's nav: how entries become sidebar groups, and which one entry is
// current (the most specific whose route matches). The rendered sidebar is
// checked in a real browser: e2e/app-shell.spec.ts, on the app/AppShell
// stories.
import { HomeIcon, ListIcon, TagIcon } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { activeNavTo, navGroups, type NavEntry, type NavItem } from '../src/components/app/app-shell-nav'

const home: NavItem = { to: '/', label: 'Home', icon: HomeIcon, end: true }
const tasks: NavItem = { to: '/tasks', label: 'Tasks', icon: ListIcon }
const categories: NavItem = { to: '/tasks/categories', label: 'Categories', icon: TagIcon }
const sectioned: NavEntry[] = [home, { label: 'Tasks', items: [tasks, categories] }]

describe('navGroups', () => {
  it('keeps a flat nav as the one "Navigation" group', () => {
    expect(navGroups([home, tasks])).toEqual([{ label: 'Navigation', items: [home, tasks] }])
  })

  it('gives each section its own labelled group, and plain runs an unlabelled one', () => {
    expect(navGroups([home, { label: 'Tasks', items: [tasks, categories] }, home])).toEqual([
      { items: [home] },
      { label: 'Tasks', items: [tasks, categories] },
      { items: [home] },
    ])
  })

  it('carries a collapsible section through, open by default unless it says otherwise', () => {
    expect(
      navGroups([
        { label: 'Tasks', items: [tasks], collapsible: true },
        { label: 'Reading', items: [categories], collapsible: true, defaultOpen: false },
        { label: 'Plain', items: [home] },
      ]),
    ).toStrictEqual([
      { label: 'Tasks', items: [tasks], collapsible: true, defaultOpen: true },
      { label: 'Reading', items: [categories], collapsible: true, defaultOpen: false },
      { label: 'Plain', items: [home] },
    ])
  })
})

describe('activeNavTo', () => {
  it.each([
    ['/', '/'],
    ['/tasks', '/tasks'],
    ['/tasks/3', '/tasks'],
    ['/tasks/categories', '/tasks/categories'],
    ['/tasks/categories/2', '/tasks/categories'],
  ])('on %s marks %s', (pathname, expected) => {
    expect(activeNavTo(sectioned, pathname)).toBe(expected)
  })

  it('matches on a path-segment boundary, not a string prefix', () => {
    expect(activeNavTo(sectioned, '/tasks-archive')).toBeUndefined()
  })

  it("keeps end: '/' with end is active only on '/'", () => {
    expect(activeNavTo([home], '/tasks')).toBeUndefined()
  })
})
