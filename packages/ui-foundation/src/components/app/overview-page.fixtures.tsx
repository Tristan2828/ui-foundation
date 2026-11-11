import type { Meta, StoryObj } from '@/fixtures/types'
import { CalendarIcon, FileTextIcon, LandmarkIcon, PieChartIcon, TagIcon, TrendingUpIcon, WalletIcon } from 'lucide-react'
import { MemoryRouter } from 'react-router'
import type { AppError } from '@/api/contracts'
import { KeyStats } from './key-stats'
import { OverviewPage, type OverviewPart } from './overview-page'
import { WidgetCard, WidgetCardGroup, WidgetList, WidgetListItem } from './widget-card'

// A made-up household module's overview (overview standard O1): a strip of
// key numbers, Needs you, then six parts as tiles (an accordion under
// 48rem), one of them stale and one with nothing yet. Default opens one
// part's detail below the grid; States is a part loading and one failing;
// Card anatomy is WidgetCard taking the same anatomy (O4) on a hub, a
// title linking with a chevron, a value, a line and freshness, folded on
// a phone to its value. Axe and the glyph check measure them in both
// themes (e2e/fixtures-visual.spec.ts); e2e/overview-page.spec.ts clicks
// the tiles and the accordion.
const meta: Meta = {
  title: 'app/OverviewPage',
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

const NOW = new Date('2026-11-11T12:00:00')
const ERROR: AppError = { kind: 'network', message: "Couldn't reach the server." }

const PARTS: OverviewPart[] = [
  {
    id: 'savings',
    title: 'Savings',
    icon: LandmarkIcon,
    to: '/accounts',
    value: '$24,800',
    line: '+$1,120 since August',
    freshness: { label: 'Balances entered', at: '2026-08-02', staleAfter: '2026-11-01', now: NOW },
    detail: (
      <WidgetList>
        <WidgetListItem to="/accounts/1" note="$9,400">
          Everyday account
        </WidgetListItem>
        <WidgetListItem to="/accounts/2" note="$15,400">
          Rainy day fund
        </WidgetListItem>
      </WidgetList>
    ),
  },
  {
    id: 'deals',
    title: 'Deals',
    icon: TagIcon,
    to: '/purchases',
    value: '2 now',
    line: '9 planned, $1,240 in all',
    freshness: { label: 'Prices checked', at: '2026-11-11', now: NOW },
    detail: (
      <WidgetList>
        <WidgetListItem to="/purchases/1" note="$38 · target $40">
          Reading lamp
        </WidgetListItem>
        <WidgetListItem to="/purchases/2" note="$72 · target $75">
          Garden hose
        </WidgetListItem>
      </WidgetList>
    ),
  },
  {
    id: 'mix',
    title: 'Mix',
    icon: PieChartIcon,
    to: '/mix',
    value: '1 off',
    line: 'Cash is 5% over its target',
    freshness: { label: 'Prices from', at: '2026-11-09', now: NOW },
  },
  {
    id: 'papers',
    title: 'Papers 2026',
    icon: FileTextIcon,
    to: '/papers',
    value: '3 of 6',
    line: 'documents in hand',
    detail: (
      <WidgetList>
        <WidgetListItem note="In hand">Pay summary</WidgetListItem>
        <WidgetListItem note="Expected Feb 1">Interest statement</WidgetListItem>
      </WidgetList>
    ),
  },
  {
    id: 'goal',
    title: 'Long-term goal',
    icon: TrendingUpIcon,
    to: '/goal',
    value: 'On track',
    line: '$24,800 of $60,000',
    freshness: { label: 'Projection from', at: '2026-11-01', now: NOW },
  },
  {
    id: 'budget',
    title: 'Budget',
    icon: WalletIcon,
    to: '/budget',
    empty: { text: "Nothing here yet: the monthly plan isn't set up.", action: { label: 'Add the first line', to: '/budget/new' } },
  },
]

const NEEDS = [
  { text: 'Balances are three months old', to: '/accounts' },
  { text: '2 deals at their target', to: '/purchases?view=now' },
]

const STATS = (
  <KeyStats
    stats={[
      { label: 'Savings', value: '$24,800', icon: LandmarkIcon },
      { label: 'Deals now', value: '2', icon: TagIcon },
      { label: 'Off target', value: '1', icon: PieChartIcon },
      { label: 'Papers', value: '3 of 6', icon: FileTextIcon },
    ]}
  />
)

export const Default: StoryObj = {
  render: () => <OverviewPage title="Household" stats={STATS} needs={NEEDS} parts={PARTS} defaultOpen="savings" />,
}

export const States: StoryObj = {
  render: () => (
    <OverviewPage
      title="Household"
      parts={[
        { ...PARTS[0]!, isLoading: true },
        { ...PARTS[1]!, error: ERROR, onRetry: () => {} },
        PARTS[2]!,
        PARTS[5]!,
      ]}
      defaultOpen="deals"
    />
  ),
}

// The hub's widgets in the overview's card anatomy, so a hub and an
// overview read alike: one with rows, one a value alone, one with nothing
// yet. Folded to their values under the sidebar's breakpoint.
export const CardAnatomy: StoryObj = {
  render: () => (
    <WidgetCardGroup
      accordion="mobile"
      className="grid max-w-5xl gap-4 md:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]"
    >
      <WidgetCard
        id="deals"
        title="Deals"
        icon={TagIcon}
        to="/purchases"
        value="2 now"
        line="at or under their target"
        freshness={{ label: 'Prices checked', at: '2026-11-11', now: NOW }}
        isLoading={false}
        isEmpty={false}
        emptyMessage="No deals"
      >
        <WidgetList>
          <WidgetListItem to="/purchases/1" note="$38">
            Reading lamp
          </WidgetListItem>
          <WidgetListItem to="/purchases/2" note="$72">
            Garden hose
          </WidgetListItem>
        </WidgetList>
      </WidgetCard>
      <WidgetCard
        id="savings"
        title="Savings"
        icon={LandmarkIcon}
        to="/accounts"
        value="$24,800"
        line="+$1,120 since August"
        freshness={{ label: 'Balances entered', at: '2026-08-02', staleAfter: '2026-11-01', now: NOW }}
        isLoading={false}
        isEmpty={false}
        emptyMessage="No accounts"
      />
      <WidgetCard
        id="plans"
        title="Plans"
        icon={CalendarIcon}
        to="/plans"
        isLoading={false}
        isEmpty
        emptyMessage="No plans"
        emptySummary="Nothing yet"
        empty={{ action: { label: 'Add a plan', to: '/plans/new' } }}
      />
    </WidgetCardGroup>
  ),
}
