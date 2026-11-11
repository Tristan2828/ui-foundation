import type { Meta, StoryObj } from '@/fixtures/types'
import {
  BookOpenIcon,
  ChartPieIcon,
  ClipboardPenIcon,
  LandmarkIcon,
  MapIcon,
  NewspaperIcon,
  PiggyBankIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  SunIcon,
  TimerIcon,
  HouseIcon,
  HomeIcon,
  LibraryIcon,
  ListChecksIcon,
  ListIcon,
  ListVideoIcon,
  PlaySquareIcon,
  TagIcon,
  TvIcon,
  WalletIcon,
} from 'lucide-react'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AuthContext, type AuthContextValue } from '@/auth/auth-context'
import { Button } from '@/components/ui/button'
import { PaletteProvider } from '@/components/app/palette-provider'
import { RowsProvider } from '@/components/app/rows-provider'
import { AppShell, type AppShellSearch, type AppShellVersion, type BottomBarItem, type SearchRecord } from './app-shell'
import type { NavEntry } from './app-shell-nav'
import { EntityView } from './entity-view'
import { usePageTrail } from './page-trail-context'
import { clearRecentRecords, rememberRecentRecord } from '@/lib/search-palette'

// AppShell's sidebar: a flat nav (one "Navigation" group) and a nav with
// sections (a labelled group per module). Each story opens on a page below
// one of the entries, so only the most specific match is current: Categories,
// not Projects, on /projects/categories/2. Signed in through AuthContext
// directly, so nothing is fetched. Axe in both themes is
// e2e/fixtures-visual.spec.ts's COMPOSITE_STORIES; e2e/app-shell.spec.ts
// checks the groups, the current entry and the version entry, sections
// that fold (Collapsible, and on the icon rail CollapsibleRail), an entry
// opening a list on a saved view (SavedView, #188), and the browser tab's
// title from the nav and from a record's view (Home, WithView…, #186),
// the app's logo beside its title and alone on the rail (WithLogo…,
// #211), a module's pages under its entry (Nested…, #239), and the
// phone's bottom bar (BottomBar, #240; e2e/app-shell-bottom-bar.spec.ts),
// and an app with a palette, fixed or picked (WithPalette…,
// e2e/palettes.spec.ts). The navigation standard (Standard…,
// e2e/app-shell-standard.spec.ts): headings among a module's pages, the
// current entry's bar, counts, a Tools section at the sidebar's foot, the
// phone's back arrow and an area's sheet as tiles. The trail in the bar
// and search (StandardTrail…, StandardSearch…,
// e2e/app-shell-trail-search.spec.ts): a record's trail from EntityView,
// a page's own from usePageTrail, the nav entry's otherwise, and the
// palette over the nav's pages and made-up records.

const SIGNED_IN: AuthContextValue = {
  user: { id: 1, name: 'Sam Example', email: 'sam@example.com' },
  status: 'authenticated',
  error: null,
  retry: () => {},
  login: async () => ({ status: 'signed-in' }),
  submitTotp: async () => ({ status: 'signed-in' }),
  logout: async () => {},
  register: async () => {},
}

const FLAT: NavEntry[] = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/projects', label: 'Projects', icon: ListIcon },
  { to: '/reading', label: 'Reading', icon: BookOpenIcon },
]

const SECTIONS: NavEntry[] = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  {
    label: 'Projects',
    items: [
      { to: '/projects', label: 'Projects', icon: ListIcon },
      { to: '/projects/categories', label: 'Categories', icon: TagIcon },
      { to: '/projects/checklists', label: 'Checklists', icon: ListChecksIcon },
    ],
  },
  { label: 'Reading', items: [{ to: '/reading', label: 'Books', icon: BookOpenIcon }] },
]

// Every section folds: Projects (holding the current page) open, Media
// open by default, Reading folded by default.
const COLLAPSIBLE: NavEntry[] = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  {
    label: 'Projects',
    collapsible: true,
    items: [
      { to: '/projects', label: 'Projects', icon: ListIcon },
      { to: '/projects/categories', label: 'Categories', icon: TagIcon },
    ],
  },
  {
    label: 'Media',
    collapsible: true,
    items: [{ to: '/media', label: 'Channels', icon: ListChecksIcon }],
  },
  {
    label: 'Reading',
    collapsible: true,
    defaultOpen: false,
    items: [{ to: '/reading', label: 'Books', icon: BookOpenIcon }],
  },
]

