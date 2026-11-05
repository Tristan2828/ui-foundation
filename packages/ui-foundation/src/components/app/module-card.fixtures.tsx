import type { Meta, StoryObj } from '@/fixtures/types'
import { BookOpenIcon, CameraIcon, DumbbellIcon, ListTodoIcon, SproutIcon, TimerIcon, UtensilsIcon } from 'lucide-react'
import { MemoryRouter } from 'react-router'
import type { AppError } from '@/api/contracts'
import { Badge } from '@/components/ui/badge'
import { ModuleCard, ModuleStrip, type ModuleCardProps, type ModuleStripMobile } from './module-card'
import { WidgetCard, WidgetList, WidgetListItem } from './widget-card'

// A hub page's places (issue #224): a strip of made-up modules above a
// widget, as an app's home screen would have them. Default is the page as
// loaded; All states is a strip in each state (loading, failed, with and
// without a number, a place with no slot); Compact is Default under
// data-density="compact"; Row and Row states are Default and All states
// with `mobile="row"`, one sideways row of chips on a phone. Axe, the
// token check and the glyph check
// measure each in both themes, and Default at the large density too
// (e2e/fixtures-visual.spec.ts); e2e/module-card.spec.ts measures the
// strip at desktop and phone widths, and runs axe on the row at a phone's.
const meta: Meta = {
  title: 'app/ModuleCard',
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

const ERROR: AppError = { kind: 'network', message: "Couldn't reach the server." }

// A made-up outside service's mark, as an app keeps its own.
function ExamplePhotosMark({ className, ...rest }: { className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} {...rest}>
      <path d="M12 2a5 5 0 0 1 5 5h-5V2Zm10 10a5 5 0 0 1-5 5v-5h5Zm-10 10a5 5 0 0 1-5-5h5v5ZM2 12a5 5 0 0 1 5-5v5H2Z" />
    </svg>
  )
}

const PLACES: ModuleCardProps[] = [
  {
    title: 'Projects',
    icon: ListTodoIcon,
    category: 1,
    to: '/projects',
    value: 5,
    note: 'open',
    action: { to: '/projects?view=today', label: 'Today' },
  },
  {
    title: 'Recipes',
    icon: UtensilsIcon,
    category: 2,
    to: '/recipes',
    value: 128,
    note: 'saved',
    action: { to: '/recipes/new', label: 'Add one' },
  },
  {
    title: 'Workouts',
    icon: DumbbellIcon,
    category: 4,
    to: '/workouts',
    value: 2,
    note: 'due today',
    action: { to: '/workouts/next', label: 'Start' },
  },
  {
    title: 'Timers',
    icon: TimerIcon,
    category: 7,
    to: '/timers',
    value: '1–10 m',
    note: 'guided sessions',
    action: { to: '/timers', label: 'All timers' },
  },
  {
    title: 'Garden',
    icon: SproutIcon,
    category: 3,
    to: '/garden',
    value: 14,
    note: 'beds planted',
    action: { to: '/garden/plan', label: 'Open plan' },
  },
  {
    title: 'Reading',
    icon: BookOpenIcon,
    category: 6,
    href: 'https://example.com/reading',
    note: 'Opens its own app',
    action: { href: 'https://example.com/reading/shelf', label: 'Shelf' },
  },
  {
    title: 'Photos',
    icon: ExamplePhotosMark,
    category: 5,
    href: 'https://example.com/photos',
    note: 'Opens its own app',
    action: { href: 'https://example.com/photos', label: 'Open' },
  },
]

function Strip({
  label,
  places = PLACES,
  mobile,
}: {
  label: string
  places?: ModuleCardProps[]
  mobile?: ModuleStripMobile
}) {
  return (
    <ModuleStrip aria-label={label} mobile={mobile}>
      {places.map((place) => (
        <ModuleCard key={place.title} {...place} />
      ))}
    </ModuleStrip>
  )
}

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,--spacing(72)),1fr))] gap-4'

function Hub({ mobile }: { mobile?: ModuleStripMobile }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="type-page-title text-foreground">Home</h1>
      <Strip label="Places" mobile={mobile} />
      <div className={GRID}>
        <WidgetCard
          title="Ready to start"
          link={{ to: '/projects?status=ready', label: 'All' }}
          isLoading={false}
          isEmpty={false}
          emptyMessage="Nothing waiting"
        >
          <WidgetList>
            <WidgetListItem to="/projects/1" trailing={<Badge variant="outline-success">Ready</Badge>}>
              Repaint the shed
            </WidgetListItem>
            <WidgetListItem to="/projects/2" trailing={<Badge variant="outline-success">Ready</Badge>}>
              Fix the gate latch
            </WidgetListItem>
            <WidgetListItem to="/projects/3" note="2 h ago">
              Sort the seed packets
            </WidgetListItem>
          </WidgetList>
        </WidgetCard>
      </div>
    </div>
  )
}

export const Default: StoryObj = { render: () => <Hub /> }

const FIRST_THREE = PLACES.slice(0, 3)

function AllStatesPage({ mobile }: { mobile?: ModuleStripMobile }) {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="type-page-title text-foreground">Every place in every state</h1>
      <section aria-labelledby="state-loading" className="flex flex-col gap-3">
        <h2 id="state-loading" className="type-label text-muted-foreground">
          State: loading
        </h2>
        <Strip
          label="Places (loading)"
          mobile={mobile}
          places={FIRST_THREE.map((place) => ({ ...place, isLoading: true }))}
        />
      </section>
      <section aria-labelledby="state-error" className="flex flex-col gap-3">
        <h2 id="state-error" className="type-label text-muted-foreground">
          State: error
        </h2>
        <Strip
          label="Places (error)"
          mobile={mobile}
          places={FIRST_THREE.map((place) => ({ ...place, error: ERROR, onRetry: () => {} }))}
        />
      </section>
      <section aria-labelledby="state-success" className="flex flex-col gap-3">
        <h2 id="state-success" className="type-label text-muted-foreground">
          State: success, with a number and without, and with no slot
        </h2>
        <Strip
          label="Places (success)"
          mobile={mobile}
          places={[
            PLACES[0],
            PLACES[6],
            { title: 'Albums', icon: CameraIcon, to: '/albums', note: 'No slot: a plain band' },
          ]}
        />
      </section>
    </div>
  )
}

export const AllStates: StoryObj = { name: 'All states', render: () => <AllStatesPage /> }

export const Compact: StoryObj = {
  render: () => (
    <div data-density="compact">
      <Hub />
    </div>
  ),
}

export const Row: StoryObj = { render: () => <Hub mobile="row" /> }

export const RowStates: StoryObj = { name: 'Row states', render: () => <AllStatesPage mobile="row" /> }
