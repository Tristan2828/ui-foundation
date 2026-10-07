import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  BookOpenIcon,
  BriefcaseIcon,
  CalendarClockIcon,
  FlagIcon,
  HeartIcon,
  HouseIcon,
  LinkIcon,
  PackageIcon,
  PlaneIcon,
  ShoppingCartIcon,
  WalletIcon,
  WrenchIcon,
} from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Spinner } from '@/components/ui/spinner'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { StageCircle } from './stage-circle'

// Not components: the markup of four cell patterns
// (conventions/docs/cell-patterns.md), on screen so axe, the token check
// and the glyph contrast check measure them in both themes
// (e2e/storybook-visual.spec.ts). An app copies the markup into its own
// columns and view files, with its own lookups.
const meta: Meta = {
  title: 'patterns/CellPatterns',
  parameters: { controls: { disable: true } },
}

export default meta

// --- Pattern 15, a pressed icon inside another value's cell --------------

// Off: faint, the faintest muted-foreground that still clears the 3:1
// non-text minimum in both themes (measured by the glyph contrast check).
// On: the destructive text tone, filled. The primitive's pressed
// background is dropped: the icon carries the value.
const FLAG_TOGGLE_CLASS =
  'text-muted-foreground/80 hover:text-muted-foreground aria-pressed:bg-transparent ' +
  'aria-pressed:text-destructive-text'

type Row = { id: number; name: string; doing: boolean; focus: boolean }

// What an app's <entity>-focus-toggle.tsx renders. Here the save is a
// timer; in an app it's useRecordUpdate (Widget's useSaveWidgetField).
function FocusToggle({ row, onChange }: { row: Row; onChange: (focus: boolean) => void }) {
  const [saving, setSaving] = useState(false)
  return (
    <>
      <Toggle
        size="icon-xs"
        pressed={row.focus}
        aria-label={`Focus: ${row.name}`}
        className={FLAG_TOGGLE_CLASS}
        onPressedChange={(focus) => {
          onChange(focus)
          setSaving(true)
          setTimeout(() => setSaving(false), 600)
        }}
      >
        <FlagIcon className="group-aria-pressed/toggle:fill-current" />
      </Toggle>
      <span className="inline-flex size-3.5 shrink-0">
        {saving && <Spinner aria-label="Saving" className="size-3.5 text-muted-foreground" />}
      </span>
    </>
  )
}

const INITIAL_ROWS: Row[] = [
  { id: 1, name: 'Desk lamp', doing: true, focus: true },
  { id: 2, name: 'Bookshelf', doing: true, focus: false },
  { id: 3, name: 'Office chair', doing: false, focus: false },
]

