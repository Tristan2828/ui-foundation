import { useState, type ReactNode } from 'react'
import { createMemoryRouter, Outlet, RouterProvider, useLocation, useParams } from 'react-router'
import type { Meta, StoryObj } from '@/fixtures/types'
import { Button } from '@/components/ui/button'
import type { PlainDate } from '@/lib/plain-date'
import { EntityView } from './entity-view'
import { MonthCalendar, type MonthCalendarItem } from './month-calendar'
import { RecordDialogRoute } from './record-dialog'

// MonthCalendar on made-up events, with today fixed
// at Friday 2026-11-20 so every run draws the same month:
//
// - Default: November with events (info) and visits (success), a busy day
//   folded to "+1 more", today ringed and picked, an Add action beside the
//   picked day's heading (it writes what it would add under the month).
//   On a phone the days hold dots. Two events carry an emoji, drawn
//   before their titles in the cell and the day's list.
// - WeeksFromSunday: the same month with Sunday first.
// - States: loading, empty (a month with nothing) and an error with Try Again.
// - OpensDialog: the same month at /events under a RecordDialogRoute, with
//   `opens="dialog"`: an event's link opens it in a dialog over the month,
//   with Open Full Page. The address shows above it, for the spec.
//
// e2e/month-calendar.spec.ts moves months, picks days by mouse and keys and
// measures both widths; axe and the token check run every story in both
// themes (e2e/fixtures-visual.spec.ts).
const meta: Meta = {
  title: 'app/MonthCalendar',
  parameters: { controls: { disable: true } },
}

export default meta

const TODAY = '2026-11-20'

const ITEMS: MonthCalendarItem[] = [
  { id: 1, day: '2026-11-20', title: 'Book club', emoji: '📚', time: '19:00', tone: 'info', to: '/events/1', detail: 'Event' },
  { id: 2, day: '2026-11-24', title: 'Checkup', time: '09:15', tone: 'success', to: '/visits/2', detail: 'Visit' },
  { id: 3, day: '2026-11-26', title: 'Holiday dinner', emoji: '🦃', tone: 'info', to: '/events/3', detail: 'Event' },
  { id: 4, day: '2026-11-26', title: 'Parade', time: '08:00', tone: 'info', to: '/events/4', detail: 'Event' },
  { id: 5, day: '2026-11-26', title: 'Call the family', time: '17:30', tone: 'warning', to: '/events/5', detail: 'Event' },
  { id: 6, day: '2026-11-11', title: 'Recycling pickup moved to a long title that runs on', tone: 'neutral', detail: 'Event' },
  { id: 7, day: '2026-12-01', title: 'Physio', time: '10:00', tone: 'success', to: '/visits/7', detail: 'Visit' },
  { id: 8, day: '2026-12-09', title: 'Dentist', time: '14:30', tone: 'success', to: '/visits/8', detail: 'Visit' },
  { id: 9, day: '2026-12-25', title: 'Holiday', tone: 'info', to: '/events/9', detail: 'Event' },
]

function Routed({ children }: { children: ReactNode }) {
  const [router] = useState(() =>
    createMemoryRouter([
      { path: '/', element: children },
      { path: '*', element: <p className="text-sm text-foreground">Opened a record.</p> },
    ]),
  )
  return <RouterProvider router={router} />
}

function WithAdd({ weekStart }: { weekStart?: 'MO' | 'SU' }) {
  const [adding, setAdding] = useState<PlainDate | null>(null)
  const [picked, setPicked] = useState<PlainDate>(TODAY)
  return (
    <div className="flex max-w-4xl flex-col gap-3">
      <MonthCalendar
        label="Events"
        items={ITEMS}
        today={TODAY}
        selected={picked}
        onSelect={setPicked}
        weekStart={weekStart}
        locale="en-US"
        dayActions={(day) => (
          <Button size="sm" variant="outline" onClick={() => setAdding(day)}>
            Add Event
          </Button>
        )}
      />
      <output data-testid="picked" className="font-mono text-xs text-muted-foreground">
        picked {picked}
        {adding ? ` · add on ${adding}` : ''}
      </output>
    </div>
  )
}

export const Default: StoryObj = {
  render: () => (
    <Routed>
      <WithAdd />
    </Routed>
  ),
}

export const WeeksFromSunday: StoryObj = {
  render: () => (
    <Routed>
      <WithAdd weekStart="SU" />
    </Routed>
  ),
}

export const States: StoryObj = {
  render: () => (
    <Routed>
      <div className="grid max-w-4xl gap-10">
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Loading</h2>
          <MonthCalendar label="Loading" today={TODAY} isLoading locale="en-US" />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Empty</h2>
          <MonthCalendar label="Empty" today={TODAY} items={[]} locale="en-US" />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Error</h2>
          <MonthCalendar
            label="Error"
            today={TODAY}
            locale="en-US"
            error={{ kind: 'network', message: "Couldn't reach the server.", fieldErrors: {} }}
            onRetry={() => undefined}
          />
        </div>
      </div>
    </Routed>
  ),
}

// The calendar a list under RecordDialogRoute: its events open over it.
function EventView() {
  const { id } = useParams()
  const item = ITEMS.find((candidate) => String(candidate.id) === id)
  return (
    <EntityView
      title={item?.title}
      isLoading={false}
      error={item ? null : { kind: 'notfound', message: "This event doesn't exist." }}
      back={{ to: '/events', label: 'Events' }}
      sections={[{ title: 'Details', fields: [{ label: 'Day', value: item?.day }] }]}
    />
  )
}

function Address() {
  const location = useLocation()
  return (
    <div className="flex flex-col gap-4">
      <p className="type-caption text-muted-foreground">
        Address: <output data-testid="address">{location.pathname}</output>
      </p>
      <Outlet />
    </div>
  )
}

function DialogRouted() {
  const [router] = useState(() =>
    createMemoryRouter(
      [
        {
          path: '/',
          element: <Address />,
          children: [
            {
              path: 'events',
              element: (
                <RecordDialogRoute
                  label="Event"
                  list={
                    <div className="max-w-4xl">
                      <MonthCalendar label="Events" items={ITEMS} today={TODAY} opens="dialog" locale="en-US" />
                    </div>
                  }
                />
              ),
              children: [{ path: ':id', element: <EventView /> }],
            },
          ],
        },
      ],
      { initialEntries: ['/events'] },
    ),
  )
  return <RouterProvider router={router} />
}

export const OpensDialog: StoryObj = {
  render: () => <DialogRouted />,
}
