import type { Meta, StoryObj } from '@/fixtures/types'
import { useRef, useState, type ReactElement } from 'react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import {
  CalendarClockIcon,
  CalendarIcon,
  CircleDotIcon,
  HashIcon,
  PackageIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { AppError } from '@/api/contracts'
import { editInPlace } from './edit-in-place'
import { inPlace } from './edit-in-place-presets'
import { EditableValue } from './editable-value'
import { IconAction } from './icon-action'
import {
  EntityView,
  type EntityViewLayout,
  type EntityViewMobileOrder,
  type EntityViewRailFields,
  type EntityViewSection,
} from './entity-view'
import { KeyStats } from './key-stats'
import { Markdown } from './markdown'
import { Notice } from './notice'
import { RichTextEditor } from './rich-text-editor'
import { StatusMark } from './status-mark'
import { SourceCredit } from './source-credit'

// One record in both layouts: `column` (the default) and `rail`, the
// short sections in a column on the right of long Markdown. Axe and the
// token check measure both in both themes, and e2e/entity-view.spec.ts
// pins the rail's geometry, order and stickiness. Editing in place needs a
// data router (its leave prompt is React Router's useBlocker), so each
// story renders in a memory one; Owner saves after a short wait. Lists
// edits two sub-item lists in place (a checklist in the main column, links
// in the rail), each change saved after a short wait. Autosave is long
// text saved as it's typed: notes that are the editor, and a summary that
// opens on a click. Rail, main first is the rail layout with
// `mobileOrder="main-first"`: the same at a desktop width, Notes straight
// after the header on a phone. Tabs, Leading and Rail fields beside are
// 4.76's opt-ins, measured in e2e/entity-view-tabs.spec.ts. Details tab
// and Details in the column are 4.98's record standard (1A, 2A, 5B): the
// `tabs` layout, the default, with no rail, measured in
// e2e/entity-view-details.spec.ts.

// Long enough to scroll past a rail, with a table wider than the column
// layout's 896px (it scrolls sideways there) but not than the rail
// layout's main column on a wide screen.
const NOTES = `# Background

The office moves to the third floor in March. Every desk, chair and
cabinet is tagged by the week it moves, and each team packs its own
boxes the Friday before.

${Array.from(
  { length: 8 },
  (_, week) =>
    `## Week ${week + 1}\n\nPack the shared shelves first, then personal desks. Label each box with the room it goes to and the team's colour, and leave the fragile ones open until the movers check them.`,
).join('\n\n')}

# Schedule

| Week | Team | Room | Ticket | Desks | Chairs | Cabinets | Monitors | Plants | Boxes | Lift slot | Contact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Finance | 3.01 | MOVE-2026-0001-FINANCE | 12 | 12 | 4 | 24 | 3 | 40 | 08:00–10:00 | finance-move-lead@example.com |
| 2 | Design | 3.04 | MOVE-2026-0002-DESIGN | 8 | 10 | 2 | 16 | 6 | 35 | 10:00–12:00 | design-move-lead@example.com |
| 3 | Support | 3.07 | MOVE-2026-0003-SUPPORT | 20 | 20 | 1 | 40 | 2 | 50 | 13:00–15:00 | support-move-lead@example.com |

