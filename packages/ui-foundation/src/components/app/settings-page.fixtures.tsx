import type { Meta, StoryObj } from '@/fixtures/types'
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { BookOpenIcon, HomeIcon, SettingsIcon } from 'lucide-react'
import { useState } from 'react'
import { createHashRouter, Navigate, Outlet, RouterProvider } from 'react-router'
import { AuthContext, type AuthContextValue } from '@/auth/auth-context'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { isLightPaletteName, isPaletteName, type AppPaletteName } from '@/lib/palettes'
import { AppShell } from './app-shell'
import type { NavEntry } from './app-shell-nav'
import { ChoiceButtons } from './choice-buttons'
import { DataTable } from './data-table'
import { ListEditor } from './list-editor'
import { ListHeader } from './list-header'
import { PaletteSetting, RowsSetting } from './look-settings'
import { PaletteProvider } from './palette-provider'
import { RowsProvider } from './rows-provider'
import { SettingsCard, SettingsPage, SettingsRow } from './settings-page'

// A settings page in the shell, as an app builds it: a layout route and a
// route per group, the header's look menu off and its two choices on the
// page (design-language.md "A settings page").
// - Default: Look, the first group, at the page's own address: buttons, a
//   select, a switch, the palette's tiles and the table rows.
// - BelowRows: Shortcuts, a list to order under its label.
// - WithTable: Labels, a framed list under the card, wider than it.
// - NoPicker: an app that doesn't let a device pick its palette or rows.
// On a hash router, so the address, Back and a reload are the browser's
// own. The app's palette is the harness's, else Indigo and Cyan. The names
// and rows are made up. e2e/settings-page.spec.ts; axe in both themes,
// every palette and the large densities is e2e/fixtures-visual.spec.ts.

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

const NAV: NavEntry[] = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/reading', label: 'Reading', icon: BookOpenIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

const GROUPS = [
  { to: '/settings', label: 'Look' },
  { to: '/settings/shortcuts', label: 'Shortcuts and Buttons' },
  { to: '/settings/labels', label: 'Labels' },
]

const noop = () => {}

const SIZES = [
  { value: 'regular', label: 'Regular' },
  { value: 'large', label: 'Large' },
  { value: 'huge', label: 'Extra Large' },
]
const PAGES = { home: 'Home', reading: 'Reading', settings: 'Settings' }

