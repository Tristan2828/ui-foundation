import type { Meta, StoryObj } from '@storybook/react-vite'
import { ClockIcon, LinkIcon, ListChecksIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import type { AppError } from '@/api/contracts'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import type { IconComponent } from './icon-component'
import { WidgetCard, WidgetCardGroup, WidgetList, WidgetListItem, type WidgetCardLink } from './widget-card'

// A hub page's widgets (issue #121): three made-up widgets, each a list
// with a different trailing element (a tone badge, a note and a switch, a
// muted time on external links, and the header linking out, #248). Default is the page as loaded; All
// states is every widget in each of the four states; Brand mark is a card
// about an outside service, titled with that service's mark (#211);
// Collapsible folds and remembers each card (#233); Folded summary is a
// folded card's one value in each state, and Accordion a WidgetCardGroup
// holding one card open at a time (#263). Axe, the token check
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
  icon: IconComponent
  link?: WidgetCardLink
  emptyMessage: string
  rows: number
  /** The folded card's one value (#263). */
  summary: string
  body: ReactNode
}

const READY: Widget = {
  title: 'Ready to start',
  icon: ListChecksIcon,
  link: { to: '/tasks?status=ready', label: 'All' },
  emptyMessage: 'Nothing waiting',
  rows: 3,
  summary: '3 ready',
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
  summary: '2',
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
  // An outside address in the header (#248): it opens in a new tab.
  link: { href: 'https://example.com/saved', label: 'Open saved' },
  emptyMessage: 'No links saved yet',
  rows: 3,
  summary: '3',
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

// A made-up outside service's mark, as an app keeps its own (Simple Icons'
// paths, say): an icon component that passes className and aria-hidden on.
function ExampleServiceMark({ className, ...rest }: { className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} data-testid="service-mark" {...rest}>
      <path fillRule="evenodd" d="M2 7a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V7Zm8 1.5v7l6-3.5-6-3.5Z" />
    </svg>
  )
}

const RECENTLY_IN_SERVICE: Widget = {
  title: 'Recently in Example Video',
  icon: ExampleServiceMark,
  link: { href: 'https://example.com/history', label: 'Open Example Video' },
  emptyMessage: 'Nothing watched yet',
  rows: 2,
  summary: '2',
  body: (
    <WidgetList>
      <WidgetListItem href="https://example.com/watch/1" note="Today">
        Hanging a gate that stays square
      </WidgetListItem>
      <WidgetListItem href="https://example.com/watch/2" note="Oct 20">
        Timber stains compared
      </WidgetListItem>
    </WidgetList>
  ),
}

export const BrandMark: StoryObj = {
  name: 'Brand mark',
  render: () => (
    <div className="flex flex-col gap-4">
      <h1 className="type-page-title text-foreground">Home</h1>
      <div className={GRID}>
        <Widget widget={RECENTLY_IN_SERVICE} state="success" />
      </div>
    </div>
  ),
}

// A hub with more widgets than a phone holds (#233): each folds to its
// header with the chevron, remembered on this device (`storageKey`).
// Saved links starts folded (`defaultCollapsed`) until someone opens it
// (e2e/widget-card.spec.ts).
export const Collapsible: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-4">
      <h1 className="type-page-title text-foreground">Home</h1>
      <div className={GRID}>
        {WIDGETS.map((widget) => (
          <WidgetCard
            key={widget.title}
            title={widget.title}
            icon={widget.icon}
            link={widget.link}
            emptyMessage={widget.emptyMessage}
            skeletonRows={widget.rows}
            collapsible
            storageKey={`ui-foundation:stories:hub.${widget.title}`}
            defaultCollapsed={widget === SAVED_LINKS}
            {...stateProps('success')}
          >
            {widget.body}
          </WidgetCard>
        ))}
      </div>
    </div>
  ),
}

// A folded card's one value (#263), in each of the four states: the
// number, a small skeleton, a muted dash (the error waits in the body:
// open it), and `emptySummary`'s word. Each card opens with its chevron.
export const FoldedSummary: StoryObj = {
  name: 'Folded summary',
  render: () => (
    <div className="flex flex-col gap-4">
      <h1 className="type-page-title text-foreground">Home</h1>
      <div className={GRID}>
        {STATES.map((state) => (
          <WidgetCard
            key={state}
            title={`${READY.title} (${state})`}
            icon={READY.icon}
            link={READY.link}
            emptyMessage={READY.emptyMessage}
            skeletonRows={READY.rows}
            collapsible
            defaultCollapsed
            summary={READY.summary}
            emptySummary="None"
            {...stateProps(state)}
          >
            {READY.body}
          </WidgetCard>
        ))}
      </div>
    </div>
  ),
}

// One card open at a time (#263): opening a card folds the one that was
// open, and a click anywhere on a header (not its link) toggles it.
// `accordion` here is on at every width so the story shows it on a
// desktop; a hub passes `accordion="mobile"` to keep a desktop's cards
// side by side (e2e/widget-card.spec.ts).
export const Accordion: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-4">
      <h1 className="type-page-title text-foreground">Home</h1>
      <WidgetCardGroup accordion defaultOpen="ready" className="grid max-w-md gap-3">
        {WIDGETS.map((widget, index) => (
          <WidgetCard
            key={widget.title}
            id={['ready', 'waiting', 'links'][index]}
            title={widget.title}
            icon={widget.icon}
            link={widget.link}
            emptyMessage={widget.emptyMessage}
            skeletonRows={widget.rows}
            summary={widget.summary}
            {...stateProps('success')}
          >
            {widget.body}
          </WidgetCard>
        ))}
      </WidgetCardGroup>
    </div>
  ),
}