Measure twice, cut once.
`

function useOwner() {
  const [owner, setOwner] = useState('Ada Lovelace')
  const owners = editInPlace<string>({
    kind: 'text',
    value: owner,
    save: (next) => new Promise((resolve) => setTimeout(() => resolve(setOwner(next)), 300)),
    control: (props) => (
      <Input
        id={props.id}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        readOnly={props.disabled}
        aria-invalid={props.invalid || undefined}
        aria-label={props.label}
        aria-describedby={props.describedBy}
      />
    ),
  })
  return { owner, owners }
}

function Record({
  layout,
  mobileOrder,
  railFields,
}: {
  layout: EntityViewLayout
  mobileOrder?: EntityViewMobileOrder
  railFields?: EntityViewRailFields
}) {
  const { owner, owners } = useOwner()
  const sections: EntityViewSection[] = [
    {
      title: 'Summary',
      placement: 'rail',
      fields: [
        { label: 'Owner', value: owner, edit: owners },
        { label: 'Floor', value: 'Third' },
        { label: 'Starts', value: 'Mar 2, 2026' },
        { label: 'Contact', value: 'facilities-desk@example.com' },
        { label: 'Budget', value: null, emptyLabel: 'No budget yet' },
      ],
    },
    {
      title: 'Links',
      placement: 'rail',
      content: (
        <ul className="flex flex-col gap-1">
          <li>
            <a className="text-link underline underline-offset-4" href="#floor-plan">
              Floor plan
            </a>
          </li>
          <li>
            <a className="text-link underline underline-offset-4" href="#movers">
              Movers' quote
            </a>
          </li>
        </ul>
      ),
    },
    { title: 'Notes', content: <Markdown>{NOTES}</Markdown> },
    { title: 'Follow-ups', content: null, emptyLabel: 'No follow-ups' },
  ]
  return (
    <EntityView
      layout={layout}
      mobileOrder={mobileOrder}
      railFields={railFields}
      isLoading={false}
      back={{ to: '/', label: 'Projects' }}
      title="Office move"
      badges={<Badge variant="outline">In progress</Badge>}
      actions={<Button variant="outline">Edit</Button>}
      sections={sections}
    />
  )
}

function InRouter({
  layout,
  mobileOrder,
  railFields,
}: {
  layout: EntityViewLayout
  mobileOrder?: EntityViewMobileOrder
  railFields?: EntityViewRailFields
}) {
  const [router] = useState(() =>
    createMemoryRouter([
      { path: '/', element: <Record layout={layout} mobileOrder={mobileOrder} railFields={railFields} /> },
    ]),
  )
  return <RouterProvider router={router} />
}

const meta: Meta = {
  title: 'app/EntityView',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
}

export default meta

export const Column: StoryObj = { render: () => <InRouter layout="column" /> }

export const Rail: StoryObj = { render: () => <InRouter layout="rail" /> }

export const RailMainFirst: StoryObj = {
  name: 'Rail, main first',
  render: () => <InRouter layout="rail" mobileOrder="main-first" />,
}

function LoadingRail() {
  const [router] = useState(() =>
    createMemoryRouter([
      {
        path: '/',
        element: <EntityView layout="rail" isLoading back={{ to: '/', label: 'Projects' }} sections={[]} />,
      },
    ]),
  )
  return <RouterProvider router={router} />
}

export const RailLoading: StoryObj = { render: () => <LoadingRail /> }

// Rail fields stacked: `railFields="stacked"`, each rail label above its
// value, as every rail was before 4.81 made `beside` the default (Rail).
export const RailFieldsStacked: StoryObj = {
  name: 'Rail fields stacked',
  render: () => <InRouter layout="rail" railFields="stacked" />,
}

// --- Tabs -------------------------------------------------------------------
// A how-to record whose main column is grouped under tabs (#303): Overview
// has no tab and stays above the list; Steps, Used in and Reasoning are
// tabs, the second with two sections. The rail always shows. The selected
// tab is `?tab=`: the story's memory router starts at the harness page's
// own `tab` (so e2e can open a deep link) and prints its address under the
// view. Owner, in Steps' Details, edits in place inside a tab.

function TabsRecord({ layout }: { layout: EntityViewLayout }) {
  const { owner, owners } = useOwner()
  const location = useLocation()
  const sections: EntityViewSection[] = [
    {
      title: 'Summary',
      placement: 'rail',
      fields: [
        { label: 'Floor', value: 'Third' },
        { label: 'Starts', value: 'Mar 2, 2026' },
        { label: 'Reviewed', value: null, emptyLabel: 'Never' },
      ],
    },
    { title: 'Overview', content: <p>How a team packs its desks the Friday before it moves.</p> },
    {
      title: 'Steps',
      tab: 'Steps',
      content: (
        <Markdown>
          {`1. Empty the shared shelves first.\n2. Pack each desk into labelled boxes.\n3. Leave the fragile boxes open until the movers check them.`}
        </Markdown>
      ),
    },
    {
      title: 'Details',
      tab: 'Steps',
      fields: [
        { label: 'Owner', value: owner, edit: owners },
        { label: 'Takes', value: 'About two hours' },
      ],
    },
    {
      title: 'Where it applies',
      tab: 'Used in',
      content: (
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>Week 1: Finance</li>
          <li>Week 2: Design</li>
          <li>Week 3: Support</li>
        </ul>
      ),
    },
    {
      title: 'Exceptions',
      tab: 'Used in',
      content: null,
      emptyLabel: 'No exceptions',
    },
    {
      title: 'Why this order',
      tab: 'Reasoning',
      content: <Markdown>{NOTES}</Markdown>,
    },
  ]
  return (
    <>
      <EntityView
        layout={layout}
        mobileOrder="main-first"
        isLoading={false}
        back={{ to: '/', label: 'Guides' }}
        title="Packing a desk"
        badges={<Badge variant="outline">Current</Badge>}
        actions={<Button variant="outline">Delete</Button>}
        strip={
          <KeyStats
            stats={[
              { label: 'Steps', value: '3' },
              { label: 'Teams', value: '3' },
              { label: 'Takes', value: '2h' },
            ]}
          />
        }
        sections={sections}
      />
      <p data-testid="address" className="mt-6 type-caption text-muted-foreground">
        Page at {location.pathname + location.search}
      </p>
    </>
  )
}

function TabsInRouter({ layout }: { layout: EntityViewLayout }) {
  const [router] = useState(() => {
    const tab = new URLSearchParams(window.location.search).get('tab')
    return createMemoryRouter([{ path: '/', element: <TabsRecord layout={layout} /> }], {
      initialEntries: [tab ? `/?tab=${encodeURIComponent(tab)}` : '/'],
    })
  })
  return <RouterProvider router={router} />
}

export const Tabs: StoryObj = { render: () => <TabsInRouter layout="rail" /> }

export const TabsColumn: StoryObj = { name: 'Tabs, column', render: () => <TabsInRouter layout="column" /> }

// --- The record standard (4.98): no right rail -----------------------------
// The `tabs` layout, the default (1A): Summary, the short facts placed
// `rail`, is the last tab, Details; Notes has a small box of facts beside
// it (placed `rail` with its `tab`), under it on a phone; the strip is as
// wide as its numbers (2A); the status is a StatusMark (5B). The memory
// router starts at the harness page's own `tab`, as Tabs does. The tab
// bar is 3B's (4.101): Changes shows its count, and the bar sticks with
// the record's name above it as Notes scrolls under it.

function DetailsTabRecord() {
  const location = useLocation()
  const sections: EntityViewSection[] = [
    {
      title: 'Summary',
      placement: 'rail',
      fields: [
        { label: 'Kind', value: 'Office move' },
        { label: 'Floor', value: 'Third' },
        { label: 'Starts', value: 'Mar 2, 2026' },
        { label: 'Owner', value: null, emptyLabel: 'Unassigned' },
        { label: 'Teams', value: <Badge variant="outline">Finance</Badge> },
      ],
    },
    { title: 'Notes', tab: 'Notes', content: <Markdown>{NOTES}</Markdown> },
    {
      title: 'Packing',
      tab: 'Notes',
      placement: 'rail',
      fields: [
        { label: 'Boxes', value: '12' },
        { label: 'Labels', value: 'By team' },
      ],
    },
    {
      title: 'Changes',
      tab: 'Changes',
      content: (
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>Mar 1: the movers moved to the morning.</li>
          <li>Feb 20: Support joins week 3.</li>
        </ul>
      ),
    },
  ]
  return (
    <>
      <EntityView
        isLoading={false}
        back={{ to: '/', label: 'Projects' }}
        title="Office move"
        badges={<StatusMark kind="active">In Progress</StatusMark>}
        actions={<IconAction icon={Trash2Icon} label="Delete" tone="destructive" />}
        tabCounts={{ Changes: 2 }}
        strip={
          <KeyStats
            stats={[
              { label: 'Boxes', value: '12', icon: PackageIcon },
              { label: 'Starts', value: 'Mar 2', icon: CalendarIcon },
              { label: 'Teams', value: '3', icon: HashIcon },
            ]}
          />
        }
        sections={sections}
      />
      <p data-testid="address" className="mt-6 type-caption text-muted-foreground">
        Page at {location.pathname + location.search}
      </p>
    </>
  )
}

function DetailsTabInRouter() {
  const [router] = useState(() => {
    const tab = new URLSearchParams(window.location.search).get('tab')
    return createMemoryRouter([{ path: '/', element: <DetailsTabRecord /> }], {
      initialEntries: [tab ? `/?tab=${encodeURIComponent(tab)}` : '/'],
    })
  })
  return <RouterProvider router={router} />
}

export const DetailsTab: StoryObj = { name: 'Details tab', render: () => <DetailsTabInRouter /> }

// --- The facts rail (4.106, A1) --------------------------------------------
// `factsRail`: where the view has 60rem, the sections of short facts
// (`facts`, placed `rail`) sit in a 300px column beside the open tab's
// content (the strip above both, 4.108) and leave Details. FactsRail
// keeps one long-text facts section (`fields`, the closing condition) in
// Details; FactsRailOnly has nothing else, so it has no Details tab;
// FactsRailNoTabs has cards and no tabs, the rail level with the first. A list of linked records with long
// titles (the Linked tab) stays a tab. Narrower than 60rem (a phone),
// every facts section is back in Details.

const LINKED = [
  'Ask the landlord whether the loading bay can be booked for the whole of the second morning',
  'Find out which of the old desks the recycling firm will still take after the end of the month',
]

function FactsRailRecord({ only, untabbed = false }: { only: boolean; untabbed?: boolean }) {
  const location = useLocation()
  const tab = (name: string) => (untabbed ? {} : { tab: name })
  const sections: EntityViewSection[] = [
    { title: 'Purpose', ...tab('Purpose'), content: <Markdown>{'Move the team to the third floor over two weekends.'}</Markdown> },
    {
      title: 'Linked',
      ...tab('Linked'),
      content: (
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {LINKED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ),
    },
    {
      title: 'Facts',
      placement: 'rail',
      facts: [
        { label: 'Status', kind: 'status', status: 'active', word: 'Open' },
        { label: 'By', kind: 'text', text: 'Mar 2, 2026' },
        { label: 'Boxes', kind: 'text', text: 12 },
        { label: 'Owner', kind: 'record', name: 'Sam Example', to: '/people/3', short: true },
        { label: 'Teams', kind: 'badges', items: ['Finance', 'Support'] },
        { label: 'Open Tasks', kind: 'count', count: 4, to: '/tasks?project=1' },
        { label: 'Floor Plan', kind: 'link', href: 'https://example.com/plan', name: 'Plan (PDF)' },
        { label: 'Lift', kind: 'text', text: null, emptyLabel: 'Not booked' },
      ],
    },
    ...(only
      ? []
      : [
          {
            title: 'Closing',
            placement: 'rail' as const,
            fields: [{ label: 'Closes When', value: 'Every team has unpacked and the old floor is handed back clean' }],
          },
        ]),
  ]
  return (
    <>
      <EntityView
        isLoading={false}
        back={{ to: '/', label: 'Projects' }}
        title="Office move"
        badges={<StatusMark kind="active">In Progress</StatusMark>}
        actions={<IconAction icon={Trash2Icon} label="Delete" tone="destructive" />}
        tabCounts={{ Linked: LINKED.length }}
        factsRail
        strip={
          <KeyStats
            stats={[
              { label: 'Boxes', value: '12', icon: PackageIcon },
              { label: 'Starts', value: 'Mar 2', icon: CalendarIcon },
            ]}
          />
        }
        sections={sections}
      />
      <p data-testid="address" className="mt-6 type-caption text-muted-foreground">
        Page at {location.pathname + location.search}
      </p>
    </>
  )
}

function FactsRailInRouter({ only, untabbed }: { only: boolean; untabbed?: boolean }) {
  const [router] = useState(() => {
    const tab = new URLSearchParams(window.location.search).get('tab')
    return createMemoryRouter([{ path: '*', element: <FactsRailRecord only={only} untabbed={untabbed} /> }], {
      initialEntries: [tab ? `/?tab=${encodeURIComponent(tab)}` : '/'],
    })
  })
  return <RouterProvider router={router} />
}

export const FactsRail: StoryObj = { name: 'Facts rail', render: () => <FactsRailInRouter only={false} /> }

export const FactsRailOnly: StoryObj = { name: 'Facts rail, nothing else', render: () => <FactsRailInRouter only /> }

export const FactsRailNoTabs: StoryObj = {
  name: 'Facts rail, no tabs',
  render: () => <FactsRailInRouter only untabbed />,
}

// --- The record's status in the rail (4.115) -------------------------------
// The status first at the top of the rail, whatever its place: Status is
// listed last in its section, and its section after Schedule. It changes
// only through an action, so it's read-only, with "Close…" under it (the
// app's own dialog, opened from the fact's button) and a hint saying why.
// Teams are badges with icons. The strip's values are edited in place,
// inline: nothing moves when one is hovered or focused, so the click
// lands on the value under the mouse (e2e/facts-rail.spec.ts).

function CloseDialog({ trigger, onClose }: { trigger: ReactElement; onClose: () => void }) {
  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close this project?</DialogTitle>
          <DialogDescription>Closing records today's date and a reason.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <DialogClose render={<Button />} onClick={onClose}>
            Close Project
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const STRIP_START = { boxes: 84, crates: 12, floor: 'Third', lift: 'Mar 9', budget: 4200, teams: 3 }

function FactsRailStatusRecord() {
  const [closed, setClosed] = useState(false)
  const [strip, setStrip] = useState(STRIP_START)
  const save = (patch: Partial<typeof STRIP_START>) =>
    new Promise((resolve) => setTimeout(() => resolve(setStrip((was) => ({ ...was, ...patch }))), 200))
  const number = (key: 'boxes' | 'crates' | 'budget' | 'teams', label: string) => ({
    label,
    value: (
      <EditableValue
        label={label}
        layout="inline"
        edit={inPlace.number({ value: strip[key], min: 0, save: (next) => save({ [key]: next ?? 0 }) })}
      />
    ),
  })
  const text = (key: 'floor' | 'lift', label: string) => ({
    label,
    value: <EditableValue label={label} layout="inline" edit={inPlace.text({ value: strip[key], save: (next) => save({ [key]: next ?? '' }) })} />,
  })
  const sections: EntityViewSection[] = [
    { title: 'Purpose', tab: 'Purpose', content: <Markdown>{'Move the team to the third floor over two weekends.'}</Markdown> },
    {
      title: 'Schedule',
      placement: 'rail',
      facts: [
        { label: 'Starts', kind: 'text', text: 'Mar 2, 2026' },
        { label: 'Ends', kind: 'text', text: 'Mar 16, 2026' },
      ],
    },
    {
      title: 'Facts',
      placement: 'rail',
      facts: [
        { label: 'Owner', kind: 'record', name: 'Sam Example', to: '/people/3', short: true },
        {
          label: 'Teams',
          kind: 'badges',
          items: [
            { label: 'Finance', icon: HashIcon },
            { label: 'Support', icon: <CircleDotIcon className="size-3" /> },
            'Facilities',
          ],
        },
        {
          label: 'Status',
          recordStatus: true,
          kind: 'status',
          status: closed ? 'done' : 'active',
          word: closed ? 'Closed' : 'Open',
          hint: 'Changes when the project is closed, which records a date and a reason.',
          action: closed
            ? undefined
            : { label: 'Close…', render: (button) => <CloseDialog trigger={button} onClose={() => setClosed(true)} /> },
        },
      ],
    },
  ]
  return (
    <EntityView
      isLoading={false}
      back={{ to: '/', label: 'Projects' }}
      title="Office move"
      factsRail
      strip={
        <KeyStats
          stats={[
            number('boxes', 'Boxes'),
            number('crates', 'Crates'),
            text('floor', 'Floor'),
            text('lift', 'Lift'),
            number('budget', 'Budget'),
            number('teams', 'Teams'),
          ]}
        />
      }
      sections={sections}
    />
  )
}

function FactsRailStatusInRouter() {
  const [router] = useState(() => {
    const tab = new URLSearchParams(window.location.search).get('tab')
    return createMemoryRouter([{ path: '*', element: <FactsRailStatusRecord /> }], {
      initialEntries: [tab ? `/?tab=${encodeURIComponent(tab)}` : '/'],
    })
  })
  return <RouterProvider router={router} />
}

export const FactsRailStatus: StoryObj = { name: 'Facts rail, status', render: () => <FactsRailStatusInRouter /> }

// The `tabs` layout with no other tab: the facts stay in the column, in
// their place, their labels beside their values.
export const DetailsInTheColumn: StoryObj = {
  name: 'Details in the column',
  render: () => <InRouter layout="tabs" />,
}

// --- A notice and a footer ------------------------------------------------

// A held record: the notice across the page under the header, cleared by
// the action (as a tick elsewhere on the page would), and the data's
// sources credited under both columns.
function HeldRecord() {
  const [held, setHeld] = useState(true)
  return (
    <EntityView
      layout="rail"
      isLoading={false}
      back={{ to: '/', label: 'Books' }}
      title="The Fall of Hyperion"
      badges={<Badge variant="outline">To read</Badge>}
      notice={
        held && (
          <Notice
            tone="warning"
            title="On hold"
            action={
              <Button size="sm" variant="outline" onClick={() => setHeld(false)}>
                Release the Hold
              </Button>
            }
          >
            Read “Hyperion” first: this one follows it.
          </Notice>
        )
      }
      sections={[
        {
          title: 'Details',
          placement: 'rail',
          fields: [
            { label: 'Author', value: 'Dan Simmons' },
            { label: 'Published', value: '1990' },
          ],
        },
        { title: 'Notes', content: <Markdown>{NOTES}</Markdown> },
      ]}
      footer={
        <SourceCredit
          sources={[
            {
              name: 'Open Library',
              href: 'https://openlibrary.org',
              icon: ExampleLibraryMark,
              note: 'Covers and editions are Open Library’s, under its terms.',
            },
            { name: 'Wikidata', href: 'https://www.wikidata.org' },
          ]}
        />
      }
    />
  )
}

// A made-up mark for the credit, as an app keeps its own: an icon
// component that passes className and aria-hidden on to its <svg>.
function ExampleLibraryMark({ className, ...rest }: { className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} {...rest}>
      <path d="M4 4h4v16H4zM10 4h4v16h-4zM16.2 4.6l3.8-1 3.9 15.5-3.9 1z" />
    </svg>
  )
}

function HeldInRouter() {
  const [router] = useState(() => createMemoryRouter([{ path: '/', element: <HeldRecord /> }]))
  return <RouterProvider router={router} />
}

export const NoticeAndFooter: StoryObj = { render: () => <HeldInRouter /> }

// --- Lists edited in place ------------------------------------------------

type Task = { text: string; done: boolean }
type Link = { label: string; url: string }

// A list held in state, saved after a short wait like a server would. The
// change is applied to the latest list when the "request" is sent, as
// useRecordUpdate does. An item whose text is "refuse" is refused the way
// a 422 is, with the field error on that item.
function useSavedList<TItem>(initial: TItem[], refused: (item: TItem) => boolean) {
  const [items, setItems] = useState(initial)
  const latest = useRef(initial)
  const save = (change: (current: TItem[]) => TItem[]) =>
    new Promise<void>((resolve, reject) =>
      setTimeout(() => {
        const next = change(latest.current)
        const at = next.findIndex(refused)
        if (at !== -1) {
          const error: AppError = {
            kind: 'validation',
            message: 'Check the highlighted fields.',
            fieldErrors: { [`items.${at}`]: ['That one is refused, as a server would.'] },
          }
          reject(error)
          return
        }
        latest.current = next
        setItems(next)
        resolve()
      }, 300),
    )
  return { items, setItems: (next: TItem[]) => setItems((latest.current = next)), save }
}

const TASK_SCHEMA = {
  safeParse: (value: unknown) => {
    const tasks = value as Task[]
    const blank = tasks.findIndex((task) => task.text.trim() === '')
    if (blank !== -1) return { success: false as const, error: { issues: [{ message: 'Write something or remove the item', path: [blank, 'text'] }] } }
    if (tasks.length > 10) return { success: false as const, error: { issues: [{ message: 'A checklist can have at most 10 items', path: [] }] } }
    return { success: true as const, data: tasks.map((task) => ({ ...task, text: task.text.trim() })) }
  },
}

function ListsRecord() {
  const tasks = useSavedList<Task>(
    [
      { text: 'Book the lift', done: true },
      { text: 'Label the boxes', done: false },
      { text: 'Return the keys', done: false },
    ],
    (task) => task.text === 'refuse',
  )
  const links = useSavedList<Link>([{ label: 'Floor plan', url: 'https://example.com/plan' }], (link) => link.label === 'refuse')

  const checklist = editInPlace<Task>({
    kind: 'list',
    value: tasks.items,
    schema: TASK_SCHEMA,
    save: tasks.save,
    newItem: () => ({ text: '', done: false }),
    itemName: (index) => `item ${index + 1}`,
    addLabel: 'Add Item',
    // A quick action: the box ticks and saves on its own; the text edits.
    renderShown: (task, index) => (
      <span className="flex items-start gap-2">
        <Checkbox
          className="mt-0.5"
          checked={task.done}
          aria-label={`Done: ${task.text}`}
          onCheckedChange={(done) => tasks.setItems(tasks.items.map((other, i) => (i === index ? { ...other, done } : other)))}
        />
        <span className={task.done ? 'text-muted-foreground' : undefined}>{task.text}</span>
      </span>
    ),
    // The form's row: the box and the text, over the draft.
    renderItem: ({ value, onChange, disabled, invalid, describedBy, index }) => (
      <span className="flex w-full items-start gap-2">
        <Checkbox
          className="mt-2.5"
          checked={value.done}
          disabled={disabled}
          aria-label={`Item ${index + 1} done`}
          onCheckedChange={(done) => onChange({ ...value, done })}
        />
        <Input
          value={value.text}
          readOnly={disabled}
          aria-invalid={invalid || undefined}
          aria-label={`Item ${index + 1} text`}
          aria-describedby={describedBy}
          onChange={(event) => onChange({ ...value, text: event.target.value })}
        />
      </span>
    ),
  })

  const linkList = editInPlace<Link>({
    kind: 'list',
    value: links.items,
    save: links.save,
    newItem: () => ({ label: '', url: '' }),
    itemName: (index) => `link ${index + 1}`,
    addLabel: 'Add Link',
    renderShown: (link) => (
      <a className="text-link underline underline-offset-4" href={link.url}>
        {link.label}
      </a>
    ),
    renderItem: ({ value, onChange, disabled, invalid, describedBy, index }) => (
      <span className="flex w-full flex-col gap-1.5">
        <Input
          value={value.label}
          readOnly={disabled}
          aria-invalid={invalid || undefined}
          aria-label={`Link ${index + 1} label`}
          aria-describedby={describedBy}
          onChange={(event) => onChange({ ...value, label: event.target.value })}
        />
        <Input
          value={value.url}
          readOnly={disabled}
          aria-label={`Link ${index + 1} address`}
          onChange={(event) => onChange({ ...value, url: event.target.value })}
        />
      </span>
    ),
  })

  const done = tasks.items.filter((task) => task.done).length
  const sections: EntityViewSection[] = [
    { title: 'Links', placement: 'rail', content: null, emptyLabel: 'No links', edit: linkList },
    {
      title: 'Checklist',
      content: tasks.items.length > 0 && (
        <p className="type-caption tabular-nums text-muted-foreground">
          {done}/{tasks.items.length} done
        </p>
      ),
      emptyLabel: 'No items',
      edit: checklist,
    },
    { title: 'Notes', content: <Markdown>Measure twice, cut once.</Markdown> },
  ]
  return (
    <EntityView
      layout="rail"
      isLoading={false}
      back={{ to: '/', label: 'Projects' }}
      title="Office move"
      sections={sections}
    />
  )
}

function ListsInRouter() {
  const [router] = useState(() => createMemoryRouter([{ path: '/', element: <ListsRecord /> }]))
  return <RouterProvider router={router} />
}

export const Lists: StoryObj = { render: () => <ListsInRouter /> }

// --- Long text that autosaves ---------------------------------------------

// Notes that are the editor itself (`alwaysEditable`) and a summary that
// opens on a click and autosaves as it's typed (`autosave`). Each save
// takes 500ms, so "Saving…" shows; text with "refuse" in it is refused
// the way a 500 is. Saves counts the requests a server would get.
function AutosaveRecord() {
  const [saved, setSaved] = useState({ notes: 'Pack the shared shelves first.', summary: 'Moving to the third floor.' })
  const [saves, setSaves] = useState(0)
  const saveText = (field: 'notes' | 'summary') => (text: string) =>
    new Promise<void>((resolve, reject) =>
      setTimeout(() => {
        setSaves((count) => count + 1)
        if (text.includes('refuse')) {
          const error: AppError = { kind: 'server', message: 'The server refused it, as a server would.' }
          reject(error)
          return
        }
        setSaved((current) => ({ ...current, [field]: text }))
        resolve()
      }, 500),
    )
  const longText = (field: 'notes' | 'summary', alwaysEditable: boolean) =>
    editInPlace<string>({
      kind: 'long-text',
      value: saved[field],
      autosave: true,
      alwaysEditable,
      save: saveText(field),
      control: (props) => (
        <RichTextEditor
          id={props.id}
          defaultValue={props.value}
          onChange={props.onChange}
          onProblem={props.onProblem}
          readOnly={props.disabled}
          autoFocus={!alwaysEditable}
          toolbar={alwaysEditable}
          aria-invalid={props.invalid || undefined}
          aria-label={props.label}
          aria-describedby={props.describedBy}
        />
      ),
    })
  const sections: EntityViewSection[] = [
    {
      title: 'Saved',
      placement: 'rail',
      fields: [
        { label: 'Saves', value: String(saves) },
        { label: 'Saved Notes', value: <span data-testid="saved-notes">{saved.notes}</span> },
      ],
    },
    { title: 'Summary', content: <Markdown>{saved.summary}</Markdown>, edit: longText('summary', false) },
    { title: 'Notes', content: <Markdown>{saved.notes}</Markdown>, edit: longText('notes', true) },
  ]
  return <EntityView layout="rail" isLoading={false} back={{ to: '/projects', label: 'Projects' }} title="Office move" sections={sections} />
}

function AutosaveInRouter() {
  const [router] = useState(() =>
    createMemoryRouter([
      { path: '/', element: <AutosaveRecord /> },
      { path: '/projects', element: <p>Projects</p> },
    ]),
  )
  return <RouterProvider router={router} />
}

export const Autosave: StoryObj = { render: () => <AutosaveInRouter /> }

// HeaderSlots: `subtitle` under the title, a goal edited in place there
// (an <EditableValue> of its own), and `strip`, the record's key numbers
// as <KeyStats>, above the rail and the main column (before both on a
// phone).
function HeaderSlotsRecord() {
  const [goal, setGoal] = useState('Every team settled on the third floor by the end of March.')
  const goals = editInPlace<string>({
    kind: 'text',
    value: goal,
    save: (next) => new Promise((resolve) => setTimeout(() => resolve(setGoal(next)), 300)),
    control: (props) => (
      <Input
        id={props.id}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        readOnly={props.disabled}
        aria-invalid={props.invalid || undefined}
        aria-label={props.label}
        aria-describedby={props.describedBy}
      />
    ),
  })
  const sections: EntityViewSection[] = [
    {
      title: 'Summary',
      placement: 'rail',
      fields: [
        { label: 'Floor', value: 'Third' },
        { label: 'Starts', value: 'Mar 2, 2026' },
      ],
    },
    { title: 'Notes', content: <Markdown>Measure twice, cut once.</Markdown> },
  ]
  return (
    <EntityView
      layout="rail"
      isLoading={false}
      back={{ to: '/', label: 'Projects' }}
      title="Office move"
      subtitle={
        <EditableValue label="Goal" edit={goals} layout="inline">
          {goal}
        </EditableValue>
      }
      badges={<Badge variant="outline">In progress</Badge>}
      strip={
        <KeyStats
          stats={[
            { label: 'Boxes packed', value: '84', hint: 'of 125' },
            { label: 'Teams moved', value: '1', hint: 'of 3' },
            { label: 'Next lift slot', value: 'Mar 9' },
            { label: 'Budget left', value: null },
          ]}
        />
      }
      actions={<Button variant="outline">Edit</Button>}
      sections={sections}
    />
  )
}

function HeaderSlotsInRouter() {
  const [router] = useState(() => createMemoryRouter([{ path: '/', element: <HeaderSlotsRecord /> }]))
  return <RouterProvider router={router} />
}

export const HeaderSlots: StoryObj = { render: () => <HeaderSlotsInRouter /> }

// --- Leading -----------------------------------------------------------------
// `leading`, left of the title: a person's initials as an avatar
// (Leading), and an icon as a record's mark beside a long title (Leading,
// a mark), with a subtitle, badges and actions, so the header's wrapping
// is seen with it at a phone's width too.

function AvatarRecord() {
  return (
    <EntityView
      isLoading={false}
      back={{ to: '/', label: 'People' }}
      title="Ada Lovelace"
      leading={
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-full bg-muted type-section-title text-foreground"
        >
          AL
        </span>
      }
      subtitle="Facilities lead, third floor"
      badges={<Badge variant="outline">Mover</Badge>}
      actions={<Button variant="outline">Delete</Button>}
      sections={[{ title: 'Notes', content: <p>Keeps the floor plan.</p> }]}
    />
  )
}

function MarkRecord() {
  return (
    <EntityView
      isLoading={false}
      back={{ to: '/', label: 'Projects' }}
      title="Office move with a long name that wraps onto a second line on a phone"
      leading={
        <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
          <PackageIcon aria-hidden="true" className="size-5" />
        </span>
      }
      badges={<Badge variant="outline">In progress</Badge>}
      actions={
        <>
          <Button variant="outline">Print</Button>
          <Button variant="outline">Delete</Button>
        </>
      }
      sections={[{ title: 'Notes', content: <p>Measure twice, cut once.</p> }]}
    />
  )
}

function LeadingInRouter({ mark }: { mark?: boolean }) {
  const [router] = useState(() =>
    createMemoryRouter([{ path: '/', element: mark ? <MarkRecord /> : <AvatarRecord /> }]),
  )
  return <RouterProvider router={router} />
}

export const Leading: StoryObj = { render: () => <LeadingInRouter /> }

export const LeadingMark: StoryObj = { name: 'Leading, a mark', render: () => <LeadingInRouter mark /> }

// --- Many actions -----------------------------------------------------------
// A record with eight header actions at 36px: the title keeps its room and
// the actions wrap under one another, right-aligned (4.63.2; before, they
// took the whole row and left the title 0px wide).

function ManyActionsRecord() {
  const labels = ['Print notes', 'Step back', 'Advance', 'Save as version', 'Compare with…', 'Print', 'Edit', 'Delete']
  return (
    <EntityView
      isLoading={false}
      back={{ to: '/', label: 'Projects' }}
      title="Office move"
      subtitle="Phase 1 · Pack · V2"
      actions={labels.map((label) => (
        <Button key={label} variant="outline">
          {label}
        </Button>
      ))}
      sections={[{ title: 'Details', content: <p>In progress</p> }]}
    />
  )
}

function ManyActionsInRouter() {
  const [router] = useState(() => createMemoryRouter([{ path: '/', element: <ManyActionsRecord /> }]))
  return <RouterProvider router={router} />
}

export const ManyActions: StoryObj = { render: () => <ManyActionsInRouter /> }

// --- Printing the notes ---------------------------------------------------
// A visit's page with its prep and questions marked `print`: the header
// gets Print notes, and paper shows those two sections alone under the
// title (e2e/entity-view-print.spec.ts): the table ruled with room to
// write, each numbered question with space under it, no rail, no buttons.
// The Questions list is folded under a foldKey on screen; printed, it's
// whole.

const PREP = `# Going in