function LookGroup() {
  const [size, setSize] = useState<string | null>('regular')
  const [page, setPage] = useState('home')
  return (
    <SettingsCard>
      <SettingsRow
        label="Text Size"
        help="Grows text, spacing and controls on every page. For this browser only."
        control={(aria) => <ChoiceButtons {...aria} options={SIZES} value={size} onValueChange={setSize} />}
      />
      <SettingsRow
        label="Opens On"
        help="The first page after you sign in."
        htmlFor="opens-on"
        control={(aria) => (
          <Select value={page} onValueChange={(next) => next && setPage(next)} items={PAGES}>
            <SelectTrigger id="opens-on" className="w-40" {...aria}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PAGES).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <SettingsRow label="Sounds" htmlFor="sounds" control={(aria) => <Switch id="sounds" defaultChecked {...aria} />} />
      <PaletteSetting />
      <RowsSetting />
    </SettingsCard>
  )
}

function ShortcutsGroup() {
  const [items, setItems] = useState(['Home', 'Reading', 'Search'].map((name, index) => ({ id: String(index), name })))
  return (
    <SettingsCard>
      <SettingsRow
        label="Buttons"
        help="Up to five, in this order."
        layout="below"
        control={
          <ListEditor
            aria-label="Buttons"
            items={items}
            itemName={(index) => `button ${index + 1}`}
            addLabel="Add Button"
            max={5}
            onAdd={() => setItems([...items, { id: crypto.randomUUID(), name: '' }])}
            onRemove={(at) => setItems(items.filter((_, index) => index !== at))}
            onMove={(from, to) => {
              const next = [...items]
              next.splice(to, 0, ...next.splice(from, 1))
              setItems(next)
            }}
            renderItem={(index) => (
              <Input aria-label={`Button ${index + 1} name`} defaultValue={items[index].name} className="min-w-0 flex-1" />
            )}
          />
        }
      />
      <SettingsRow
        label="Show Names"
        htmlFor="show-names"
        control={(aria) => <Switch id="show-names" defaultChecked {...aria} />}
      />
    </SettingsCard>
  )
}

type Label = { id: number; name: string; usedOn: string; owner: string; added: string; last: string; notes: string }
const LABELS: Label[] = [
  { id: 1, name: 'Waiting on a reply', usedOn: 'Reading', owner: 'Sam Example', added: 'Mar 3, 2026', last: 'Nov 9, 2026', notes: 'For anything handed to somebody else, until it comes back.' },
  { id: 2, name: 'Short', usedOn: 'Reading', owner: 'Sam Example', added: 'Apr 18, 2026', last: 'Nov 2, 2026', notes: 'Under twenty minutes.' },
  { id: 3, name: 'Again', usedOn: 'Everything', owner: 'Pat Owner', added: 'Jun 30, 2026', last: 'Oct 12, 2026', notes: 'Worth a second look next year.' },
]
const LABEL_COLUMNS: LegacyColumnDef<Label, unknown>[] = [
  { accessorKey: 'name', header: 'Label', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
  { accessorKey: 'usedOn', header: 'Used On' },
  { accessorKey: 'owner', header: 'Owner' },
  { accessorKey: 'added', header: 'Added' },
  { accessorKey: 'last', header: 'Last Used' },
  { accessorKey: 'notes', header: 'Notes' },
]

function LabelsGroup() {
  return (
    <>
      <SettingsCard>
        <SettingsRow
          label="Suggest Labels"
          help="While you type a title."
          htmlFor="suggest-labels"
          control={(aria) => <Switch id="suggest-labels" {...aria} />}
        />
      </SettingsCard>
      <DataTable
        look="framed"
        pageHeader={<ListHeader title="Labels" count={LABELS.length} newAction={{ label: 'New Label', onClick: noop }} />}
        opens={{ kind: 'rows' }}
        columns={LABEL_COLUMNS}
        data={LABELS}
        total={LABELS.length}
        page={1}
        pageSize={50}
        onPageChange={noop}
        sorting={[]}
        onSortingChange={noop}
        isLoading={false}
        getRowId={(label) => String(label.id)}
        emptyTitle="No labels yet"
      />
    </>
  )
}

// What the harness put on <html> (`palette=violet`), as the app's default.
function harnessPalette(): AppPaletteName | null {
  const name = document.documentElement.dataset.palette
  return isPaletteName(name) || isLightPaletteName(name) ? name : null
}

function Settings({ path, pickers }: { path: string; pickers: boolean }) {
  const [palette] = useState(harnessPalette)
  const [router] = useState(() => {
    // A story opened with no address of its own starts on its group.
    if (!window.location.hash) window.location.replace(`#${path}`)
    return createHashRouter([
      {
        path: '/',
        element: <AppShell title="Example" nav={NAV} lookMenu={false} />,
        children: [
          {
            path: 'settings',
            element: (
              <SettingsPage title="Settings" groups={GROUPS}>
                <Outlet />
              </SettingsPage>
            ),
            children: [
              { index: true, element: <LookGroup /> },
              { path: 'shortcuts', element: <ShortcutsGroup /> },
              { path: 'labels', element: <LabelsGroup /> },
              { path: 'labels/:id', element: <p>One label</p> },
              { path: '*', element: <Navigate to="/settings" replace /> },
            ],
          },
          { path: '*', element: <p>Another page</p> },
        ],
      },
    ])
  })
  const shell = (
    <RowsProvider picker={pickers}>
      <AuthContext.Provider value={SIGNED_IN}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </RowsProvider>
  )
  const appPalette = palette ?? (pickers ? 'indigo-cyan' : undefined)
  return (
    <PaletteProvider palette={appPalette} picker={pickers}>
      {shell}
    </PaletteProvider>
  )
}

const meta: Meta<typeof Settings> = {
  title: 'app/SettingsPage',
  component: Settings,
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj<typeof Settings>

export const Default: Story = { args: { path: '/settings', pickers: true } }
export const BelowRows: Story = { args: { path: '/settings/shortcuts', pickers: true } }
export const WithTable: Story = { args: { path: '/settings/labels', pickers: true } }
export const NoPicker: Story = { args: { path: '/settings', pickers: false } }