// A sidebar entry that opens its list on a saved view (#188), inside a
// section folded by default: arriving on the view marks it and opens it.
const SAVED_VIEW: NavEntry[] = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/projects', label: 'Projects', icon: ListIcon },
  {
    label: 'Reading',
    collapsible: true,
    defaultOpen: false,
    items: [{ to: '/reading?status=unread&sort=title:asc', label: 'Unread books', icon: BookOpenIcon }],
  },
]

// A module's pages under its entry (#239): YouTube's and Comics' show
// while you're in that module; Budget's always.
const NESTED: NavEntry[] = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  {
    label: 'Collections',
    items: [
      {
        to: '/media/videos',
        label: 'YouTube',
        icon: PlaySquareIcon,
        children: [
          { to: '/media/channels', label: 'Channels', icon: TvIcon },
          { to: '/media/playlists', label: 'Playlists', icon: ListVideoIcon },
        ],
      },
      {
        to: '/media/comics',
        label: 'Comics',
        icon: BookOpenIcon,
        children: [
          { to: '/media/series', label: 'Series', icon: LibraryIcon },
          { to: '/media/reading-lists', label: 'Reading lists', icon: ListIcon },
        ],
      },
    ],
  },
  {
    label: 'Home and money',
    items: [
      {
        to: '/budget',
        label: 'Budget',
        icon: WalletIcon,
        open: 'always',
        children: [{ to: '/budget/accounts', label: 'Accounts', icon: TagIcon }],
      },
    ],
  },
]

// The navigation standard: areas of modules, a long module's pages under
// headings, counts on the entries that ask you to act, and a Tools
// section at the sidebar's foot. Every name is made up.
const STANDARD: NavEntry[] = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  {
    label: 'Every day',
    items: [
      { to: '/tasks', label: 'Tasks', icon: ListChecksIcon },
      { to: '/news', label: 'News', icon: NewspaperIcon, count: 24, countLabel: 'unread' },
      { to: '/timers', label: 'Timers', icon: TimerIcon },
    ],
  },
  {
    label: 'Collections',
    items: [
      { to: '/videos', label: 'Videos', icon: PlaySquareIcon, count: 12, countLabel: 'new' },
      { to: '/books', label: 'Books', icon: BookOpenIcon },
    ],
  },
  {
    label: 'Home and money',
    items: [
      { to: '/house', label: 'House', icon: HouseIcon },
      {
        to: '/finance',
        label: 'Finance',
        icon: WalletIcon,
        children: [
          {
            label: 'Money',
            items: [
              { to: '/finance/accounts', label: 'Accounts', icon: LandmarkIcon },
              { to: '/finance/savings', label: 'Savings', icon: PiggyBankIcon },
            ],
          },
          {
            label: 'Spending',
            items: [
              { to: '/finance/budget', label: 'Budget', icon: ChartPieIcon },
              { to: '/finance/shopping', label: 'Shopping list', icon: ShoppingCartIcon },
            ],
          },
          { label: 'Taxes', items: [{ to: '/finance/taxes', label: 'Taxes', icon: ReceiptIcon }] },
        ],
      },
    ],
  },
  {
    label: 'Tools',
    placement: 'bottom',
    items: [
      { to: '/fill-in', label: 'Fill in', icon: ClipboardPenIcon, count: 5, countLabel: 'to fill in' },
      { to: '/roadmap', label: 'Roadmap', icon: MapIcon },
    ],
  },
]

// The phone's bar for it: Home and the three areas, each opening its
// sheet as tiles.
const STANDARD_BAR: BottomBarItem[] = [
  { to: '/', label: 'Home', icon: HouseIcon },
  { group: 'Every day', icon: SunIcon, sheet: 'tiles' },
  { group: 'Collections', icon: LibraryIcon, sheet: 'tiles' },
  { group: 'Home and money', label: 'Household', icon: WalletIcon, sheet: 'tiles' },
]

