import type { Meta, StoryObj } from '@/fixtures/types'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { editInPlace } from './edit-in-place'
import { EntityView, type EntityViewSection } from './entity-view'
import type { EntityViewFactBadge } from './entity-view-facts'
import { MultiPick } from './multi-pick'

// A record's flags as toned badges in the facts rail (4.123's `tone` on a
// badge item), on a made-up record: "Blocked" in the destructive tone and
// "Needs you" in the warning tone, edited in place with MultiPick, beside
// an untoned badges fact. On a phone the rail folds into Details and the
// tones come along. e2e/fact-badge-tones.spec.ts drives it, axe included
// in both themes at both widths.

const meta: Meta = {
  title: 'app/Fact Badge Tones',
  parameters: { controls: { disable: true } },
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
        <Toaster />
      </TooltipProvider>
    ),
  ],
}

export default meta

type Flag = 'blocked' | 'needs-you'

const FLAGS = [
  { id: 'blocked' as const, label: 'Blocked' },
  { id: 'needs-you' as const, label: 'Needs you' },
]

// Each flag's badge: the word says it, the tone makes it read at a glance.
const FLAG_BADGE: Record<Flag, EntityViewFactBadge> = {
  blocked: { label: 'Blocked', tone: 'destructive' },
  'needs-you': { label: 'Needs you', tone: 'warning' },
}

function FlaggedRecord() {
  const [flags, setFlags] = useState<Flag[]>(['blocked'])
  const sections: EntityViewSection[] = [
    { title: 'Purpose', tab: 'Purpose', content: <p className="type-body">Swap the old shelving for the new units.</p> },
    {
      title: 'Facts',
      placement: 'rail',
      facts: [
        {
          label: 'Flags',
          kind: 'badges',
          items: FLAGS.filter((flag) => flags.includes(flag.id)).map((flag) => FLAG_BADGE[flag.id]),
          emptyLabel: 'None',
          edit: editInPlace<Flag[]>({
            kind: 'multi',
            value: flags,
            save: async (next) => setFlags(next),
            control: (props) => (
              <MultiPick
                options={FLAGS}
                value={props.value}
                onValueChange={props.onChange}
                aria-label={props.label}
                aria-describedby={props.describedBy}
              />
            ),
          }),
        },
        { label: 'Areas', kind: 'badges', items: ['Workshop', 'Storage'] },
        { label: 'Added', kind: 'text', text: 'Nov 2, 2026' },
      ],
    },
  ]
  return <EntityView isLoading={false} back={{ to: '/', label: 'Items' }} title="Shelving swap" factsRail sections={sections} />
}

function FlaggedRecordInRouter() {
  const [router] = useState(() => createMemoryRouter([{ path: '*', element: <FlaggedRecord /> }]))
  return <RouterProvider router={router} />
}

export const Flags: StoryObj = { name: 'Flags', render: () => <FlaggedRecordInRouter /> }