export const PressedIconInACell: StoryObj = {
  render: function Render() {
    const [rows, setRows] = useState(INITIAL_ROWS)
    return (
      <table aria-label="Pressed icon in a cell" className="type-body">
        <thead>
          <tr>
            <th className="pr-6 text-left type-label">Name</th>
            <th className="text-left type-label">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="py-1 pr-6">{row.name}</td>
              <td className="py-1">
                <span className="inline-flex items-center gap-1.5">
                  <StageCircle stage={row.doing ? 2 : 0} tone={row.doing ? 'info' : 'muted'} />
                  {row.doing ? 'Doing' : 'Planned'}
                  {/* Only while the owning value allows it. */}
                  {row.doing && (
                    <FocusToggle
                      row={row}
                      onChange={(focus) =>
                        setRows((current) => current.map((other) => (other.id === row.id ? { ...other, focus } : other)))
                      }
                    />
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  },
}

// --- Pattern 4, several values as icons, names in one tooltip -----------

type Category = { name: string; icon: ComponentType<{ className?: string }>; colour: string }

// An app's lookups: the icon from the record, the colour slot from its
// own map (whole class names, never built by interpolation).
// All eight slots, so the glyph check measures each one in both themes.
const CATEGORIES: Record<string, Category> = {
  home: { name: 'Home', icon: HouseIcon, colour: 'text-category-1' },
  finance: { name: 'Finance', icon: WalletIcon, colour: 'text-category-2' },
  work: { name: 'Work', icon: BriefcaseIcon, colour: 'text-category-3' },
  repairs: { name: 'Repairs', icon: WrenchIcon, colour: 'text-category-4' },
  health: { name: 'Health', icon: HeartIcon, colour: 'text-category-5' },
  travel: { name: 'Travel', icon: PlaneIcon, colour: 'text-category-6' },
  shopping: { name: 'Shopping', icon: ShoppingCartIcon, colour: 'text-category-7' },
  reading: { name: 'Reading', icon: BookOpenIcon, colour: 'text-category-8' },
}

// `undefined` is a value still loading: "…", never a bare id.
function IconGroup({ values }: { values: (Category | undefined)[] }) {
  if (values.length === 0) return <span className="text-muted-foreground">—</span>
  const names = values.map((value) => value?.name ?? '…').join(', ')
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="img"
            aria-label={names}
            tabIndex={0}
            className="inline-flex items-center gap-1 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        {values.map((value, index) => {
          if (!value) {
            return (
              <span key={index} className="text-muted-foreground">
                …
              </span>
            )
          }
          const Icon = value.icon
          return <Icon key={index} className={`size-4 shrink-0 ${value.colour}`} />
        })}
      </TooltipTrigger>
      <TooltipContent>{names}</TooltipContent>
    </Tooltip>
  )
}

export const IconsWithOneTooltip: StoryObj = {
  render: () => (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        <table aria-label="Icons with one tooltip" className="type-body">
          <thead>
            <tr>
              <th className="pr-6 text-left type-label">Name</th>
              <th className="text-left type-label">Categories</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-1 pr-6">Desk lamp</td>
              <td className="py-1">
                <IconGroup values={[CATEGORIES.home, CATEGORIES.finance]} />
              </td>
            </tr>
            <tr>
              <td className="py-1 pr-6">Bookshelf</td>
              <td className="py-1">
                <IconGroup values={[CATEGORIES.repairs, CATEGORIES.home, CATEGORIES.finance]} />
              </td>
            </tr>
            <tr>
              <td className="py-1 pr-6">Office chair</td>
              <td className="py-1">
                <IconGroup values={[CATEGORIES.repairs, undefined]} />
              </td>
            </tr>
            <tr>
              <td className="py-1 pr-6">Standing mat</td>
              <td className="py-1">
                <IconGroup values={[]} />
              </td>
            </tr>
          </tbody>
        </table>
        {/* Where there's room (the record's view): each icon beside its name. */}
        <dl>
          <dt className="type-label">Categories</dt>
          <dd className="flex flex-wrap gap-x-3 gap-y-1">
            {Object.values(CATEGORIES).map(({ name, icon: Icon, colour }) => (
              <span key={name} className="inline-flex items-center gap-1.5">
                <Icon aria-hidden="true" className={`size-4 shrink-0 ${colour}`} />
                {name}
              </span>
            ))}
          </dd>
        </dl>
      </div>
    </TooltipProvider>
  ),
}

// --- Pattern 10, a dependency list ---------------------------------------

type Dependency = { kind: 'Parts' | 'Dates' | 'Links'; name: string; held: string | null }

const KIND_ICON: Record<Dependency['kind'], ComponentType<{ className?: string; 'aria-hidden'?: 'true' }>> = {
  Parts: PackageIcon,
  Dates: CalendarClockIcon,
  Links: LinkIcon,
}