// One project's view, for the tab's title (#186). `loaded` false holds it
// in its loading state until "Finish loading" is pressed, so the record's
// title arrives after the nav's; true has it from the first render, so
// the view's title is set before AppShell's (a child's effect runs first).
function ProjectView({ loaded: loadedAtFirst, documentTitle }: { loaded: boolean; documentTitle?: string | false }) {
  const [loaded, setLoaded] = useState(loadedAtFirst)
  return (
    <div className="flex flex-col gap-4">
      {!loaded && (
        <Button size="sm" variant="outline" className="w-fit" onClick={() => setLoaded(true)}>
          Finish loading
        </Button>
      )}
      <EntityView
        title="Apollo"
        documentTitle={documentTitle}
        isLoading={!loaded}
        back={{ to: '/projects', label: 'Projects' }}
        sections={[{ title: 'Summary', fields: [{ label: 'Owner', value: 'Pat Owner' }] }]}
      />
    </div>
  )
}

type ShellView = { loaded: boolean; documentTitle?: string | false }

// An account's record, its trail above it (#R2): Finance, Accounts, then
// its own title, in the shell's bar.
function AccountView() {
  return (
    <EntityView
      title="Everyday checking"
      subtitle="Bills and the paycheck"
      isLoading={false}
      back={{
        to: '/finance/accounts',
        label: 'Accounts',
        trail: [
          { label: 'Finance', href: '/finance' },
          { label: 'Accounts', href: '/finance/accounts' },
        ],
      }}
      sections={[{ title: 'Account', fields: [{ label: 'Bank', value: 'Example Bank' }] }]}
    />
  )
}

// A page below a record, naming its own trail (#N5): on a phone its back
// arrow goes to the record, the trail's closest crumb above it.
function StatementPage() {
  usePageTrail([
    { label: 'Finance', href: '/finance' },
    { label: 'Accounts', href: '/finance/accounts' },
    { label: 'Everyday checking', href: '/finance/accounts/3' },
    { label: 'March statement' },
  ])
  return <p>The March statement</p>
}

// Made-up records for the palette, by kind, the way an app's search
// endpoint returns them: the closest title first.
const RECORDS: SearchRecord[] = [
  { title: 'Everyday checking', to: '/finance/accounts/3', kind: 'Accounts', detail: 'Finance' },
  { title: 'Emergency savings', to: '/finance/accounts/4', kind: 'Accounts', detail: 'Finance' },
  { title: 'Desk lamp', to: '/finance/shopping/12', kind: 'Planned purchases', detail: 'Finance' },
  { title: 'Fix the gate latch', to: '/tasks/31', kind: 'Tasks' },
  { title: 'Plan the garden', to: '/tasks/32', kind: 'Tasks' },
  { title: 'The Long Walk', to: '/books/8', kind: 'Books' },
  { title: 'Paper Atlas', to: '/books/9', kind: 'Books' },
]

const findRecords: AppShellSearch['findRecords'] = (query) =>
  new Promise((resolve) => {
    const text = query.toLowerCase()
    setTimeout(() => resolve(RECORDS.filter((record) => record.title.toLowerCase().includes(text))), 120)
  })

const SEARCH: Record<'records' | 'pages' | 'failing', AppShellSearch> = {
  records: { placeholder: 'Search Example', findRecords },
  pages: { placeholder: 'Search Example' },
  failing: { placeholder: 'Search Example', findRecords: () => Promise.reject(new Error('Search is down')) },
}

// The records "opened lately" on this device, as useRecentRecord leaves them.
function seedRecent(seed: boolean) {
  clearRecentRecords()
  if (!seed) return
  for (const record of [...RECORDS.slice(0, 3)].reverse())
    rememberRecentRecord({ title: record.title, to: record.to, detail: record.kind })
}

// A made-up app mark, drawn the way an app's own is: an icon component
// that sizes by class, passes aria-hidden on and fills with currentColor.
function ExampleLogo({ className, ...rest }: { className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} data-testid="app-logo" {...rest}>
      <path fillRule="evenodd" d="M12 2 22 7.5v9L12 22 2 16.5v-9L12 2Zm0 5-5 2.75v4.5L12 17l5-2.75v-4.5L12 7Z" />
    </svg>
  )
}

