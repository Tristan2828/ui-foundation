import type { Meta, StoryObj } from '@/fixtures/types'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatOccurrence, formatRecurrence } from '@/lib/recurrence-format'
import { nextOccurrence, recurrenceProblem, type Recurrence } from '@/lib/recurrence'
import { inPlace } from './edit-in-place-presets'
import { EmptyText } from './empty-value'
import { EntityForm } from './entity-form'
import { EntityView } from './entity-view'
import { RecurrenceField } from './recurrence-field'

// RecurrenceField (#326) on made-up chores, all on a fixed day (Thursday
// 2026-11-12, 12:00 in Chicago) so the presets and the previews read the
// same every run:
//
// - Default: one set ("every 2nd tue at 9am"), one empty, and a stored
//   rule that can't be (a 30th of February), refused.
// - InAForm: EntityForm with a Repeats field (a Controller), its saved
//   value shown after Save.
// - EditInPlace: on a record's view (`inPlace.recurrence`).
// - Cells: the Repeats label and the Next cell in a list's rows
//   (cell-patterns.md "A repeat and its next time").
// - DatesOnly (4.114): events whose times are their own fields, in an app
//   whose weeks start on Sunday (`times={false}`, `weekStart="SU"`): one
//   set every other week on Sun and Wed, one empty, and one edited in place.
//
// e2e/recurrence-field.spec.ts types the phrases and presses the presets;
// axe and the token check run every story in both themes
// (e2e/fixtures-visual.spec.ts).

const TODAY = '2026-11-12'
const NOW = new Date('2026-11-12T18:00:00Z')
const ZONE = 'America/Chicago'
const fixed = { today: TODAY, now: NOW, timeZone: ZONE, locale: 'en-US' }

const SECOND_TUESDAY: Recurrence = {
  rule: 'FREQ=MONTHLY;BYDAY=2TU',
  start: TODAY,
  times: ['09:00'],
  timeZone: ZONE,
  fromCompletion: false,
}
const NEVER: Recurrence = { ...SECOND_TUESDAY, rule: 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30' }

function Value({ testId, value }: { testId: string; value: Recurrence | null }) {
  return (
    <output data-testid={testId} className="block font-mono text-xs break-all text-muted-foreground">
      {value ? `${value.rule} · ${value.start} · ${value.times.join(',')} · ${value.fromCompletion ? 'from done' : 'schedule'}` : 'none'}
    </output>
  )
}

function Fields() {
  const [filter, setFilter] = useState<Recurrence | null>(SECOND_TUESDAY)
  const [water, setWater] = useState<Recurrence | null>(null)
  const [stored, setStored] = useState<Recurrence | null>(NEVER)
  const problem = stored ? recurrenceProblem(stored) : null
  return (
    <FieldGroup className="max-w-xl">
      <Field>
        <FieldLabel htmlFor="filter-repeats">Change the Filter</FieldLabel>
        <RecurrenceField id="filter-repeats" value={filter} onChange={setFilter} {...fixed} />
        <Value testId="filter-value" value={filter} />
      </Field>
      <Field>
        <FieldLabel htmlFor="water-repeats">Water the Plants</FieldLabel>
        <RecurrenceField id="water-repeats" value={water} onChange={setWater} {...fixed} />
        <Value testId="water-value" value={water} />
      </Field>
      <Field data-invalid={problem ? true : undefined}>
        <FieldLabel htmlFor="stored-repeats">Imported</FieldLabel>
        <RecurrenceField id="stored-repeats" value={stored} onChange={setStored} presets={false} {...fixed} />
        <Value testId="stored-value" value={stored} />
      </Field>
    </FieldGroup>
  )
}

type Chore = { name: string; repeats: Recurrence | null }

function NewChore() {
  const form = useForm<Chore>({ defaultValues: { name: 'Change the filter', repeats: SECOND_TUESDAY } })
  const [saved, setSaved] = useState<Chore | null>(null)
  const { errors, isDirty } = form.formState
  const onSubmit = form.handleSubmit((values) => setSaved(values))
  return (
    <div className="flex flex-col gap-4">
      <EntityForm title="New chore" onSubmit={onSubmit} submitLabel="Save Chore" isSubmitting={false} dirty={isDirty && !saved} errors={errors} onCancel={() => form.reset()}>
        <Field data-invalid={!!errors.name || undefined}>
          <FieldLabel htmlFor="chore-name" required>
            Name
          </FieldLabel>
          <Input id="chore-name" aria-invalid={!!errors.name || undefined} {...form.register('name', { required: 'Give it a name' })} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.repeats || undefined}>
          <FieldLabel htmlFor="chore-repeats" required>
            Repeats
          </FieldLabel>
          <Controller
            control={form.control}
            name="repeats"
            rules={{ validate: (value) => (value ? (recurrenceProblem(value) ?? true) : 'Say how it repeats') }}
            render={({ field }) => (
              <RecurrenceField
                id="chore-repeats"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                invalid={!!errors.repeats}
                aria-describedby={errors.repeats ? 'chore-repeats-error' : undefined}
                {...fixed}
              />
            )}
          />
          <FieldError id="chore-repeats-error" errors={[errors.repeats]} />
        </Field>
      </EntityForm>
      {saved && <Value testId="saved-value" value={saved.repeats} />}
    </div>
  )
}

