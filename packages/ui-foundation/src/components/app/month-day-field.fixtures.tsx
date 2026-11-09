import type { Meta, StoryObj } from '@/fixtures/types'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { monthDayProblem, type MonthDay } from '@/lib/month-day'
import { inPlace } from './edit-in-place-presets'
import { EntityView } from './entity-view'
import { MonthDayField } from './month-day-field'

// A month and day with no year on a form (one set, one optional and
// empty, and a stored value that isn't a day of the year, refused), open
// on its days and on its months, and edited in place on a view (two of
// them, and one saved as one with a rule). Each shows the value it holds,
// so e2e/month-day-field.spec.ts can read what was picked. Axe and the
// token check run every story in both themes (e2e/fixtures-visual.spec.ts).

function OnAForm({ defaultOpen }: { defaultOpen?: 'days' | 'months' }) {
  const [from, setFrom] = useState<MonthDay>('03-14')
  const [by, setBy] = useState<MonthDay>('')
  const [stored, setStored] = useState<MonthDay>('02-30')
  const problem = monthDayProblem(stored)
  return (
    <FieldGroup className="max-w-sm">
      <Field>
        <FieldLabel htmlFor="blooms-from">Blooms from</FieldLabel>
        <MonthDayField id="blooms-from" value={from} onChange={setFrom} defaultOpen={defaultOpen === 'days'} />
        <output data-testid="from-value">{from || 'empty'}</output>
      </Field>
      <Field>
        <FieldLabel htmlFor="blooms-by">Blooms by</FieldLabel>
        <MonthDayField
          id="blooms-by"
          value={by}
          onChange={setBy}
          clearable
          placeholder="No end day"
          defaultOpen={defaultOpen === 'months'}
        />
        <output data-testid="by-value">{by || 'empty'}</output>
      </Field>
      <Field data-invalid={problem ? true : undefined}>
        <FieldLabel htmlFor="pruned">Pruned</FieldLabel>
        <MonthDayField
          id="pruned"
          value={stored}
          onChange={setStored}
          clearable
          invalid={!!problem}
          aria-describedby={problem ? 'pruned-error' : undefined}
        />
        {problem && <FieldError id="pruned-error">{problem}</FieldError>}
        <output data-testid="pruned-value">{stored || 'empty'}</output>
      </Field>
    </FieldGroup>
  )
}

type Plant = { from: MonthDay | null; by: MonthDay | null; leap: MonthDay | null; seasonFrom: MonthDay; seasonBy: MonthDay }

function Record() {
  const [plant, setPlant] = useState<Plant>({ from: '04-01', by: '05-15', leap: '02-29', seasonFrom: '11-01', seasonBy: '02-28' })
  const save = (change: Partial<Plant>) =>
    new Promise((resolve) => setTimeout(() => resolve(setPlant((was) => ({ ...was, ...change }))), 300))
  return (
    <EntityView
      isLoading={false}
      back={{ to: '/', label: 'Plants' }}
      title="Tulip bed"
      sections={[
        {
          title: 'Each year',
          fields: [
            { label: 'Blooms from', edit: inPlace.monthDay({ value: plant.from, save: (from) => save({ from }) }) },
            {
              label: 'Blooms by',
              edit: inPlace.monthDay({ value: plant.by, required: true, format: { month: 'long', day: 'numeric' }, save: (by) => save({ by }) }),
            },
            { label: 'Checked on', edit: inPlace.monthDay({ value: plant.leap, save: (leap) => save({ leap }) }) },
            {
              label: 'Resting season',
              edit: inPlace.fields({
                value: { seasonFrom: plant.seasonFrom, seasonBy: plant.seasonBy },
                fields: {
                  seasonFrom: { kind: 'monthDay', label: 'From', required: true },
                  seasonBy: { kind: 'monthDay', label: 'By', required: true },
                },
                // A season may run over New Year (Nov 1 to Feb 28); it only can't end the day it starts.
                rule: (season) => (season.seasonFrom === season.seasonBy ? 'A season ends on another day than it starts' : null),
                save: (season) => save(season),
              }),
            },
          ],
        },
      ]}
    />
  )
}

function InPlace() {
  const [router] = useState(() => createMemoryRouter([{ path: '/', element: <Record /> }]))
  return <RouterProvider router={router} />
}

const meta: Meta = {
  title: 'app/MonthDayField',
  parameters: { controls: { disable: true } },
}

export default meta

export const Default: StoryObj = { render: () => <OnAForm /> }

export const OpenOnDays: StoryObj = { render: () => <OnAForm defaultOpen="days" /> }

export const OpenOnMonths: StoryObj = { render: () => <OnAForm defaultOpen="months" /> }

export const EditInPlace: StoryObj = { render: () => <InPlace /> }