function DependencySummary({ name, dependencies }: { name: string; dependencies: Dependency[] }) {
  const holds = dependencies.filter((dependency) => dependency.held !== null).length
  const summary = holds === 0 ? 'Ready' : `${holds} ${holds === 1 ? 'hold' : 'holds'}`
  // Nothing linked, nothing to open: plain text, not a button.
  if (dependencies.length === 0) return <span>{summary}</span>
  const kinds = (Object.keys(KIND_ICON) as Dependency['kind'][]).filter((kind) =>
    dependencies.some((dependency) => dependency.kind === kind),
  )
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={100}
        aria-label={`${summary}: what ${name} depends on`}
        className="rounded-sm underline decoration-dotted underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {summary}
      </PopoverTrigger>
      <PopoverContent aria-label={`What ${name} depends on`} className="w-auto min-w-48">
        {kinds.map((kind) => {
          const Icon = KIND_ICON[kind]
          return (
            <section key={kind} aria-label={kind} className="flex flex-col gap-1">
              <h3 className="type-caption text-muted-foreground">{kind}</h3>
              <ul className="flex flex-col gap-1">
                {dependencies
                  .filter((dependency) => dependency.kind === kind)
                  .map((dependency) => (
                    <li
                      key={dependency.name}
                      className={`inline-flex items-center gap-1.5 ${dependency.held ? 'text-foreground' : 'text-muted-foreground'}`}
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      {dependency.name}
                      {dependency.held ? <span>: {dependency.held}</span> : <span className="sr-only">: clear</span>}
                    </li>
                  ))}
              </ul>
            </section>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}

export const DependencyList: StoryObj = {
  render: () => (
    <table aria-label="Dependency list" className="type-body">
      <thead>
        <tr>
          <th className="pr-6 text-left type-label">Name</th>
          <th className="text-left type-label">Depends on</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="py-1 pr-6">Desk lamp</td>
          <td className="py-1">
            <DependencySummary
              name="Desk lamp"
              dependencies={[
                { kind: 'Parts', name: 'Bulb', held: 'unavailable' },
                { kind: 'Parts', name: 'Cable', held: null },
                { kind: 'Dates', name: 'Delivery day', held: "hasn't happened" },
                { kind: 'Links', name: 'Bookshelf', held: null },
              ]}
            />
          </td>
        </tr>
        <tr>
          <td className="py-1 pr-6">Bookshelf</td>
          <td className="py-1">
            <DependencySummary name="Bookshelf" dependencies={[{ kind: 'Parts', name: 'Screws', held: null }]} />
          </td>
        </tr>
        <tr>
          <td className="py-1 pr-6">Office chair</td>
          <td className="py-1">
            <DependencySummary name="Office chair" dependencies={[]} />
          </td>
        </tr>
      </tbody>
    </table>
  ),
}

// --- Pattern 20, a count linking to the related records -----------------

// Underlined at rest: a bare number doesn't look like it goes anywhere.
const COUNT_LINK_CLASS =
  'rounded-sm tabular-nums text-foreground underline underline-offset-4 outline-none ' +
  'hover:decoration-2 focus-visible:ring-3 focus-visible:ring-ring/50'

type Project = { id: number; name: string; openTaskCount: number }

// In an app it's react-router's <Link>; here the click is kept from
// leaving the story.
function CountLink({ project }: { project: Project }) {
  const { id, name, openTaskCount: count } = project
  if (count === 0) return <span className="tabular-nums">0</span>
  return (
    <a
      href={`/tasks?project=${id}`}
      aria-label={`${count} open ${count === 1 ? 'task' : 'tasks'} in ${name}`}
      className={COUNT_LINK_CLASS}
      onClick={(event) => event.preventDefault()}
    >
      {count}
    </a>
  )
}

const PROJECTS: Project[] = [
  { id: 1, name: 'Kitchen remodel', openTaskCount: 3 },
  { id: 2, name: 'Garden', openTaskCount: 1 },
  { id: 3, name: 'Taxes', openTaskCount: 0 },
  { id: 4, name: 'Move house', openTaskCount: 12 },
]

export const CountLinkingToRecords: StoryObj = {
  render: () => (
    <table aria-label="Count linking to the related records" className="type-body">
      <thead>
        <tr>
          <th className="pr-6 text-left type-label">Name</th>
          <th className="text-left type-label">Open tasks</th>
        </tr>
      </thead>
      <tbody>
        {PROJECTS.map((project) => (
          <tr key={project.id}>
            <td className="py-1 pr-6">{project.name}</td>
            <td className="py-1">
              <CountLink project={project} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
}
