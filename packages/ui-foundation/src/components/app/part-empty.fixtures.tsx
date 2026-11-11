import type { Meta, StoryObj } from '@/fixtures/types'
import { MemoryRouter } from 'react-router'
import { WidgetCard } from './widget-card'
import { PartEmpty } from './part-empty'

// A part with nothing in it yet: the card-size empty on its own (a link
// and a button start it, and a text with no action), and in a WidgetCard
// through its `empty` prop beside one without. Axe and the glyph check
// measure them in both themes (e2e/fixtures-visual.spec.ts).
const meta: Meta = {
  title: 'app/PartEmpty',
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

export const Default: StoryObj = {
  render: () => (
    <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <PartEmpty action={{ label: 'Add the first line', to: '/budget/new' }} />
      <PartEmpty text="No deals yet" action={{ label: 'Add a purchase', onClick: () => {} }} />
      <PartEmpty text="Nothing to review" />
    </div>
  ),
}

export const InWidgetCards: StoryObj = {
  render: () => (
    <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <WidgetCard
        title="Budget"
        isLoading={false}
        isEmpty
        emptyMessage="Not set up"
        empty={{ action: { label: 'Add the first line', to: '/budget/new' } }}
      />
      <WidgetCard title="Deals" isLoading={false} isEmpty emptyMessage="No deals right now" />
    </div>
  ),
}
