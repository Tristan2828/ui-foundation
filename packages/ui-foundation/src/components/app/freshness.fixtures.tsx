import type { Meta, StoryObj } from '@/fixtures/types'
import { Card, CardContent } from '@/components/ui/card'
import { Freshness } from './freshness'

// A made-up "now", so the lines don't change with the day: fresh, stale
// and never, on the page and on a card, so axe and the glyph check
// measure the muted and the warning tones in both themes
// (e2e/fixtures-visual.spec.ts).
const NOW = new Date(2026, 10, 11)

const meta: Meta = {
  title: 'app/Freshness',
  parameters: { controls: { disable: true } },
}

export default meta

function Lines() {
  return (
    <div className="flex flex-col gap-2">
      <Freshness label="Prices checked" at="2026-11-10" staleAfter="2026-12-10" now={NOW} />
      <Freshness label="Balances entered" at="2026-08-02" staleAfter="2026-11-02" now={NOW} />
      <Freshness label="Projection from" at="2025-12-30" staleAfter="2026-12-30" now={NOW} />
      <Freshness label="Balances entered" at="2025-03-04" staleAfter="2025-06-04" now={NOW} />
      <Freshness label="Prices checked" at={null} now={NOW} />
      <Freshness label="Prices checked" at="2026-11-10" now={NOW} />
    </div>
  )
}

export const Default: StoryObj = {
  render: () => (
    <div className="flex max-w-md flex-col gap-4">
      <Lines />
      <Card>
        <CardContent className="flex flex-col gap-2">
          <Freshness label="On a card: entered" at="2026-08-02" staleAfter="2026-11-02" now={NOW} />
          <Freshness label="On a card: checked" at="2026-11-10" staleAfter="2026-12-10" now={NOW} />
        </CardContent>
      </Card>
    </div>
  ),
}
