import type { Meta, StoryObj } from '@storybook/react-vite'
import { BookOpenIcon, HomeIcon, ListChecksIcon, ListIcon, TagIcon } from 'lucide-react'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AuthContext, type AuthContextValue } from '@/auth/auth-context'
import { Button } from '@/components/ui/button'
import { AppShell, type AppShellVersion } from './app-shell'
import type { NavEntry } from './app-shell-nav'
import { EntityView } from './entity-view'

// AppShell's sidebar: a flat nav (one "Navigation" group) and a nav with
// sections (a labelled group per module). Each story opens on a page below
// one of the entries, so only the most specific match is current: Categories,
// not Projects, on /projects/categories/2. Signed in through AuthContext
// directly, so nothing is fetched. Axe in both themes is
// e2e/storybook-visual.spec.ts's COMPOSITE_STORIES; e2e/app-shell.spec.ts
// checks the groups, the current entry and the version entry, sections
// that fold (Collapsible, and on the icon rail CollapsibleRail), an entry
// opening a list on a saved view (SavedView, #188), and the browser tab's
// title from the nav and from a record's view (Home, WithView…, #186).

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

function Shell({
  nav,
  path,
  version,
  sidebarOpen = true,
  view,
}: {
  nav: NavEntry[]
  path: string
  version?: AppShellVersion
  sidebarOpen?: boolean
  /** /projects/:id is a project's EntityView. */
  view?: ShellView
}) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppShell title="Example" nav={nav} defaultSidebarOpen={sidebarOpen} version={version} />,
        children: [
          ...(view ? [{ path: 'projects/:id', element: <ProjectView {...view} /> }] : []),
          { path: '*', element: <p>Page at {path}</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  return (
    <AuthContext.Provider value={SIGNED_IN}>
      <RouterProvider router={router} />
    </AuthContext.Provider>
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
