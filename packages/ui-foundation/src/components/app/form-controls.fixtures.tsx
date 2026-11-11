import type { Meta, StoryObj } from '@/fixtures/types'
import { useRef, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { formatPlainDate, type PlainDate } from '@/lib/plain-date'
import { ChoiceButtons } from './choice-buttons'
import { DateField } from './date-field'
import { inPlace } from './edit-in-place-presets'
import { EntityView } from './entity-view'
import { FormDialog } from './form-dialog'
import { MultiPick } from './multi-pick'
import { MultiReference } from './multi-reference'
import { ReferenceCombobox, type ReferenceRecord } from './reference-combobox'

// The form and in-place controls of the form standard (4.86, F10 to F18),
// on made-up books.
//
// - Form: a choice of three as buttons (ChoiceButtons), two typed dates
//   (DateField, sharing a row on a phone too), a series picked or created
//   (ReferenceCombobox `onCreate` opening a FormDialog with the name
//   filled in), a long set of shelves (MultiPick, "Show all 40"), and
//   several authors linked or created (MultiReference `onCreate`). Each
//   shows the value it holds.
// - Record: the same fields edited in place on a record (EntityView's
//   field rows wear the list's row hover; a phone gets a chevron), each
//   save a moment long, then "✓ Saved". "Fail" as an author is refused.
//
// e2e/form-controls.spec.ts drives these; axe in both themes is
// fixtures-visual.spec.ts's COMPOSITE_STORIES.

const FORMATS = [
  { value: 'print', label: 'Print' },
  { value: 'ebook', label: 'Ebook' },
  { value: 'audio', label: 'Audio' },
] as const
type Format = (typeof FORMATS)[number]['value']

type Status = 'to-read' | 'reading' | 'done'
const STATUSES = [
  { value: 'to-read', label: 'To read' },
  { value: 'reading', label: 'Reading' },
  { value: 'done', label: 'Done' },
] as const
const TONE = { 'to-read': 'outline', reading: 'tinted-info', done: 'outline-success' } as const

const SHELF_NAMES = [
  'Atlases', 'Ballads', 'Canals', 'Clocks', 'Coastlines', 'Deserts', 'Engines', 'Ferns', 'Fjords', 'Glaciers',
  'Harbours', 'Islands', 'Kites', 'Lanterns', 'Lighthouses', 'Maps', 'Meadows', 'Moths', 'Orchards', 'Owls',
  'Paper boats', 'Puzzles', 'Quarries', 'Rivers', 'Salt marshes', 'Shipwrecks', 'Snowfields', 'Stars', 'Tides', 'Towers',
  'Trains', 'Tunnels', 'Valleys', 'Volcanoes', 'Weather', 'Wells', 'Windmills', 'Woodlands', 'Workshops', 'Zeppelins',
]
const SHELVES = SHELF_NAMES.map((label, index) => ({ id: index + 1, label }))

// The app's records, searched by name, a moment later as a server would.
function makeStore(names: string[]) {
  const records: ReferenceRecord<number>[] = names.map((label, index) => ({ id: index + 1, label }))
  return {
    records,
    search: (text: string) =>
      new Promise<readonly ReferenceRecord<number>[]>((resolve) =>
        setTimeout(() => resolve(records.filter((record) => record.label.toLowerCase().includes(text.trim().toLowerCase()))), 50),
      ),
    add: (label: string) => {
      const record = { id: records.length + 1, label }
      records.push(record)
      return record
    },
  }
}

// The app's small create form, opened with the typed name: resolves with
// the new record once it's added, or null when cancelled.
function useCreateDialog(noun: string, add: (label: string) => ReferenceRecord<number>) {
  const [name, setName] = useState<string | null>(null)
  const settle = useRef<(record: ReferenceRecord<number> | null) => void>(() => {})
  const create = (typed: string) =>
    new Promise<ReferenceRecord<number> | null>((resolve) => {
      settle.current = resolve
      setName(typed)
    })
  const close = (record: ReferenceRecord<number> | null) => {
    settle.current(record)
    setName(null)
  }
  const dialog = (
    <FormDialog
      title={`New ${noun}`}
      open={name !== null}
      onOpenChange={(open) => {
        if (!open) close(null)
      }}
      onSubmit={(event) => {
        event.preventDefault()
        if (name?.trim()) close(add(name.trim()))
      }}
      isSubmitting={false}
      submitLabel={`Add ${noun}`}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`new-${noun}-name`} required>
            Name
          </FieldLabel>
          <Input id={`new-${noun}-name`} value={name ?? ''} onChange={(event) => setName(event.target.value)} />
        </Field>
      </FieldGroup>
    </FormDialog>
  )
  return { create, dialog }
}

