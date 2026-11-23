import type { Meta, StoryObj } from '@/fixtures/types'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { formatPlainDate, type PlainDate } from '@/lib/plain-date'
import type { WeekdayCode } from '@/lib/recurrence'
import { DateField } from './date-field'
import { editInPlace } from './edit-in-place'
import { inPlace } from './edit-in-place-presets'
import { EntityView } from './entity-view'
import { FillInField } from './fill-in-field'
import { FilterDate } from './filter-date'

// A plain date on a form (required, and optional with Clear) and edited in
// place on a view, each showing the value it holds, so e2e/date-field.spec.ts
// can check no time zone moves the day. Default and EditInPlace are the
// button alone (`typing={false}`); Typed is the default, a box
// with the calendar on its button. Axe and the token check run the forms
// in both themes (e2e/fixtures-visual.spec.ts).

function OnAForm({ typing = false }: { typing?: boolean }) {
  const [finished, setFinished] = useState<PlainDate>('2026-09-02')
  const [due, setDue] = useState<PlainDate>('')
  return (
    <FieldGroup className="max-w-sm">
      <Field>
        <FieldLabel htmlFor="finished">Finished</FieldLabel>
        <DateField id="finished" typing={typing} value={finished} onChange={setFinished} locale="en-US" />
        <output data-testid="finished-value">{finished || 'empty'}</output>
      </Field>
      <Field>
        <FieldLabel htmlFor="due">Due</FieldLabel>
        <DateField id="due" typing={typing} value={due} onChange={setDue} clearable placeholder="No due date" locale="en-US" />
        <output data-testid="due-value">{due || 'empty'}</output>
      </Field>
    </FieldGroup>
  )
}

function Record() {
  const [due, setDue] = useState<PlainDate>('2026-12-31')
  const dueEdit = editInPlace<PlainDate>({
    kind: 'choice',
    value: due,
    save: (next) => new Promise((resolve) => setTimeout(() => resolve(setDue(next)), 300)),
    control: (props) => (
      <DateField
        id={props.id}
        typing={false}
        value={props.value}
        onChange={(next) => props.commit(next)}
        clearable
        placeholder="No due date"
        invalid={props.invalid}
        readOnly={props.disabled}
        defaultOpen
        modal={false}
        onOpenChange={(open) => {
          if (!open) props.cancel()
        }}
        aria-label={props.label}
        aria-describedby={props.describedBy}
      />
    ),
  })
  return (
    <EntityView
      isLoading={false}
      back={{ to: '/', label: 'Tasks' }}
      title="File the return"
      sections={[
        {
          title: 'Details',
          fields: [{ label: 'Due', value: formatPlainDate(due), emptyLabel: 'No due date', edit: dueEdit }],
        },
      ]}
    />
  )
}

function InPlace() {
  const [router] = useState(() => createMemoryRouter([{ path: '/', element: <Record /> }]))
  return <RouterProvider router={router} />
}

// Every place a date calendar opens, on Wednesday Sep 16, 2026, with one
// week start: left out (Monday), or an app's Sunday. e2e/week-start.spec.ts
// opens each, reads its weekday row and walks its Home and End.
function Everywhere({ weekStart }: { weekStart?: WeekdayCode }) {
  const [due, setDue] = useState<PlainDate>('2026-09-16')
  const [filed, setFiled] = useState<PlainDate>('2026-09-16')
  const [typed, setTyped] = useState<PlainDate>('2026-09-16')
  const [button, setButton] = useState<PlainDate>('2026-09-16')
  const [buyOn, setBuyOn] = useState<PlainDate>('2026-09-16')
  const [range, setRange] = useState('2026-09-16..2026-09-17')
  const locale = 'en-US'
  return (
    <EntityView
      isLoading={false}
      back={{ to: '/', label: 'Tasks' }}
      title="File the return"
      sections={[
        {
          title: 'Details',
          fields: [
            { label: 'Due', edit: inPlace.date({ value: due, required: true, weekStart, locale, save: async (next) => setDue(next) }) },
            {
              label: 'Filed',
              edit: inPlace.date({
                value: filed,
                required: true,
                typing: false,
                weekStart,
                locale,
                save: async (next) => setFiled(next),
              }),
            },
          ],
        },
        {
          title: 'On a form',
          content: (
            <FieldGroup className="max-w-sm">
              <Field>
                <FieldLabel htmlFor="typed">Typed</FieldLabel>
                <DateField id="typed" value={typed} onChange={setTyped} weekStart={weekStart} locale={locale} />
              </Field>
              <Field>
                <FieldLabel htmlFor="button">Button</FieldLabel>
                <DateField id="button" typing={false} value={button} onChange={setButton} weekStart={weekStart} locale={locale} />
              </Field>
              <FillInField
                field={{ name: 'buyOn', label: 'Buy On', kind: 'date' }}
                value={buyOn}
                onChange={(next) => setBuyOn(String(next ?? ''))}
                weekStart={weekStart}
                locale={locale}
              />
            </FieldGroup>
          ),
        },
        {
          title: 'Filtering a list',
          content: <FilterDate label="Due" value={range} onValueChange={setRange} weekStart={weekStart} locale={locale} />,
        },
      ]}
    />
  )
}

function EverywhereOnAPage({ weekStart }: { weekStart?: WeekdayCode }) {
  const [router] = useState(() => createMemoryRouter([{ path: '/', element: <Everywhere weekStart={weekStart} /> }]))
  return <RouterProvider router={router} />
}

const meta: Meta = {
  title: 'app/DateField',
  parameters: { controls: { disable: true } },
}

export default meta

export const Default: StoryObj = { render: () => <OnAForm /> }

export const EditInPlace: StoryObj = { render: () => <InPlace /> }

export const Typed: StoryObj = { render: () => <OnAForm typing /> }

export const EveryCalendar: StoryObj = { render: () => <EverywhereOnAPage /> }

export const WeeksFromSunday: StoryObj = { render: () => <EverywhereOnAPage weekStart="SU" /> }
