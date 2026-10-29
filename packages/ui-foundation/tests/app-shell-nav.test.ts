// AppShell's nav: how entries become sidebar groups, which one entry is
// current (the most specific whose route matches, by the path of its `to`),
// and the page it names for the browser tab. The rendered sidebar is
// checked in a real browser: e2e/app-shell.spec.ts, on the app/AppShell
// stories.
import { HomeIcon, ListIcon, TagIcon } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import {
  activeNavTo,
  childrenOpen,
  navGroups,
  navPageLabel,
  navPathname,
  navTargets,
  type NavEntry,
  type NavItem,
} from '../src/components/app/app-shell-nav'

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

  // #188: a `to` that opens a list on a saved view.
  describe('a `to` with a query string', () => {
    const activeTasks: NavItem = { to: '/tasks?status=active&sort=name:asc', label: 'Active tasks', icon: ListIcon }
    const withQuery: NavEntry[] = [home, { label: 'Tasks', items: [activeTasks, categories] }]

    it.each([
      ['/tasks', activeTasks.to],
      ['/tasks/3', activeTasks.to],
      ['/tasks/categories/2', '/tasks/categories'],
    ])('on %s marks %s', (pathname, expected) => {
      expect(activeNavTo(withQuery, pathname)).toBe(expected)
    })

    it('is matched on its path, with a hash too', () => {
      expect(activeNavTo([{ ...tasks, to: '/tasks#open' }], '/tasks/3')).toBe('/tasks#open')
      expect(activeNavTo([{ ...tasks, to: '/tasks?x=1', end: true }], '/tasks')).toBe('/tasks?x=1')
      expect(activeNavTo([{ ...tasks, to: '/tasks?x=1', end: true }], '/tasks/3')).toBeUndefined()
    })

    it('is as specific as its path, not its whole string', () => {
      // The query makes '/tasks?…' longer than '/tasks/categories'; the path doesn't.
      expect(activeNavTo([{ ...activeTasks, to: '/tasks?status=active&sort=name:asc&page=1' }, categories], '/tasks/categories')).toBe(
        '/tasks/categories',
      )
    })
  })
})

describe('navPathname, navTargets', () => {
  it.each([
    ['/tasks', '/tasks'],
    ['/tasks?status=active', '/tasks'],
    ['/tasks#top', '/tasks'],
    ['/?tab=recent', '/'],
  ])('%s names the page %s', (to, expected) => {
    expect(navPathname(to)).toBe(expected)
  })

  it('lists every `to` once, as given, sections included', () => {
    const viewed: NavItem = { ...tasks, to: '/tasks?status=active' }
    expect(navTargets([home, { label: 'Tasks', items: [viewed, categories] }, home])).toEqual([
      '/',
      '/tasks?status=active',
      '/tasks/categories',
    ])
  })
})

describe('navPageLabel', () => {
  it.each([
    ['/tasks/3', 'Tasks'],
    ['/tasks/categories/2', 'Categories'],
  ])('on %s names %s', (pathname, expected) => {
    expect(navPageLabel(sectioned, pathname)).toBe(expected)
  })

  it('names no page on the home entry, nor where no entry matches', () => {
    expect(navPageLabel(sectioned, '/')).toBeUndefined()
    expect(navPageLabel([tasks], '/elsewhere')).toBeUndefined()
    // A home entry without `end` matches everywhere else too.
    expect(navPageLabel([{ ...home, end: false }, tasks], '/elsewhere')).toBeUndefined()
    expect(navPageLabel([{ ...home, end: false }, tasks], '/tasks')).toBe('Tasks')
  })

  it('names an entry whose `to` has a query string', () => {
    expect(navPageLabel([home, { ...tasks, to: '/tasks?status=active', label: 'Active' }], '/tasks/3')).toBe('Active')
  })
})

// #239: a module's own pages under its entry.
describe('children', () => {
  const channels: NavItem = { to: '/media/channels', label: 'Channels', icon: TagIcon }
  const playlists: NavItem = { to: '/media/playlists', label: 'Playlists', icon: TagIcon }
  const youtube: NavItem = { to: '/media/videos', label: 'YouTube', icon: ListIcon, children: [channels, playlists] }
  const nested: NavEntry[] = [home, { label: 'Collections', items: [youtube] }]

  it('are pages of the nav: listed after their parent, current, and naming the tab', () => {
    expect(navTargets(nested)).toEqual(['/', '/media/videos', '/media/channels', '/media/playlists'])
    expect(activeNavTo(nested, '/media/channels/3')).toBe('/media/channels')
    expect(activeNavTo(nested, '/media/videos/9')).toBe('/media/videos')
    expect(navPageLabel(nested, '/media/playlists')).toBe('Playlists')
  })

  it("show while the page is the parent or one of them, or always with open: 'always'", () => {
    expect(childrenOpen(youtube, '/media/videos')).toBe(true)
    expect(childrenOpen(youtube, '/media/channels')).toBe(true)
    expect(childrenOpen(youtube, '/')).toBe(false)
    expect(childrenOpen({ ...youtube, open: 'always' }, '/')).toBe(true)
    expect(childrenOpen(home, '/')).toBe(false)
  })
})
