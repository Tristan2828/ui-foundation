import type { Meta, StoryObj } from '@/fixtures/types'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { inPlace } from './edit-in-place-presets'
import { EditableValue } from './editable-value'
import { EntityView, type EntityViewSection } from './entity-view'

// <EditableValue layout="inline"> in a summary line (4.102): two values
// joined by "·", each edited where it's shown. At rest a pencil takes no
// room, so each "·" sits a space after its value; hover or focus opens
// the pencil out beside the value. e2e/editable-value.spec.ts measures
// the gaps, drives it from the keyboard and runs axe in both themes.

const meta: Meta = {
  title: 'app/EditableValue',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
}

export default meta

function SummaryRecord() {
  const [place, setPlace] = useState('Harbor Office')
  const [days, setDays] = useState('Tuesdays')
  const slowly = (apply: () => void) => new Promise<void>((resolve) => setTimeout(() => resolve(apply()), 200))
  const placeEdit = inPlace.text({ value: place, save: (next) => slowly(() => setPlace(next)) })
  const daysEdit = inPlace.text({ value: days, save: (next) => slowly(() => setDays(next)) })
  const sections: EntityViewSection[] = [
    {
      title: 'Details',
      fields: [
        {
          label: 'Where',
          value: (
            <span data-testid="summary-line">
              <EditableValue label="Place" edit={placeEdit} layout="inline" />
              {' · '}
              <EditableValue label="Days" edit={daysEdit} layout="inline" />
              {' · Room 4'}
            </span>
          ),
        },
      ],
    },
  ]
  return <EntityView isLoading={false} back={{ to: '/', label: 'Projects' }} title="Office move" sections={sections} />
}

function InRouter() {
  const [router] = useState(() => createMemoryRouter([{ path: '/', element: <SummaryRecord /> }]))
  return <RouterProvider router={router} />
}

export const InlineInALine: StoryObj = { name: 'Inline in a line', render: () => <InRouter /> }
