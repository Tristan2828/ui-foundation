import type { Meta, StoryObj } from '@storybook/react-vite'
import { ClockIcon, LinkIcon, ListChecksIcon, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import type { AppError } from '@/api/contracts'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { WidgetCard, WidgetList, WidgetListItem } from './widget-card'

// A hub page's widgets (issue #121): three made-up widgets, each a list
// with a different trailing element (a tone badge, a note and a switch, a
// muted time on external links). Default is the page as loaded; All
// states is every widget in each of the four states. Axe, the token check
// and the glyph check measure both in both themes and at the large
// density (e2e/storybook-visual.spec.ts).
const meta: Meta = {
  title: 'app/WidgetCard',
  parameters: { controls: { disable: true } },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
}

export default meta

type State = 'loading' | 'empty' | 'error' | 'success'

const ERROR: AppError = { kind: 'network', message: "Couldn't reach the server." }

function stateProps(state: State) {
  return {
    isLoading: state === 'loading',
    error: state === 'error' ? ERROR : null,
    onRetry: () => {},
    isEmpty: state === 'empty',
  }
}

type Widget = {
  title: string
  icon: LucideIcon
  link?: { to: string; label: string }
  emptyMessage: string
  rows: number
  body: ReactNode
}

const READY: Widget = {
  title: 'Ready to start',
  icon: ListChecksIcon,
  link: { to: '/tasks?status=ready', label: 'All' },
  emptyMessage: 'Nothing waiting',
  rows: 3,
  body: (
    <WidgetList>
      <WidgetListItem to="/tasks/1" trailing={<Badge variant="outline-success">Ready</Badge>}>
        Repaint the shed
      </WidgetListItem>
      <WidgetListItem to="/tasks/2" trailing={<Badge variant="outline-success">Ready</Badge>}>
        Read chapter 4
      </WidgetListItem>
      <WidgetListItem to="/tasks/3" trailing={<Badge variant="outline-warning">Needs 1</Badge>}>
        Fix the gate latch
      </WidgetListItem>
    </WidgetList>
  ),
}

const WAITING_ON: Widget = {
  title: 'Waiting on',
  icon: ClockIcon,
  link: { to: '/conditions', label: 'All' },
  emptyMessage: 'Nothing on hold',
  rows: 2,
  body: (
    <WidgetList>
      <WidgetListItem note="holds 2" trailing={(id) => <Switch aria-labelledby={id} defaultChecked={false} />}>
        Parts arrive
      </WidgetListItem>
      <WidgetListItem note="holds 1" trailing={(id) => <Switch aria-labelledby={id} defaultChecked />}>
        Weather clears
      </WidgetListItem>
    </WidgetList>
  ),
}

const SAVED_LINKS: Widget = {
  title: 'Saved links',
  icon: LinkIcon,
  emptyMessage: 'No links saved yet',
  rows: 3,
  body: (
    <WidgetList>
      <WidgetListItem href="https://example.com/shed-paint" note="2 h ago">
        Choosing an exterior paint for a timber shed that sees a lot of weather
      </WidgetListItem>
      <WidgetListItem href="https://example.com/latch" note="Yesterday">
        Gate latch fitting guide
      </WidgetListItem>
      <WidgetListItem href="https://example.com/reading" note="Oct 12">
        Reading list
      </WidgetListItem>
    </WidgetList>
  ),
}

const WIDGETS = [READY, WAITING_ON, SAVED_LINKS]

// In All states each widget appears four times, so its title says which
// state it shows: landmarks on one page need distinct names.
function Widget({ widget, state, inAllStates }: { widget: Widget; state: State; inAllStates?: boolean }) {
  return (
    <WidgetCard
      title={inAllStates ? `${widget.title} (${state})` : widget.title}
      icon={widget.icon}
      link={widget.link}
      headingLevel={inAllStates ? 3 : 2}
      emptyMessage={widget.emptyMessage}
      skeletonRows={widget.rows}
      {...stateProps(state)}
    >
      {widget.body}
    </WidgetCard>
  )
}

// Equal-width columns that wrap: one on a phone, up to three on a wide screen.
const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,--spacing(72)),1fr))] gap-4'

export const Default: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-4">
      <h1 className="type-page-title text-foreground">Home</h1>
      <div className={GRID}>
        {WIDGETS.map((widget) => (
          <Widget key={widget.title} widget={widget} state="success" />
        ))}
      </div>
    </div>
  ),
}

const STATES: State[] = ['loading', 'empty', 'error', 'success']

export const AllStates: StoryObj = {
  name: 'All states',
  render: () => (
    <div className="flex flex-col gap-8">
      <h1 className="type-page-title text-foreground">Every widget in every state</h1>
      {STATES.map((state) => (
        <section key={state} aria-labelledby={`state-${state}`} className="flex flex-col gap-3">
          <h2 id={`state-${state}`} className="type-label text-muted-foreground">
            State: {state}
          </h2>
          <div className={GRID}>
            {WIDGETS.map((widget) => (
              <Widget key={widget.title} widget={widget} state={state} inAllStates />
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
}
