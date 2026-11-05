import type { Meta, StoryObj } from '@/fixtures/types'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ProgressRing } from './progress-ring'
import { RatingStar, type RatingStarValue } from './rating-star'
import { StepBar } from './step-bar'

// Cell pattern 9's variants and pattern 13's ring, every value of each,
// in table cells on the page and on a card, so axe and the glyph check
// measure them in both themes (e2e/fixtures-visual.spec.ts).

type Quality = 'best' | 'high' | 'fair' | 'low' | 'worst'

// What an app writes in its <entity>-format.ts: one lookup typed by the enum.
const QUALITY: Record<Quality, { word: string; value: number }> = {
  best: { word: 'Best', value: 5 },
  high: { word: 'High', value: 4 },
  fair: { word: 'Fair', value: 3 },
  low: { word: 'Low', value: 2 },
  worst: { word: 'Worst', value: 1 },
}

const PARTLY: Record<'yes' | 'partly' | 'no', { word: string; value: RatingStarValue }> = {
  yes: { word: 'Yes', value: 'full' },
  partly: { word: 'Partly', value: 'half' },
  no: { word: 'No', value: 'empty' },
}

const ROWS: { name: string; done: number; total: number; quality: Quality; owned: keyof typeof PARTLY }[] = [
  { name: 'Dune', done: 6, total: 6, quality: 'best', owned: 'yes' },
  { name: 'Hyperion', done: 4, total: 6, quality: 'high', owned: 'partly' },
  { name: 'Foundation', done: 1, total: 3, quality: 'fair', owned: 'no' },
  { name: 'Solaris', done: 0, total: 4, quality: 'low', owned: 'no' },
  { name: 'Ubik', done: 0, total: 0, quality: 'worst', owned: 'partly' },
]

function ScalesTable({ label }: { label: string }) {
  return (
    <Table>
      <TableCaption>{label}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Book</TableHead>
          <TableHead>Chapters</TableHead>
          <TableHead>Quality</TableHead>
          <TableHead>Owned</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map((row) => (
          <TableRow key={row.name}>
            <TableCell>{row.name}</TableCell>
            <TableCell>
              <ProgressRing done={row.done} total={row.total} />
            </TableCell>
            <TableCell>
              <StepBar value={QUALITY[row.quality].value} word={QUALITY[row.quality].word} />
            </TableCell>
            <TableCell>
              <RatingStar value={PARTLY[row.owned].value} word={PARTLY[row.owned].word} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

const meta: Meta = {
  title: 'patterns/Scales',
  parameters: { controls: { disable: true } },
}

export default meta

export const Default: StoryObj = {
  render: () => (
    <div className="flex max-w-3xl flex-col gap-6">
      <ScalesTable label="On the page" />
      <Card>
        <CardContent>
          <ScalesTable label="On a card" />
        </CardContent>
      </Card>
    </div>
  ),
}
