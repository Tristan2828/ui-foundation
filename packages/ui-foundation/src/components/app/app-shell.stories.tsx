import type { Meta, StoryObj } from '@storybook/react-vite'
import { BookOpenIcon, HomeIcon, ListChecksIcon, ListIcon, TagIcon } from 'lucide-react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AuthContext, type AuthContextValue } from '@/auth/auth-context'
import { AppShell, type AppShellVersion } from './app-shell'
import type { NavEntry } from './app-shell-nav'

// AppShell's sidebar: a flat nav (one "Navigation" group) and a nav with
// sections (a labelled group per module). Each story opens on a page below
// one of the entries, so only the most specific match is current: Categories,
// not Projects, on /projects/categories/2. Signed in through AuthContext
// directly, so nothing is fetched. Axe in both themes is
// e2e/storybook-visual.spec.ts's COMPOSITE_STORIES; e2e/app-shell.spec.ts
// checks the groups, the current entry and the version entry.

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

function Shell({ nav, path, version }: { nav: NavEntry[]; path: string; version?: AppShellVersion }) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppShell title="Example" nav={nav} defaultSidebarOpen version={version} />,
        children: [{ path: '*', element: <p>Page at {path}</p> }],
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

// A production build's footer: the short commit, linking to its PR
// (`@tristan2828/ui-foundation/vite` sets the values at build time).
export const Version: Story = {
  args: {
    nav: FLAT,
    path: '/projects/7',
    version: { commit: '3655449e1c2b7d0a9f8e6b5c4d3a2f1e0d9c8b7a', pr: 139, repoUrl: 'https://github.com/example/app' },
  },
}
