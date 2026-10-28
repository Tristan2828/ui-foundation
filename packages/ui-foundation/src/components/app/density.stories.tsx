import type { Meta, StoryObj } from '@storybook/react-vite'
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import { BookmarkIcon, BriefcaseIcon, HeartIcon, HouseIcon, PlaneIcon, PlusIcon, SettingsIcon, WalletIcon, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Toggle } from '@/components/ui/toggle'
import { MemoryRouter } from 'react-router'
import { DataTable } from './data-table'
import { ModuleCard, ModuleStrip } from './module-card'
import { WidgetCard, WidgetList, WidgetListItem } from './widget-card'

// Not a component: every density (styles/theme.css, design-language.md
// "Density") with the same primitives in each, so a reviewer sees what
// each one changes. compact and comfortable retune table rows (compact
// also a hub's cards: Hub cards); large
// grows everything (type, spacing, control heights, icons, the sidebar)
// for a screen read from across the room. Each sample sets data-density on
// its own section, so leave the toolbar's Density at "default" here; the
// toolbar sets it on <html> instead, for viewing any other story (and its
// popups) at that density.
//
// e2e/storybook-visual.spec.ts runs axe and the token check on each story
// in both themes, and measures the data-measure elements: each equals
// today's size at the default, and is larger at large. Made-up data only.

const DENSITIES = ['compact', 'default', 'comfortable', 'large'] as const
type Density = (typeof DENSITIES)[number]

function Sample({ density, children, className }: { density: Density; children: ReactNode; className?: string }) {
  return (
    <section
      aria-label={`${density} density`}
      data-sample={density}
      data-density={density === 'default' ? undefined : density}
      className={className}
    >
      <p className="type-label mb-3 text-muted-foreground">
        {density === 'default' ? 'No data-density (the default)' : `data-density="${density}"`}
      </p>
      {children}
    </section>
  )
}

// --- Primitives -------------------------------------------------------------

function PrimitivesSample({ density }: { density: Density }) {
  const id = (name: string) => `${density}-${name}`
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="type-page-title text-foreground">Standing desk</span>
        <span data-measure="body" className="type-body text-foreground">
          Electric height-adjustable desk, 120x60cm top.
        </span>
        <span className="type-caption text-muted-foreground">Showing 1–25 of 132</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button data-measure="button">
          <PlusIcon data-measure="icon" /> New widget
        </Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Delete</Button>
        <Button size="sm">Small</Button>
        <Button size="xs">Extra small</Button>
        <Button size="icon" variant="outline" aria-label="Settings">
          <SettingsIcon />
        </Button>
      </div>

      <div className="grid max-w-xl gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id('name')}>Name</Label>
          <Input data-measure="input" id={id('name')} defaultValue="Standing desk" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id('status')}>Status</Label>
          <Select defaultValue="active">
            <SelectTrigger id={id('status')} className="w-full">
              <SelectValue>{() => 'Active'}</SelectValue>
            </SelectTrigger>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={id('notes')}>Notes</Label>
          <Textarea id={id('notes')} defaultValue="Arrives flat-packed; two people to assemble." />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Checkbox data-measure="checkbox" id={id('shipped')} defaultChecked />
          <Label htmlFor={id('shipped')}>Shipped</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch data-measure="switch" id={id('active')} defaultChecked />
          <Label htmlFor={id('active')}>Active</Label>
        </div>
        <Toggle variant="outline" aria-label="Bookmark" defaultPressed>
          <BookmarkIcon />
        </Toggle>
        <div className="flex flex-wrap gap-1.5">
          <Badge data-measure="badge" variant="tinted-success">In stock</Badge>
          <Badge variant="outline-warning">Low</Badge>
          <Badge variant="info">New</Badge>
          <Badge variant="secondary">Office</Badge>
        </div>
      </div>

      <Card className="max-w-sm">
        <CardHeader>
          <CardTitle>Monthly summary</CardTitle>
          <CardDescription>12 widgets added, 3 archived.</CardDescription>
        </CardHeader>
        <CardContent className="type-body">Next review on the 1st.</CardContent>
      </Card>

      <Table aria-label={`Widgets (${density})`}>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Price</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            ['Wireless mouse', 'Active', '24.99'],
            ['Standing desk', 'Draft', '389.00'],
          ].map(([name, status, price]) => (
            <TableRow key={name}>
              <TableCell>{name}</TableCell>
              <TableCell>{status}</TableCell>
              <TableCell className="text-right tabular-nums">{price}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// --- DataTable --------------------------------------------------------------

type Category = { id: number; name: string; icon: LucideIcon; colour: string; widgets: number; status: 'Active' | 'Paused' }

// Whole class names: Tailwind only generates the ones written out.
const ROWS: Category[] = [
  { id: 1, name: 'Home', icon: HouseIcon, colour: 'text-category-1', widgets: 12, status: 'Active' },
  { id: 2, name: 'Finance', icon: WalletIcon, colour: 'text-category-2', widgets: 4, status: 'Active' },
  { id: 3, name: 'Work', icon: BriefcaseIcon, colour: 'text-category-3', widgets: 27, status: 'Paused' },
  { id: 4, name: 'Health', icon: HeartIcon, colour: 'text-category-10', widgets: 3, status: 'Active' },
  { id: 5, name: 'Travel', icon: PlaneIcon, colour: 'text-category-4', widgets: 8, status: 'Paused' },
]

const COLUMNS: LegacyColumnDef<Category, unknown>[] = [
  {
    id: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const Icon = row.original.icon
      return (
        <span className="inline-flex items-center gap-2 font-medium">
          <Icon aria-hidden="true" className={`size-4 shrink-0 ${row.original.colour}`} />
          {row.original.name}
        </span>
      )
    },
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={row.original.status === 'Active' ? 'tinted-success' : 'secondary'}>{row.original.status}</Badge>
    ),
  },
  { id: 'widgets', header: 'Widgets', cell: ({ row }) => <span className="tabular-nums">{row.original.widgets}</span> },
]

