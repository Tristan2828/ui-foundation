import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { editInPlace } from './edit-in-place'
import { EntityView, type EntityViewLayout, type EntityViewSection } from './entity-view'
import { Markdown } from './markdown'

// One record in both layouts: `column` (the default) and `rail`, the
// short sections in a column on the right of long Markdown. Axe and the
// token check measure both in both themes, and e2e/entity-view.spec.ts
// pins the rail's geometry, order and stickiness. Editing in place needs a
// data router (its leave prompt is React Router's useBlocker), so each
// story renders in a memory one; Owner saves after a short wait.

// Long enough to scroll past a rail, with a table wider than the column
// layout's 896px (it scrolls sideways there) but not than the rail
// layout's main column on a wide screen.
const NOTES = `# Background

The office moves to the third floor in March. Every desk, chair and
cabinet is tagged by the week it moves, and each team packs its own
boxes the Friday before.

${Array.from(
  { length: 8 },
  (_, week) =>
    `## Week ${week + 1}\n\nPack the shared shelves first, then personal desks. Label each box with the room it goes to and the team's colour, and leave the fragile ones open until the movers check them.`,
).join('\n\n')}

# Schedule

| Week | Team | Room | Ticket | Desks | Chairs | Cabinets | Monitors | Plants | Boxes | Lift slot | Contact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Finance | 3.01 | MOVE-2026-0001-FINANCE | 12 | 12 | 4 | 24 | 3 | 40 | 08:00–10:00 | finance-move-lead@example.com |
| 2 | Design | 3.04 | MOVE-2026-0002-DESIGN | 8 | 10 | 2 | 16 | 6 | 35 | 10:00–12:00 | design-move-lead@example.com |
| 3 | Support | 3.07 | MOVE-2026-0003-SUPPORT | 20 | 20 | 1 | 40 | 2 | 50 | 13:00–15:00 | support-move-lead@example.com |

Measure twice, cut once.
`

function useOwner() {
  const [owner, setOwner] = useState('Ada Lovelace')
  const owners = editInPlace<string>({
    kind: 'text',
    value: owner,
    save: (next) => new Promise((resolve) => setTimeout(() => resolve(setOwner(next)), 300)),
    control: (props) => (
      <Input
        id={props.id}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        readOnly={props.disabled}
        aria-invalid={props.invalid || undefined}
        aria-label={props.label}
        aria-describedby={props.describedBy}
      />
    ),
  })
  return { owner, owners }
}

function Record({ layout }: { layout: EntityViewLayout }) {
  const { owner, owners } = useOwner()
  const sections: EntityViewSection[] = [
    {
      title: 'Summary',
      placement: 'rail',
      fields: [
        { label: 'Owner', value: owner, edit: owners },
        { label: 'Floor', value: 'Third' },
        { label: 'Starts', value: 'Mar 2, 2026' },
        { label: 'Contact', value: 'facilities-desk@example.com' },
        { label: 'Budget', value: null, emptyLabel: 'No budget yet' },
      ],
    },
    {
      title: 'Links',
      placement: 'rail',
      content: (
        <ul className="flex flex-col gap-1">
          <li>
            <a className="text-link underline underline-offset-4" href="#floor-plan">
              Floor plan
            </a>
          </li>
          <li>
            <a className="text-link underline underline-offset-4" href="#movers">
              Movers' quote
            </a>
          </li>
        </ul>
      ),
    },
    { title: 'Notes', content: <Markdown>{NOTES}</Markdown> },
    { title: 'Follow-ups', content: null, emptyLabel: 'No follow-ups' },
  ]
  return (
    <EntityView
      layout={layout}
      isLoading={false}
      back={{ to: '/', label: 'Projects' }}
      title="Office move"
      badges={<Badge variant="outline">In progress</Badge>}
      actions={<Button variant="outline">Edit</Button>}
      sections={sections}
    />
  )
}

function InRouter({ layout }: { layout: EntityViewLayout }) {
  const [router] = useState(() => createMemoryRouter([{ path: '/', element: <Record layout={layout} /> }]))
  return <RouterProvider router={router} />
}

const meta: Meta = {
  title: 'app/EntityView',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
}

export default meta

export const Column: StoryObj = { render: () => <InRouter layout="column" /> }

export const Rail: StoryObj = { render: () => <InRouter layout="rail" /> }

function LoadingRail() {
  const [router] = useState(() =>
    createMemoryRouter([
      {
        path: '/',
        element: <EntityView layout="rail" isLoading back={{ to: '/', label: 'Projects' }} sections={[]} />,
      },
    ]),
  )
  return <RouterProvider router={router} />
}

export const RailLoading: StoryObj = { render: () => <LoadingRail /> }
