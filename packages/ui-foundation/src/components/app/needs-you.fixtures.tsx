import type { Meta, StoryObj } from '@/fixtures/types'
import { MemoryRouter } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { NeedsYou } from './needs-you'

// What waits on you, with a mixed tone, on the page and on a card, so axe
// and the glyph check measure the warning and destructive icons on their
// wash in both themes (e2e/fixtures-visual.spec.ts). Empty draws nothing.
const meta: Meta = {
  title: 'app/NeedsYou',
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

const ITEMS = [
  { text: 'Balances are three months old', to: '/accounts' },
  { text: '2 deals at their target', to: '/purchases?view=now' },
  { text: 'The 1098 for the 2026 taxes is overdue', to: '/taxes', tone: 'destructive' as const },
]

export const Default: StoryObj = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-4">
      <NeedsYou items={ITEMS} />
      <Card>
        <CardContent>
          <NeedsYou items={ITEMS.slice(0, 1)} title="Needs you today" headingLevel={3} />
        </CardContent>
      </Card>
    </div>
  ),
}

export const Empty: StoryObj = {
  render: () => (
    <div className="max-w-xl">
      <p className="type-body text-muted-foreground">Nothing waiting: no box below this line.</p>
      <NeedsYou items={[]} />
    </div>
  ),
}