function Shell({
  nav,
  path,
  version,
  bottomBar,
  sidebarOpen = true,
  view,
  logo,
  palette,
  rows = false,
  search,
  recent = false,
  trail = false,
}: {
  nav: NavEntry[]
  path: string
  version?: AppShellVersion
  bottomBar?: BottomBarItem[]
  sidebarOpen?: boolean
  /** Shows ExampleLogo as the app's logo. */
  logo?: boolean
  /** /projects/:id is a project's EntityView. */
  view?: ShellView
  /** An app with a palette (Indigo and Cyan): 'fixed', or 'picker' to offer all four. */
  palette?: 'fixed' | 'picker'
  /** Offers the table rows in the look menu (RowsProvider's picker). */
  rows?: boolean
  /** Search in the bar: over made-up records, over the pages only, or a search that fails. */
  search?: 'records' | 'pages' | 'failing'
  /** Seeds three records as opened lately (and clears them without). */
  recent?: boolean
  /** /finance/accounts/:id is an account's EntityView with a trail, and its statements a page naming its own. */
  trail?: boolean
}) {
  // Once, before the palette can read them.
  useState(() => seedRecent(recent))
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <AppShell
            title="Example"
            logo={logo ? ExampleLogo : undefined}
            nav={nav}
            defaultSidebarOpen={sidebarOpen}
            version={version}
            bottomBar={bottomBar}
            search={search ? SEARCH[search] : undefined}
          />
        ),
        children: [
          ...(view ? [{ path: 'projects/:id', element: <ProjectView {...view} /> }] : []),
          ...(trail
            ? [
                { path: 'finance/accounts/:id', element: <AccountView /> },
                { path: 'finance/accounts/:id/statements/:statement', element: <StatementPage /> },
              ]
            : []),
          { path: '*', element: <p>Page at {path}</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  const shell = (
    <RowsProvider picker={rows}>
      <AuthContext.Provider value={SIGNED_IN}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </RowsProvider>
  )
  return palette ? (
    <PaletteProvider palette="indigo-cyan" picker={palette === 'picker'}>
      {shell}
    </PaletteProvider>
  ) : (
    shell
  )
}

const meta: Meta<typeof Shell> = {
  title: 'app/AppShell',
  component: Shell,
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj<typeof Shell>

export const Sections: Story = { args: { nav: SECTIONS, path: '/projects/categories/2' } }

export const Flat: Story = { args: { nav: FLAT, path: '/projects/7' } }

// Collapsible sections (#152): open, folded, and the one holding the page.
export const Collapsible: Story = { args: { nav: COLLAPSIBLE, path: '/projects/categories/2' } }

// A page inside Media, for arriving in a section folded earlier.
export const CollapsibleInMedia: Story = { args: { nav: COLLAPSIBLE, path: '/media/4' } }

// The same nav on the icon rail: every section's items, folded or not.
export const CollapsibleRail: Story = {
  args: { nav: COLLAPSIBLE, path: '/projects/categories/2', sidebarOpen: false },
}

// A production build's footer: the short commit, linking to its PR
// (`@tristan2828/ui-foundation/vite` sets the values at build time).
export const Version: Story = {
  args: {
    nav: FLAT,
    path: '/projects/7',
    version: { commit: '3655449e1c2b7d0a9f8e6b5c4d3a2f1e0d9c8b7a', pr: 139, repoUrl: 'https://github.com/example/app' },
  },
}

// An entry whose `to` opens its list on a saved view (#188).
export const SavedView: Story = { args: { nav: SAVED_VIEW, path: '/reading?status=unread&sort=title:asc' } }

// The home entry: the tab reads the app's title alone (#186).
export const Home: Story = { args: { nav: FLAT, path: '/' } }

// A record's view inside the shell (#186): its title from the first render…
export const WithView: Story = { args: { nav: SECTIONS, path: '/projects/7', view: { loaded: true } } }

// …after the nav's (still loading until "Finish loading")…
export const WithLoadingView: Story = { args: { nav: SECTIONS, path: '/projects/7', view: { loaded: false } } }

// …named otherwise, and leaving the tab to the nav.
export const WithViewDocumentTitle: Story = {
  args: { nav: SECTIONS, path: '/projects/7', view: { loaded: true, documentTitle: 'Project Apollo' } },
}
export const WithViewNoDocumentTitle: Story = {
  args: { nav: SECTIONS, path: '/projects/7', view: { loaded: true, documentTitle: false } },
}

// The app's logo (#211): before the title, and alone at the top of the rail.
export const WithLogo: Story = { args: { nav: SECTIONS, path: '/projects/7', logo: true } }
export const WithLogoRail: Story = { args: { nav: SECTIONS, path: '/projects/7', logo: true, sidebarOpen: false } }

// A module's pages under its entry (#239), on one of them, on the module's
// own entry, elsewhere, and on the icon rail.
export const Nested: Story = { args: { nav: NESTED, path: '/media/channels/3' } }
export const NestedOnParent: Story = { args: { nav: NESTED, path: '/media/videos' } }
export const NestedElsewhere: Story = { args: { nav: NESTED, path: '/' } }
export const NestedRail: Story = { args: { nav: NESTED, path: '/media/channels/3', sidebarOpen: false } }

// The phone's bottom bar (#240): Home, two sections (one with a shorter
// label) and a page, on a page inside Collections. Below the md breakpoint
// only, so open it at a phone's width.
const BOTTOM_BAR: BottomBarItem[] = [
  { to: '/', label: 'Home', icon: HouseIcon },
  { group: 'Collections', icon: LibraryIcon },
  { group: 'Home and money', label: 'Household', icon: WalletIcon },
  { to: '/media/comics', label: 'Comics', icon: BookOpenIcon },
]

export const BottomBar: Story = { args: { nav: NESTED, path: '/media/channels/3', bottomBar: BOTTOM_BAR } }

// An app with a palette (design-language.md "Palettes"): no light/dark
// toggle in the header; with the picker, the palette menu in its place.
// Open them with `palette=indigo-cyan`, as FoundationProviders forces dark.
export const WithPalette: Story = { args: { nav: SECTIONS, path: '/projects/7', palette: 'fixed' } }
export const WithPalettePicker: Story = { args: { nav: SECTIONS, path: '/projects/7', palette: 'picker' } }

// The rows picker (design-language.md "Density"): Rows on this device in
// the palette's menu, or, without a palette, a menu of its own beside the
// light/dark toggle. e2e/palettes.spec.ts.
export const WithPalettePickerAndRows: Story = {
  args: { nav: SECTIONS, path: '/projects/7', palette: 'picker', rows: true },
}
export const WithRowsPicker: Story = { args: { nav: SECTIONS, path: '/projects/7', rows: true } }

// The navigation standard: on a record below Accounts (Finance's pages
// under their headings, Accounts marked), on the icon rail, and on a
// phone, where the record gets a back arrow to Accounts, an entry's own
// page keeps the menu button, and the areas' sheets are tiles.
export const Standard: Story = { args: { nav: STANDARD, path: '/finance/accounts/3', bottomBar: STANDARD_BAR } }
export const StandardRail: Story = {
  args: { nav: STANDARD, path: '/finance/accounts/3', bottomBar: STANDARD_BAR, sidebarOpen: false },
}
export const StandardOnEntry: Story = { args: { nav: STANDARD, path: '/finance/accounts', bottomBar: STANDARD_BAR } }
export const StandardNoBar: Story = { args: { nav: STANDARD, path: '/finance/accounts/3' } }

// The trail in the bar (#N5, #R2) and search (#N6). A record's trail from
// EntityView, a page's own (usePageTrail), and the nav entry's on a page
// that names none; the palette over the nav's pages and made-up records,
// with three opened lately, over the pages only, and with a search that
// fails.
export const StandardTrail: Story = {
  args: { nav: STANDARD, path: '/finance/accounts/3', bottomBar: STANDARD_BAR, search: 'records', trail: true },
}
export const StandardTrailPage: Story = {
  args: { nav: STANDARD, path: '/finance/accounts/3/statements/9', bottomBar: STANDARD_BAR, search: 'records', trail: true },
}
export const StandardTrailFromNav: Story = {
  args: { nav: STANDARD, path: '/finance/budget', bottomBar: STANDARD_BAR, search: 'records' },
}
export const StandardSearch: Story = {
  args: { nav: STANDARD, path: '/finance/budget', bottomBar: STANDARD_BAR, search: 'records', recent: true },
}
export const StandardSearchPages: Story = {
  args: { nav: STANDARD, path: '/finance/budget', bottomBar: STANDARD_BAR, search: 'pages' },
}
export const StandardSearchFailing: Story = {
  args: { nav: STANDARD, path: '/finance/budget', bottomBar: STANDARD_BAR, search: 'failing' },
}