- **Bring:** the referral letter and the list of current medicines
- **Ask at the desk:** whether parking is validated

## Before and after

Rate each from 0 to 10.

| Movement | Before | That evening | Next day |
|---|---|---|---|
| Climbing the stairs | | | |
| Lifting the shopping | | | |
| Getting out of the car | | | |
`

const QUESTIONS = `# Questions {toggle="true"}

In priority order.

1. **Limits afterwards:** exercise, lifting, travel?

   **Answer:**

2. **Follow-up:** is a second visit booked?

   **Answer:**

3. **Next step:** what if it doesn't help?

   **Answer:**
`

function PrintRecord() {
  const sections: EntityViewSection[] = [
    {
      title: 'Visit',
      placement: 'rail',
      fields: [
        { label: 'Status', value: <Badge variant="outline">Scheduled</Badge> },
        { label: 'With', value: 'The clinic' },
      ],
    },
    { title: 'Prep', content: <Markdown>{PREP}</Markdown>, print: true },
    {
      title: 'Questions',
      content: <Markdown foldKey="fixtures:print:questions">{QUESTIONS}</Markdown>,
      print: { answerSpace: true },
    },
    { title: 'Files', content: null, emptyLabel: 'No files yet' },
  ]
  return (
    <EntityView
      layout="rail"
      isLoading={false}
      back={{ to: '/', label: 'Visits' }}
      title="Check-up"
      subtitle="Mar 9, 2026 · Visit"
      actions={<Button variant="outline">Edit</Button>}
      sections={sections}
    />
  )
}

function PrintInRouter() {
  const [router] = useState(() => createMemoryRouter([{ path: '/', element: <PrintRecord /> }]))
  return <RouterProvider router={router} />
}

export const PrintNotes: StoryObj = { name: 'Print notes', render: () => <PrintInRouter /> }

// --- Record standard (4.81) ---------------------------------------------------
// The record page standard together: the status and a badge on the title's
// line (a long title pushes them under it: Record standard, long title),
// the record's own command in words and Print notes and Delete as icons
// (`IconAction`, a tooltip and a name each), the strip's labels with their
// concept's icon, rail labels beside values (the default), and
// `emptyFields="fold"`: each card lists its filled fields, then "N empty"
// opens the rest, edited in place. An empty value reads as a dash.
// "Add the phone" in Notes sets Phone from elsewhere, so it joins its
// card. e2e/entity-view-standard.spec.ts measures it.

function useText(initial: string | null) {
  const [value, setValue] = useState<string | null>(initial)
  const edit = inPlace.text({
    value,
    save: (next) => new Promise((resolve) => setTimeout(() => resolve(setValue(next)), 200)),
  })
  return [value, setValue, edit] as const
}

function DeleteAction({ name }: { name: string }) {
  return (
    <Dialog>
      <DialogTrigger render={<IconAction icon={Trash2Icon} label="Delete" tone="destructive" />} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {name}?</DialogTitle>
          <DialogDescription>You can undo this right after.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <DialogClose render={<Button variant="destructive" />}>Delete</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StandardRecord({ title: initialTitle, editTitle = false }: { title: string; editTitle?: boolean }) {
  const [savedTitle, , titleText] = useText(initialTitle)
  const title = savedTitle ?? initialTitle
  const [, , rep] = useText('Sam Example')
  const [, setPhone, phone] = useText(null)
  const [, , fax] = useText(null)
  const [, , website] = useText(null)
  const [, , terms] = useText('Net 30')
  const sections: EntityViewSection[] = [
    {
      title: 'Notes',
      print: true,
      content: (
        <div className="flex flex-col gap-3">
          <Markdown>Delivers on Tuesdays. Call ahead for anything longer than eight feet.</Markdown>
          <div>
            <Button size="sm" variant="outline" onClick={() => setPhone('555-0100')}>
              <PlusIcon />
              Add the Phone
            </Button>
          </div>
        </div>
      ),
    },
    {
      title: 'Supplier',
      placement: 'rail',
      fields: [
        { label: 'Kind', value: 'Wholesale' },
        { label: 'Account Rep', edit: rep },
        { label: 'Terms', edit: terms },
        { label: 'Tax ID', value: null },
      ],
    },
    {
      title: 'Contact',
      placement: 'rail',
      fields: [
        { label: 'Phone', edit: phone },
        { label: 'Fax', edit: fax },
        { label: 'Website', edit: website },
        { label: 'Address', value: 'Dock 4, 12 Example Way' },
      ],
    },
  ]
  return (
    <EntityView
      layout="rail"
      emptyFields="fold"
      isLoading={false}
      back={{ to: '/', label: 'Suppliers' }}
      title={title}
      titleEdit={editTitle ? { ...titleText, label: 'Name' } : undefined}
      subtitle="Timber and sheet goods for the workshop"
      badges={
        <>
          <Badge variant="outline-success">Active</Badge>
          <Badge variant="outline">Wholesale</Badge>
        </>
      }
      strip={
        <KeyStats
          stats={[
            { label: 'Last order', icon: CalendarIcon, value: 'Oct 28' },
            { label: 'Next delivery', icon: CalendarClockIcon, value: 'Nov 14' },
            { label: 'Orders', icon: HashIcon, value: '23' },
            { label: 'Open', icon: CircleDotIcon, value: null },
          ]}
        />
      }
      actions={
        <>
          <Button variant="outline">
            <PlusIcon />
            New Order
          </Button>
          <DeleteAction name={title} />
        </>
      }
      sections={sections}
    />
  )
}

function StandardInRouter({ title, editTitle }: { title: string; editTitle?: boolean }) {
  const [router] = useState(() =>
    createMemoryRouter([{ path: '/', element: <StandardRecord title={title} editTitle={editTitle} /> }]),
  )
  return <RouterProvider router={router} />
}

export const RecordStandard: StoryObj = {
  name: 'Record standard',
  render: () => <StandardInRouter title="Northwind Lumber" />,
}

export const RecordStandardLongTitle: StoryObj = {
  name: 'Record standard, long title',
  render: () => (
    <StandardInRouter title="Northwind Lumber and Sheet Goods, the warehouse on the far side of the river" />
  ),
}

// The title edited in place (`titleEdit`): a short name stays on one
// line beside its badges, never broken mid-word ("Dr. / Example" before
// 4.94), and a long one wraps within its column. e2e/entity-view-standard
// .spec.ts measures both at 1280px and 375px.
export const RecordStandardEditableTitle: StoryObj = {
  name: 'Record standard, title edited in place',
  render: () => <StandardInRouter title="Dr. Example" editTitle />,
}

export const RecordStandardEditableLongTitle: StoryObj = {
  name: 'Record standard, long title edited in place',
  render: () => (
    <StandardInRouter
      title="Northwind Lumber and Sheet Goods, the warehouse on the far side of the river"
      editTitle
    />
  ),
}

// A record's trail outside AppShell (#R2): back.trail, then the record's
// own title, drawn above the title in the back link's place. In the shell
// it goes up in the bar instead (app/AppShell StandardTrail).
function TrailInRouter() {
  const [router] = useState(() =>
    createMemoryRouter([
      {
        path: '/',
        element: (
          <EntityView
            isLoading={false}
            title="Northwind Lumber"
            subtitle="Timber and sheet goods for the workshop"
            back={{
              to: '/suppliers',
              label: 'Suppliers',
              trail: [
                { label: 'Workshop', href: '/workshop' },
                { label: 'Suppliers', href: '/suppliers' },
              ],
            }}
            sections={[{ title: 'Contact', fields: [{ label: 'Phone', value: '555-0100' }] }]}
          />
        ),
      },
    ]),
  )
  return <RouterProvider router={router} />
}

export const RecordTrail: StoryObj = { name: 'Record trail', render: () => <TrailInRouter /> }
