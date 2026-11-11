import type { Meta, StoryObj } from '@/fixtures/types'
import { PencilIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Timeline, type TimelineItem } from './timeline'

// A record's history: made-up entries, newest first, a long one among
// them, and an edit control at each entry's end. Default is the first
// five and Show all; In a narrow card is under 24rem, where the date moves
// above its entry; Few entries has no Show all. Axe and the glyph check
// measure them in both themes (e2e/fixtures-visual.spec.ts), and
// e2e/fixtures-visual.spec.ts measures the narrow layout.
const meta: Meta = {
  title: 'app/Timeline',
  parameters: { controls: { disable: true } },
}

export default meta

const LONG =
  'Raised at the visit. They want two more weeks of morning notes before changing anything, and asked whether sleep position has changed since the last appointment. Bring the notes to the next one.'

const ITEMS: TimelineItem[] = [
  { id: 'a', date: 'Nov 2', dateTime: '2026-11-02', kind: 'Visit', body: LONG },
  { id: 'b', date: 'Oct 11', dateTime: '2026-10-11', kind: 'Note', body: 'Referral sent; no appointment yet.' },
  { id: 'c', date: 'Oct 3', dateTime: '2026-10-03', kind: 'Call', body: 'Office confirmed the plan.' },
  { id: 'd', date: 'Sep 20', dateTime: '2026-09-20', kind: 'Note', body: 'Started tracking mornings on a scale of one to ten.' },
  { id: 'e', date: 'Aug 30', dateTime: '2026-08-30', body: 'Intake booked.' },
  { id: 'f', date: 'Aug 3', dateTime: '2026-08-03', kind: 'Call', body: 'First call.' },
  { id: 'g', date: 'Jul 14, 2025', dateTime: '2025-07-14', kind: 'Note', body: 'Earlier history, from the year before.' },
]

const withEdit = (items: TimelineItem[]) =>
  items.map((item) => ({
    ...item,
    edit: (
      <Button variant="ghost" size="icon-sm" aria-label={`Edit the ${item.date} entry`}>
        <PencilIcon aria-hidden="true" />
      </Button>
    ),
  }))

export const Default: StoryObj = {
  render: () => (
    <Card className="max-w-2xl">
      <CardHeader>Changes</CardHeader>
      <CardContent>
        <Timeline label="Changes" items={withEdit(ITEMS)} />
      </CardContent>
    </Card>
  ),
}

export const InANarrowCard: StoryObj = {
  render: () => (
    <Card className="w-[20rem]">
      <CardHeader>Changes</CardHeader>
      <CardContent>
        <Timeline label="Changes" items={ITEMS} initial={3} />
      </CardContent>
    </Card>
  ),
}

export const FewEntries: StoryObj = {
  render: () => (
    <div className="flex max-w-2xl flex-col gap-6">
      <Timeline label="Updates" items={ITEMS.slice(0, 2)} />
      <Timeline label="Empty updates" items={[]} />
    </div>
  ),
}