function InAForm() {
  const [router] = useState(() => createMemoryRouter([{ path: '/', element: <NewChore /> }]))
  return <RouterProvider router={router} />
}

function Record() {
  const [chore, setChore] = useState<{ repeats: Recurrence | null; reminder: Recurrence | null }>({
    repeats: SECOND_TUESDAY,
    reminder: null,
  })
  const save = (change: Partial<typeof chore>) =>
    new Promise((resolve) => setTimeout(() => resolve(setChore((was) => ({ ...was, ...change }))), 300))
  return (
    <EntityView
      isLoading={false}
      back={{ to: '/', label: 'Chores' }}
      title="Change the filter"
      sections={[
        {
          title: 'Schedule',
          fields: [
            { label: 'Repeats', edit: inPlace.recurrence({ value: chore.repeats, required: true, save: (repeats) => save({ repeats }), ...fixed }) },
            { label: 'Reminder', edit: inPlace.recurrence({ value: chore.reminder, save: (reminder) => save({ reminder }), ...fixed }) },
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

const CHORES: { name: string; repeats: Recurrence | null }[] = [
  { name: 'Change the filter', repeats: SECOND_TUESDAY },
  { name: 'Take out the bins', repeats: { ...SECOND_TUESDAY, rule: 'FREQ=WEEKLY;BYDAY=MO,TH', times: ['07:00', '19:30'] } },
  { name: 'Pay the rent', repeats: { ...SECOND_TUESDAY, rule: 'FREQ=MONTHLY;BYMONTHDAY=-1' } },
  { name: 'Descale the kettle', repeats: { ...SECOND_TUESDAY, rule: 'FREQ=DAILY;INTERVAL=30', fromCompletion: true } },
  { name: 'Spring clean', repeats: { ...SECOND_TUESDAY, rule: 'FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=20;UNTIL=20261231' } },
  { name: 'Wash the car', repeats: null },
]

function Cells() {
  return (
    <Table className="max-w-3xl">
      <TableHeader>
        <TableRow>
          <TableHead>Chore</TableHead>
          <TableHead>Repeats</TableHead>
          <TableHead>Next</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {CHORES.map((chore) => {
          const next = chore.repeats ? nextOccurrence(chore.repeats, NOW) : null
          return (
            <TableRow key={chore.name}>
              <TableCell className="font-medium">{chore.name}</TableCell>
              <TableCell>{chore.repeats ? formatRecurrence(chore.repeats, { locale: 'en-US' }) : <EmptyText />}</TableCell>
              <TableCell className="tabular-nums">
                {next && chore.repeats ? (
                  <time dateTime={next.toISOString()}>{formatOccurrence(next, chore.repeats.timeZone, { locale: 'en-US', now: NOW })}</time>
                ) : chore.repeats ? (
                  <span className="text-muted-foreground">Ended</span>
                ) : (
                  <EmptyText />
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

// Made-up events: one every other week on Sunday and Wednesday, from
// Wednesday 2026-11-04, weeks from Sunday (its first Sunday is the 15th).
const BOOK_CLUB: Recurrence = {
  rule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=WE,SU;WKST=SU',
  start: '2026-11-04',
  times: ['00:00'],
  timeZone: ZONE,
  fromCompletion: false,
}
const datesOnly = { ...fixed, times: false, weekStart: 'SU' as const, defaultTimes: ['00:00'] }

function Events() {
  const [club, setClub] = useState<Recurrence | null>(BOOK_CLUB)
  const [market, setMarket] = useState<Recurrence | null>(null)
  const [event, setEvent] = useState<{ repeats: Recurrence | null }>({ repeats: BOOK_CLUB })
  const save = (repeats: Recurrence | null) => new Promise((resolve) => setTimeout(() => resolve(setEvent({ repeats })), 300))
  return (
    <div className="flex flex-col gap-6">
      <FieldGroup className="max-w-xl">
        <Field>
          <FieldLabel htmlFor="club-repeats">Book Club</FieldLabel>
          <RecurrenceField id="club-repeats" value={club} onChange={setClub} {...datesOnly} />
          <Value testId="club-value" value={club} />
        </Field>
        <Field>
          <FieldLabel htmlFor="market-repeats">Farmers Market</FieldLabel>
          <RecurrenceField id="market-repeats" value={market} onChange={setMarket} {...datesOnly} />
          <Value testId="market-value" value={market} />
        </Field>
      </FieldGroup>
      <EntityView
        isLoading={false}
        back={{ to: '/', label: 'Events' }}
        title="Book club"
        sections={[{ title: 'Schedule', fields: [{ label: 'Repeats', edit: inPlace.recurrence({ value: event.repeats, save, ...datesOnly }) }] }]}
      />
    </div>
  )
}

function DatesOnlyStory() {
  const [router] = useState(() => createMemoryRouter([{ path: '/', element: <Events /> }]))
  return <RouterProvider router={router} />
}

const meta: Meta = {
  title: 'app/RecurrenceField',
  parameters: { controls: { disable: true } },
}

export default meta

export const Default: StoryObj = { render: () => <Fields /> }

export const InForm: StoryObj = { name: 'In a form', render: () => <InAForm /> }

export const EditInPlace: StoryObj = { render: () => <InPlace /> }

export const ListCells: StoryObj = { name: 'List cells', render: () => <Cells /> }

export const DatesOnly: StoryObj = { name: 'Dates only', render: () => <DatesOnlyStory /> }