function OnAForm() {
  const [series] = useState(() => makeStore(['Lamplight Quarter', 'The Tin Compass', 'Northwind Atlas']))
  const [authors] = useState(() => makeStore(['A. Example', 'B. Sample', 'C. Placeholder']))
  const [format, setFormat] = useState<Format | null>('print')
  const [started, setStarted] = useState<PlainDate>('2026-03-14')
  const [finished, setFinished] = useState<PlainDate>('')
  const [seriesId, setSeriesId] = useState<number | null>(null)
  const [shelves, setShelves] = useState<number[]>([38])
  const [authorIds, setAuthorIds] = useState<number[]>([1])
  const [authorText, setAuthorText] = useState('')
  const seriesDialog = useCreateDialog('series', series.add)
  const authorDialog = useCreateDialog('author', authors.add)
  const seriesName = series.records.find((record) => record.id === seriesId)?.label
  const authorOptions = authors.records.filter((record) => record.label.toLowerCase().includes(authorText.trim().toLowerCase()))
  return (
    <div className="max-w-xl">
      <FieldGroup>
        <Field size="m">
          <FieldLabel id="format-label">Format</FieldLabel>
          <ChoiceButtons aria-labelledby="format-label" options={FORMATS} value={format} onValueChange={setFormat} clearable />
          <output data-testid="format-value">{format ?? 'empty'}</output>
        </Field>
        <Field size="m">
          <FieldLabel htmlFor="started" required>
            Started on
          </FieldLabel>
          <DateField id="started" value={started} onChange={setStarted} locale="en-US" />
          <output data-testid="started-value">{started || 'empty'}</output>
        </Field>
        <Field size="m">
          <FieldLabel htmlFor="finished">Finished on</FieldLabel>
          <DateField id="finished" value={finished} onChange={setFinished} clearable locale="en-US" />
          <output data-testid="finished-value">{finished || 'empty'}</output>
        </Field>
        <Field size="l">
          <FieldLabel htmlFor="series">Series</FieldLabel>
          <ReferenceCombobox
            id="series"
            value={seriesId}
            onValueChange={setSeriesId}
            label={seriesName}
            search={series.search}
            onCreate={seriesDialog.create}
          />
          <output data-testid="series-value">{seriesName ?? 'empty'}</output>
        </Field>
        <Field>
          <FieldLabel htmlFor="shelves">Shelves</FieldLabel>
          <MultiPick id="shelves" aria-label="Shelves" options={SHELVES} value={shelves} onValueChange={setShelves} />
          <output data-testid="shelves-value">{shelves.join(',') || 'empty'}</output>
        </Field>
        <Field>
          <FieldLabel htmlFor="authors">Authors</FieldLabel>
          <MultiReference
            id="authors"
            options={authorOptions}
            value={authorIds}
            onValueChange={setAuthorIds}
            getLabel={(id) => authors.records.find((record) => record.id === id)?.label}
            onSearchChange={setAuthorText}
            onCreate={authorDialog.create}
          />
          <output data-testid="authors-value">
            {authorIds.map((id) => authors.records.find((record) => record.id === id)?.label).join(', ') || 'empty'}
          </output>
        </Field>
      </FieldGroup>
      {seriesDialog.dialog}
      {authorDialog.dialog}
    </div>
  )
}

const slowly = <T,>(apply: () => T) => new Promise<T>((resolve) => setTimeout(() => resolve(apply()), 300))

function Record() {
  const [series] = useState(() => makeStore(['Lamplight Quarter', 'The Tin Compass', 'Northwind Atlas']))
  const [book, setBook] = useState({
    author: 'A. Example' as string | null,
    status: 'reading' as Status | null,
    format: 'ebook' as Format | null,
    started: '2026-03-14' as PlainDate | null,
    seriesId: 2 as number | null,
  })
  const save = (change: Partial<typeof book>) => slowly(() => setBook((was) => ({ ...was, ...change })))
  const seriesDialog = useCreateDialog('series', series.add)
  const seriesName = series.records.find((record) => record.id === book.seriesId)?.label
  return (
    <>
      <EntityView
        isLoading={false}
        back={{ to: '/', label: 'Books' }}
        title="The Quiet Harbour"
        sections={[
          {
            title: 'Details',
            fields: [
              {
                label: 'Author',
                edit: inPlace.text({
                  value: book.author,
                  save: (author) =>
                    author === 'Fail'
                      ? new Promise((_, reject) => setTimeout(() => reject(new Error("Couldn't save: the server didn't answer.")), 300))
                      : save({ author }),
                }),
              },
              {
                label: 'Status',
                edit: inPlace.select({
                  value: book.status,
                  options: STATUSES,
                  render: (value, label) => <Badge variant={TONE[value]}>{label}</Badge>,
                  save: (status) => save({ status }),
                }),
              },
              { label: 'Format', edit: inPlace.choice({ value: book.format, options: FORMATS, save: (format) => save({ format }) }) },
              {
                label: 'Started on',
                value: book.started ? formatPlainDate(book.started) : null,
                edit: inPlace.date({ value: book.started, locale: 'en-US', save: (started) => save({ started }) }),
              },
              {
                label: 'Series',
                edit: inPlace.reference({
                  value: book.seriesId,
                  label: seriesName,
                  search: series.search,
                  onCreate: seriesDialog.create,
                  save: (seriesId) => save({ seriesId }),
                }),
              },
            ],
          },
        ]}
      />
      {seriesDialog.dialog}
    </>
  )
}

function InPlace() {
  const [router] = useState(() => createMemoryRouter([{ path: '/', element: <Record /> }]))
  return <RouterProvider router={router} />
}

const meta: Meta = {
  title: 'app/FormControls',
  parameters: { controls: { disable: true } },
}

export default meta

export const Form: StoryObj = { render: () => <OnAForm /> }

export const EditInPlace: StoryObj = { render: () => <InPlace /> }
