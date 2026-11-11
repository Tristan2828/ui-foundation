import type { Meta, StoryObj } from '@/fixtures/types'
import { HomeIcon, SproutIcon, WrenchIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ValueList } from './value-list'

// Several values in one cell: every count (none, one, exactly max, over
// it), the app's own icons as the values, and a narrow card, so axe and
// the glyph check measure the chips and the muted +N in both themes
// (e2e/fixtures-visual.spec.ts).
const meta: Meta = {
  title: 'app/ValueList',
  parameters: { controls: { disable: true } },
}

export default meta

const AREAS = ['Back', 'Neck', 'General', 'Sleep', 'Stomach'].map((label) => ({ label }))

const ROWS: [string, number][] = [
  ['Example tablet A', 2],
  ['Example capsule B', 5],
  ['Example cream C', 1],
  ['Example drops D', 0],
  ['Example supplement E', 3],
]

export const Default: StoryObj = {
  render: () => (
    <table aria-label="Areas by medication" className="type-body">
      <thead>
        <tr>
          <th className="pr-8 text-left type-label">Name</th>
          <th className="text-left type-label">Areas</th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map(([name, count]) => (
          <tr key={name}>
            <td className="py-1 pr-8">{name}</td>
            <td className="py-1">
              <ValueList items={AREAS.slice(0, count)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
}

export const Icons: StoryObj = {
  render: () => (
    <Card className="max-w-xs">
      <CardContent className="flex flex-col gap-3">
        <ValueList
          max={2}
          items={[
            { label: 'Home', node: <HomeIcon aria-hidden="true" className="size-4 text-muted-foreground" /> },
            { label: 'Garden', node: <SproutIcon aria-hidden="true" className="size-4 text-muted-foreground" /> },
            { label: 'Repairs', node: <WrenchIcon aria-hidden="true" className="size-4 text-muted-foreground" /> },
            { label: 'Weekend', node: <HomeIcon aria-hidden="true" className="size-4 text-muted-foreground" /> },
          ]}
        />
        <ValueList max={3} items={AREAS} />
        <ValueList max={1} items={AREAS.slice(0, 2)} />
        <ValueList items={[]} />
      </CardContent>
    </Card>
  ),
}
