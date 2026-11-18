// AppShell's nav: how entries become sidebar groups, which one entry is
// current (the most specific whose route matches, by the path of its `to`),
// and the page it names for the browser tab. The rendered sidebar is
// checked in a real browser: e2e/app-shell.spec.ts, on the app/AppShell
// stories.
import { HomeIcon, ListIcon, TagIcon } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import {
  activeNavTo,
  bottomBarCount,
  bottomBarCurrent,
  bottomBarTiles,
  childItems,
  childRuns,
  childrenOpen,
  navBackTarget,
  navCountSpoken,
  navCountText,
  navGroups,
  navTooltip,
  navPageLabel,
  navPathname,
  navTargets,
  navTrail,
  trailBackTarget,
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

// #240: which item of the phone's bottom bar holds the current page.
describe('bottomBarCurrent', () => {
  const channels: NavItem = { to: '/media/channels', label: 'Channels', icon: TagIcon }
  const youtube: NavItem = { to: '/media/videos', label: 'YouTube', icon: ListIcon, children: [channels] }
  const nav: NavEntry[] = [home, { label: 'Collections', items: [youtube] }, { label: 'Tasks', items: [tasks, categories] }]
  const bar = [
    { to: '/', label: 'Home', icon: HomeIcon },
    { group: 'Collections', icon: ListIcon },
    { group: 'Tasks', icon: ListIcon },
    { to: '/tasks/categories', label: 'Categories', icon: TagIcon },
  ]

  it("is a page's own link first, else the section it's in, children included", () => {
    expect(bottomBarCurrent(bar, nav, '/')).toBe(0)
    expect(bottomBarCurrent(bar, nav, '/media/channels')).toBe(1)
    expect(bottomBarCurrent(bar, nav, '/tasks')).toBe(2)
    expect(bottomBarCurrent(bar, nav, '/tasks/categories')).toBe(3)
  })

  it('is none off the nav, or for a section the nav lacks', () => {
    expect(bottomBarCurrent(bar, nav, undefined)).toBeUndefined()
    expect(bottomBarCurrent([{ group: 'Missing', icon: ListIcon }], nav, '/tasks')).toBeUndefined()
  })
})

// N1: headings among a module's pages.
describe('children under headings', () => {
  const accounts: NavItem = { to: '/finance/accounts', label: 'Accounts', icon: TagIcon }
  const budget: NavItem = { to: '/finance/budget', label: 'Budget', icon: TagIcon }
  const taxes: NavItem = { to: '/finance/taxes', label: 'Taxes', icon: TagIcon }
  const finance: NavItem = {
    to: '/finance',
    label: 'Finance',
    icon: ListIcon,
    children: [{ label: 'Money', items: [accounts] }, { label: 'Spending', items: [budget] }, taxes],
  }
  const nav: NavEntry[] = [home, { label: 'Home and money', items: [finance] }]

  it("are the groups' pages, in order, as pages of the nav", () => {
    expect(childItems(finance)).toEqual([accounts, budget, taxes])
    expect(navTargets(nav)).toEqual(['/', '/finance', '/finance/accounts', '/finance/budget', '/finance/taxes'])
    expect(activeNavTo(nav, '/finance/budget/4')).toBe('/finance/budget')
    expect(childrenOpen(finance, '/finance/accounts')).toBe(true)
    expect(childrenOpen(finance, '/')).toBe(false)
    expect(bottomBarCurrent([{ group: 'Home and money', icon: ListIcon }], nav, '/finance/accounts')).toBe(0)
  })

  it("name the rail's tooltip by heading", () => {
    expect(navTooltip(finance)).toBe('Finance: Money, Spending, Taxes')
    expect(navTooltip(home)).toBe('Home')
  })
})

// N4: a section at the sidebar's foot.
describe("placement: 'bottom'", () => {
  it('puts the section after every other group, keeping the rest in order', () => {
    const tools = { label: 'Tools', placement: 'bottom' as const, items: [categories] }
    expect(navGroups([home, tools, { label: 'Tasks', items: [tasks] }])).toStrictEqual([
      { items: [home] },
      { label: 'Tasks', items: [tasks] },
      { label: 'Tools', items: [categories], placement: 'bottom' },
    ])
  })
})

// N7: where a phone's back arrow goes.
describe('navBackTarget', () => {
  it('is the current entry on a page below it', () => {
    expect(navBackTarget(sectioned, '/tasks/3')).toEqual({ label: 'Tasks', to: '/tasks' })
    expect(navBackTarget(sectioned, '/tasks/categories/2/edit')).toEqual({ label: 'Categories', to: '/tasks/categories' })
  })

  it("keeps an entry's query string, the view it opens on", () => {
    expect(navBackTarget([{ ...tasks, to: '/tasks?status=open' }], '/tasks/3')).toEqual({ label: 'Tasks', to: '/tasks?status=open' })
  })

  it("is none on an entry's own page, or off the nav", () => {
    expect(navBackTarget(sectioned, '/tasks')).toBeUndefined()
    expect(navBackTarget(sectioned, '/tasks/')).toBeUndefined()
    expect(navBackTarget(sectioned, '/')).toBeUndefined()
    expect(navBackTarget(sectioned, '/elsewhere')).toBeUndefined()
  })
})

describe('navTrail', () => {
  const finance: NavItem = {
    to: '/finance',
    label: 'Finance',
    icon: ListIcon,
    children: [{ label: 'Money', items: [{ to: '/finance/accounts', label: 'Accounts', icon: TagIcon }] }],
  }
  const nav: NavEntry[] = [home, { label: 'Home and money', items: [finance] }]

  it("is the entry, after its module's when it's one of the module's pages", () => {
    expect(navTrail(nav, '/finance/accounts')).toEqual([{ label: 'Finance', href: '/finance' }, { label: 'Accounts' }])
    expect(navTrail(nav, '/finance/accounts/3')).toEqual([{ label: 'Finance', href: '/finance' }, { label: 'Accounts' }])
    expect(navTrail(nav, '/finance')).toEqual([{ label: 'Finance' }])
  })

  it('is Home on the hub, and nothing off the nav', () => {
    expect(navTrail(nav, '/')).toEqual([{ label: 'Home' }])
    expect(navTrail([tasks], '/reading')).toEqual([])
  })
})

describe('trailBackTarget', () => {
  const trail = [{ label: 'Tasks', href: '/tasks' }, { label: 'Fix the gate', href: '/tasks/3' }, { label: 'History' }]

  it("is the trail's closest crumb above the page that links somewhere, below an entry", () => {
    expect(trailBackTarget(sectioned, '/tasks/3/history', trail)).toEqual({ label: 'Fix the gate', to: '/tasks/3' })
    const unlinked = [{ label: 'Tasks', href: '/tasks' }, { label: 'Fix the gate' }, { label: 'History' }]
    expect(trailBackTarget(sectioned, '/tasks/3/history', unlinked)).toEqual({ label: 'Tasks', to: '/tasks' })
  })

  it('is the entry without a trail, or with none that links above the page', () => {
    expect(trailBackTarget(sectioned, '/tasks/3', null)).toEqual({ label: 'Tasks', to: '/tasks' })
    expect(trailBackTarget(sectioned, '/tasks/3', [{ label: 'Fix the gate' }])).toEqual({ label: 'Tasks', to: '/tasks' })
  })

  it("is none on an entry's own page, whatever its trail", () => {
    expect(trailBackTarget(sectioned, '/tasks', trail)).toBeUndefined()
  })

  it('follows the trail on a page no entry covers', () => {
    const reading = [{ label: 'Reading', href: '/reading' }, { label: 'Dune' }]
    expect(trailBackTarget([tasks], '/reading/2', reading)).toEqual({ label: 'Reading', to: '/reading' })
    expect(trailBackTarget([tasks], '/reading/2', null)).toBeUndefined()
  })
})

// The tiles look (#6C): a section's own look carried to its group, the
// runs of a module's pages with no headings, and a bar item's sheet.
describe('the tiles look', () => {
  it("carries a section's look to its group, and nothing when it sets none", () => {
    expect(navGroups([home, { label: 'Tasks', items: [tasks], look: 'tiles' }])).toEqual([
      { items: [home] },
      { label: 'Tasks', items: [tasks], look: 'tiles' },
    ])
    expect(navGroups([{ label: 'Tasks', items: [tasks] }])[0]).not.toHaveProperty('look')
  })

  it("splits a module's pages into runs: each heading its own, named, and plain pages between", () => {
    const finance: NavItem = {
      to: '/finance',
      label: 'Finance',
      icon: HomeIcon,
      children: [tasks, { label: 'Money', items: [categories] }, home],
    }
    expect(childRuns(finance)).toEqual([{ items: [tasks] }, { label: 'Money', items: [categories] }, { items: [home] }])
    expect(childRuns(tasks)).toEqual([])
  })

  it("opens a bar item's sheet as tiles by its own `sheet`, else by its section's look, else the shell's", () => {
    const section = { label: 'Tasks', items: [tasks] }
    const item = { group: 'Tasks', icon: HomeIcon }
    expect(bottomBarTiles(item, section)).toBe(false)
    expect(bottomBarTiles(item, section, 'tiles')).toBe(true)
    expect(bottomBarTiles(item, { ...section, look: 'list' }, 'tiles')).toBe(false)
    expect(bottomBarTiles(item, { ...section, look: 'tiles' })).toBe(true)
    expect(bottomBarTiles({ ...item, sheet: 'list' }, { ...section, look: 'tiles' })).toBe(false)
    expect(bottomBarTiles({ ...item, sheet: 'tiles' }, section)).toBe(true)
    expect(bottomBarTiles({ to: '/', label: 'Home', icon: HomeIcon }, undefined, 'tiles')).toBe(false)
  })
})

describe('counts (drawn the same in the sidebar, the bottom bar and its sheets)', () => {
  it('draws nothing at 0, below it or while loading, and "99+" past 99', () => {
    expect(navCountText(undefined)).toBeUndefined()
    expect(navCountText(0)).toBeUndefined()
    expect(navCountText(-3)).toBeUndefined()
    expect(navCountText(Number.NaN)).toBeUndefined()
    expect(navCountText(7)).toBe('7')
    expect(navCountText(99)).toBe('99')
    expect(navCountText(100)).toBe('99+')
  })

  it('reads the real number with what it counts, and nothing where nothing is drawn', () => {
    expect(navCountSpoken(7, 'new')).toBe('7 new')
    expect(navCountSpoken(120, 'new')).toBe('120 new')
    expect(navCountSpoken(4)).toBe('4')
    expect(navCountSpoken(0, 'new')).toBeUndefined()
    expect(navCountSpoken(undefined, 'new')).toBeUndefined()
  })

  const news: NavItem = { to: '/news', label: 'News', icon: ListIcon, count: 7, countLabel: 'new' }
  const videos: NavItem = { to: '/videos', label: 'Videos', icon: ListIcon, count: 3, countLabel: 'new' }
  const inbox: NavItem = { to: '/inbox', label: 'Inbox', icon: ListIcon, count: 2, countLabel: 'unread' }
  const idle: NavItem = { to: '/idle', label: 'Idle', icon: ListIcon, count: 0, countLabel: 'unread' }
  const parent: NavItem = { to: '/media', label: 'Media', icon: ListIcon, children: [videos] }
  const nav: NavEntry[] = [
    home,
    { label: 'Daily', items: [news, parent, idle] },
    { label: 'Mixed', items: [news, inbox] },
    { label: 'Quiet', items: [tasks] },
  ]

  it("gives a bar page its nav entry's count", () => {
    expect(bottomBarCount({ to: '/news', label: 'News', icon: ListIcon }, nav)).toEqual({ count: 7, countLabel: 'new' })
    expect(bottomBarCount({ to: '/', label: 'Home', icon: ListIcon }, nav)).toEqual({ count: undefined, countLabel: undefined })
    expect(bottomBarCount({ to: '/elsewhere', label: 'Elsewhere', icon: ListIcon }, nav)).toEqual({})
  })

  it("gives a bar section the sum of its entries' and their pages', with their label when they share one", () => {
    expect(bottomBarCount({ group: 'Daily', icon: ListIcon }, nav)).toEqual({ count: 10, countLabel: 'new' })
    expect(bottomBarCount({ group: 'Mixed', icon: ListIcon }, nav)).toEqual({ count: 9, countLabel: undefined })
    expect(bottomBarCount({ group: 'Quiet', icon: ListIcon }, nav)).toEqual({})
    expect(bottomBarCount({ group: 'Missing', icon: ListIcon }, nav)).toEqual({})
  })
})
