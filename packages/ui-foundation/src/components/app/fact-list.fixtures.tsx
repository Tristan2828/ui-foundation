import type { Meta, StoryObj } from '@/fixtures/types'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { CalendarIcon, FileTextIcon, MessageSquareIcon } from 'lucide-react'
import { EntityView } from './entity-view'
import { FactList, FactListItem } from './fact-list'

// Several items in one fact (4.111), e2e/fact-list.spec.ts: a record's
// Links box, whose Related row lists linked records with long titles that
// wrap, each led by its kind's icon (4I); For, one record with no icon (a
// bullet); and a Tasks box an app draws itself with FactList, plain
// bullets, one of them long. Axe, token-only colours and the glyphs at
// 3:1 in both themes and every palette are fixtures-visual.spec.ts's.
const meta: Meta = {
  title: 'app/FactList',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
}

export default meta

const TASKS = [
  'Call the landlord about the loading bay',
  'Book the lift for both Saturday mornings, and ask whether the second one can start an hour earlier than the first',
  'Label the boxes',
]

function LinksRecord() {
  return (
    <EntityView
      isLoading={false}
      back={{ to: '/', label: 'Projects' }}
      title="Office move"
      sections={[
        {
          title: 'Links',
          facts: [
            {
              label: 'Related',
              kind: 'list',
              items: [
                {
                  name: 'Ask the landlord whether the loading bay can be booked for the whole of the second morning',
                  to: '/discussions/3',
                  icon: MessageSquareIcon,
                },
                { name: 'Moving day, the second weekend', to: '/events/8', icon: CalendarIcon },
                {
                  name: 'The floor plan for the third floor, with every desk and cabinet marked on it',
                  href: 'https://example.com/plan',
                  icon: FileTextIcon,
                },
              ],
            },
            { label: 'For', kind: 'list', items: [{ name: 'Facilities', to: '/teams/2' }] },
            { label: 'From', kind: 'list', items: [], emptyLabel: 'Nothing yet' },
          ],
        },
        {
          title: 'Tasks',
          content: (
            <FactList aria-label="Tasks">
              {TASKS.map((task) => (
                <FactListItem key={task}>{task}</FactListItem>
              ))}
            </FactList>
          ),
        },
      ]}
    />
  )
}

function InRouter() {
  const [router] = useState(() => createMemoryRouter([{ path: '*', element: <LinksRecord /> }]))
  return (
    <div className="mx-auto max-w-xl p-4">
      <RouterProvider router={router} />
    </div>
  )
}

export const LinksBox: StoryObj = { name: 'Links box', render: () => <InRouter /> }
