import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { formatPlainDate, type PlainDate } from '@/lib/plain-date'
import { DateField } from './date-field'
import { editInPlace } from './edit-in-place'
import { EntityView } from './entity-view'

// A plain date on a form (required, and optional with Clear) and edited in
// place on a view, each showing the value it holds, so e2e/date-field.spec.ts
// can check no time zone moves the day. Axe and the token check run the
// form in both themes (e2e/storybook-visual.spec.ts).

function OnAForm() {
  const [finished, setFinished] = useState<PlainDate>('2026-09-02')
  const [due, setDue] = useState<PlainDate>('')
  return (
    <FieldGroup className="max-w-sm">
      <Field>
        <FieldLabel htmlFor="finished">Finished</FieldLabel>
        <DateField id="finished" value={finished} onChange={setFinished} />
        <output data-testid="finished-value">{finished || 'empty'}</output>
      </Field>
      <Field>
        <FieldLabel htmlFor="due">Due</FieldLabel>
        <DateField id="due" value={due} onChange={setDue} clearable placeholder="No due date" />
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

const meta: Meta = {
  title: 'app/DateField',
  parameters: { controls: { disable: true } },
}

export default meta

export const Default: StoryObj = { render: () => <OnAForm /> }

export const EditInPlace: StoryObj = { render: () => <InPlace /> }
