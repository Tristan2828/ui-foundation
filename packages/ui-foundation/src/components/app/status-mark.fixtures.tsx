import type { Meta, StoryObj } from '@/fixtures/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { STATUS_KINDS, STATUS_KIND_LABELS } from '@/lib/status-kinds'
import { StatusMark } from './status-mark'

// Every status kind (4.98, record standard 5B) on the page, on a card and
// in a table's rows, with a status's own word ("As Needed", "On Hold")
// beside the kind's: axe measures each word and the glyph check each icon
// against what's behind it, in both themes and every palette
// (e2e/fixtures-visual.spec.ts).

const meta: Meta = {
  title: 'app/StatusMark',
  parameters: { controls: { disable: true } },
}

export default meta

// A made-up list's statuses, each sorted into its kind.
const ROWS = [
  { name: 'Repaint the fence', kind: 'active', word: 'Active' },
  { name: 'Water the hedge', kind: 'active', word: 'As Needed' },
  { name: 'Fix the gate latch', kind: 'planned', word: 'Up Next' },
  { name: 'Plant the bulbs', kind: 'paused', word: 'On Hold' },
  { name: 'Clear the gutters', kind: 'done', word: 'Done' },
  { name: 'Build a shed', kind: 'ended', word: 'Dropped' },
  { name: 'Renew the permit', kind: 'attention', word: 'Overdue' },
] as const

export const AllKinds: StoryObj = {
  name: 'All kinds',
  render: () => (
    <div className="flex max-w-2xl flex-col gap-6">
      <ul aria-label="On the page" className="flex flex-wrap gap-x-5 gap-y-2">
        {STATUS_KINDS.map((kind) => (
          <li key={kind}>
            <StatusMark kind={kind} />
          </li>
        ))}
      </ul>
      <Card>
        <CardHeader>
          <CardTitle>On a card</CardTitle>
        </CardHeader>
        <CardContent>
          <ul aria-label="On a card" className="flex flex-wrap gap-x-5 gap-y-2">
            {STATUS_KINDS.map((kind) => (
              <li key={kind}>
                <StatusMark kind={kind}>{STATUS_KIND_LABELS[kind]}</StatusMark>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROWS.map((row) => (
            <TableRow key={row.name}>
              <TableCell>{row.name}</TableCell>
              <TableCell>
                <StatusMark kind={row.kind}>{row.word}</StatusMark>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
}