const noop = () => {}

function CategoriesTable({ density }: { density: Density }) {
  return (
    <DataTable<Category>
      columns={COLUMNS}
      data={ROWS}
      total={ROWS.length}
      page={1}
      pageSize={25}
      onPageChange={noop}
      sorting={[]}
      onSortingChange={noop}
      isLoading={false}
      emptyTitle="No categories yet"
      getRowId={(row) => String(row.id)}
      toolbar={<Input className="w-64" placeholder="Search categories" aria-label={`Search categories (${density})`} />}
    />
  )
}

// --- Sidebar ----------------------------------------------------------------

const NAV = [
  { label: 'Home', icon: HouseIcon },
  { label: 'Finance', icon: WalletIcon },
  { label: 'Travel', icon: PlaneIcon },
]

function DemoSidebar({ density }: { density: Density }) {
  return (
    <div className="h-80 overflow-hidden rounded-lg border border-border">
      <SidebarProvider className="min-h-0">
        <nav aria-label={`Sidebar (${density})`}>
          <Sidebar data-measure="sidebar" collapsible="none" className="h-80">
            <SidebarHeader>
              <span className="px-2 text-sm font-semibold text-sidebar-foreground">Demo</span>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Sections</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {NAV.map(({ label, icon: Icon }, index) => (
                      <SidebarMenuItem key={label}>
                        <SidebarMenuButton isActive={index === 0}>
                          <Icon /> {label}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </nav>
      </SidebarProvider>
    </div>
  )
}

// --- Hub cards ----------------------------------------------------------------

// compact reaches a hub's cards too (#224): WidgetCard's padding and rows,
// and ModuleCard's band and body. Text keeps its size.
function HubSample({ density }: { density: Density }) {
  return (
    <MemoryRouter>
      <div className="flex max-w-xl flex-col gap-4">
        <ModuleStrip aria-label={`Places (${density})`}>
          <ModuleCard
            title="Projects"
            icon={BriefcaseIcon}
            category={1}
            to="/projects"
            value={5}
            note="open"
            action={{ to: '/projects?view=today', label: 'Today' }}
          />
          <ModuleCard
            title="Trips"
            icon={PlaneIcon}
            category={2}
            to="/trips"
            value={2}
            note="booked"
            action={{ to: '/trips/next', label: 'Next' }}
          />
        </ModuleStrip>
        <WidgetCard
          title={`Ready to start (${density})`}
          link={{ to: '/projects?status=ready', label: 'All' }}
          isLoading={false}
          isEmpty={false}
          emptyMessage="Nothing waiting"
        >
          <WidgetList>
            <WidgetListItem to="/projects/1" trailing={<Badge variant="outline-success">Ready</Badge>}>
              Standing desk
            </WidgetListItem>
            <WidgetListItem to="/projects/2" note="2 h ago">
              Office chair
            </WidgetListItem>
          </WidgetList>
        </WidgetCard>
      </div>
    </MemoryRouter>
  )
}

const meta: Meta = {
  title: 'patterns/Density',
  parameters: { controls: { disable: true } },
}

export default meta

export const Primitives: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-10">
      {DENSITIES.map((density) => (
        <Sample key={density} density={density}>
          <PrimitivesSample density={density} />
        </Sample>
      ))}
    </div>
  ),
}

export const DataTables: StoryObj = {
  name: 'DataTable',
  render: () => (
    <div className="flex flex-col gap-10">
      {DENSITIES.map((density) => (
        <Sample key={density} density={density}>
          <CategoriesTable density={density} />
        </Sample>
      ))}
    </div>
  ),
}

// compact and comfortable don't touch the sidebar, so only the two that differ.
export const Sidebars: StoryObj = {
  name: 'Sidebar',
  render: () => (
    <div className="flex flex-wrap items-start gap-6">
      {(['default', 'large'] as const).map((density) => (
        <Sample key={density} density={density}>
          <DemoSidebar density={density} />
        </Sample>
      ))}
    </div>
  ),
}

export const HubCards: StoryObj = {
  name: 'Hub cards',
  render: () => (
    <div className="flex flex-col gap-10">
      {DENSITIES.map((density) => (
        <Sample key={density} density={density}>
          <HubSample density={density} />
        </Sample>
      ))}
    </div>
  ),
}
