import { StoreIcon, TruckIcon } from 'lucide-react'
import type { Meta, StoryObj } from '@/fixtures/types'
import { useRef, useState, type ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { formatPlainDate, type PlainDate } from '@/lib/plain-date'
import { titleCase } from '@/lib/title-case'
import { ChoiceButtons } from './choice-buttons'
import { DateField } from './date-field'
import { inPlace } from './edit-in-place-presets'
import { EntityView } from './entity-view'
import { FormDialog } from './form-dialog'
import { MultiChoice } from './multi-choice'
import { MultiPick } from './multi-pick'
import { MultiReference } from './multi-reference'
import { OptionSelect } from './option-select'
import { ReferenceCombobox, type ReferenceRecord } from './reference-combobox'

// The form and in-place controls of the form standard (4.88, F10 to F18),
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
// - Narrow: ChoiceButtons of four in a 280px box, on a form, edited in
//   place on a record, and in a dialog's row beside a second choice (two
//   choices share a row, 4.98), the two dates on the next: the buttons
//   wrap onto a second line, never past the box's edge.
//
// - Choice pairs (4.98, 9C): five choice fields in a 460px form, two to
//   a row and the fifth on a row of its own; on a phone Side and Coats
//   stay side by side (both fit), Room and Effort each take a row (too
//   wide for half of one).
//
// - Status selects (4.109): a status of five or more as OptionSelect, each
//   option's kind icon in its colour on the trigger and in the list, as
//   ChoiceButtons draws it, on the page and on a card.
//
// - Narrow filters (4.109): a 192px MultiChoice filter with a long summary
//   beside a 192px Input, the two the same height.
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
      title={`New ${titleCase(noun)}`}
      open={name !== null}
      onOpenChange={(open) => {
        if (!open) close(null)
      }}
      onSubmit={(event) => {
        event.preventDefault()
        if (name?.trim()) close(add(name.trim()))
      }}
      isSubmitting={false}
      submitLabel={`Add ${titleCase(noun)}`}
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
            Started On
          </FieldLabel>
          <DateField id="started" value={started} onChange={setStarted} locale="en-US" />
          <output data-testid="started-value">{started || 'empty'}</output>
        </Field>
        <Field size="m">
          <FieldLabel htmlFor="finished">Finished On</FieldLabel>
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
                label: 'Started On',
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

const BINDINGS = [
  { value: 'paperback', label: 'Paperback' },
  { value: 'hardcover', label: 'Hardcover' },
  { value: 'ebook', label: 'Ebook' },
  { value: 'audiobook', label: 'Audiobook' },
] as const
type Binding = (typeof BINDINGS)[number]['value']
const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'used', label: 'Used' },
] as const
type Condition = (typeof CONDITIONS)[number]['value']

// A 280px box: a phone's narrow column, a panel, a field sharing a row.
function NarrowBox({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section aria-label={name} data-testid={`narrow-${name.toLowerCase().replace(/\W+/g, '-')}`} className="w-70 rounded-md border border-dashed border-border p-2">
      {children}
    </section>
  )
}

function NarrowRecord() {
  const [binding, setBinding] = useState<Binding | null>('hardcover')
  return (
    <EntityView
      isLoading={false}
      back={{ to: '/', label: 'Books' }}
      title="The Quiet Harbour"
      sections={[
        {
          title: 'Details',
          fields: [
            {
              label: 'Binding',
              edit: inPlace.choice({ value: binding, options: BINDINGS, save: (next) => slowly(() => setBinding(next)) }),
            },
          ],
        },
      ]}
    />
  )
}

function NarrowControls() {
  const [binding, setBinding] = useState<Binding | null>('ebook')
  const [dialogBinding, setDialogBinding] = useState<Binding | null>('paperback')
  const [dialogCondition, setDialogCondition] = useState<Condition | null>('used')
  const [started, setStarted] = useState<PlainDate>('2026-03-14')
  const [finished, setFinished] = useState<PlainDate>('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [router] = useState(() => createMemoryRouter([{ path: '/', element: <NarrowRecord /> }]))
  return (
    <div className="flex flex-col gap-6">
      <NarrowBox name="Form">
        <Field>
          <FieldLabel id="narrow-binding-label">Binding</FieldLabel>
          <ChoiceButtons aria-labelledby="narrow-binding-label" options={BINDINGS} value={binding} onValueChange={setBinding} />
        </Field>
      </NarrowBox>
      <NarrowBox name="Record">
        <RouterProvider router={router} />
      </NarrowBox>
      <Button variant="outline" className="w-fit" onClick={() => setDialogOpen(true)}>
        Edit Book
      </Button>
      <FormDialog
        title="Edit Book"
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={(event) => {
          event.preventDefault()
          setDialogOpen(false)
        }}
        isSubmitting={false}
        submitLabel="Save Changes"
      >
        <FieldGroup>
          <Field size="m">
            <FieldLabel id="dialog-binding-label">Binding</FieldLabel>
            <ChoiceButtons
              aria-labelledby="dialog-binding-label"
              options={BINDINGS}
              value={dialogBinding}
              onValueChange={setDialogBinding}
            />
          </Field>
          {/* A second choice: the two share the row (9C, 4.98), so Binding
              has half of it and its four buttons wrap inside its field. */}
          <Field size="m">
            <FieldLabel id="dialog-condition-label">Condition</FieldLabel>
            <ChoiceButtons
              aria-labelledby="dialog-condition-label"
              options={CONDITIONS}
              value={dialogCondition}
              onValueChange={setDialogCondition}
            />
          </Field>
          <Field size="m">
            <FieldLabel htmlFor="dialog-started">Started On</FieldLabel>
            <DateField id="dialog-started" value={started} onChange={setStarted} locale="en-US" />
          </Field>
          <Field size="m">
            <FieldLabel htmlFor="dialog-finished">Finished On</FieldLabel>
            <DateField id="dialog-finished" value={finished} onChange={setFinished} clearable locale="en-US" />
          </Field>
        </FieldGroup>
      </FormDialog>
    </div>
  )
}

const ROOMS = [
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'hall', label: 'Hall' },
  { value: 'garden', label: 'Garden' },
] as const
const SIDES = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'both', label: 'Both' },
] as const
const EFFORTS = [
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'heavy', label: 'Heavy' },
] as const
const COATS = [
  { value: 'one', label: 'One' },
  { value: 'two', label: 'Two' },
] as const

function ChoiceField<T extends string>({
  name,
  options,
  initial,
}: {
  name: string
  options: readonly { value: T; label: string }[]
  initial: T
}) {
  const [value, setValue] = useState<T | null>(initial)
  const id = `pair-${name.toLowerCase()}`
  return (
    <Field size="m">
      <FieldLabel id={id}>{name}</FieldLabel>
      <ChoiceButtons aria-labelledby={id} options={options} value={value} onValueChange={setValue} />
    </Field>
  )
}

function ChoicePairForm() {
  return (
    <div data-testid="choice-pairs" className="w-full max-w-[460px] rounded-lg border border-border bg-card p-5">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="pair-name">Job</FieldLabel>
          <Input id="pair-name" defaultValue="Paint the door" />
        </Field>
        <ChoiceField name="Room" options={ROOMS} initial="hall" />
        <ChoiceField name="Effort" options={EFFORTS} initial="moderate" />
        <ChoiceField name="Side" options={SIDES} initial="both" />
        <ChoiceField name="Coats" options={COATS} initial="two" />
        <ChoiceField name="Finish" options={COATS} initial="one" />
      </FieldGroup>
    </div>
  )
}

// A status as a choice (4.105): each option a status kind, its icon in the
// kind's colour as StatusMark draws it, on the page and on a card, one
// picked in the theme colour; and an option with a plain icon.
const OUTCOMES = [
  { value: 'done', label: 'Done', kind: 'done' },
  { value: 'booked', label: 'Booked', kind: 'planned' },
  { value: 'called-off', label: 'Called Off', kind: 'ended' },
] as const
const URGENCY = [
  { value: 'now', label: 'Now', kind: 'attention' },
  { value: 'soon', label: 'Soon', kind: 'paused' },
  { value: 'going', label: 'Going', kind: 'active' },
] as const
const DELIVERY = [
  { value: 'pickup', label: 'Pick Up', icon: StoreIcon },
  { value: 'post', label: 'Post', icon: TruckIcon },
] as const

function StatusChoiceFields({ prefix }: { prefix: string }) {
  const [outcome, setOutcome] = useState<string | null>('booked')
  const [urgency, setUrgency] = useState<string | null>('now')
  const [delivery, setDelivery] = useState<string | null>('post')
  return (
    <FieldGroup>
      <Field size="m">
        <FieldLabel id={`${prefix}-outcome`}>Outcome</FieldLabel>
        <ChoiceButtons aria-labelledby={`${prefix}-outcome`} options={OUTCOMES} value={outcome} onValueChange={setOutcome} />
      </Field>
      <Field size="m">
        <FieldLabel id={`${prefix}-urgency`}>Urgency</FieldLabel>
        <ChoiceButtons aria-labelledby={`${prefix}-urgency`} options={URGENCY} value={urgency} onValueChange={setUrgency} />
      </Field>
      <Field size="m">
        <FieldLabel id={`${prefix}-delivery`}>Delivery</FieldLabel>
        <ChoiceButtons aria-labelledby={`${prefix}-delivery`} options={DELIVERY} value={delivery} onValueChange={setDelivery} />
      </Field>
    </FieldGroup>
  )
}

function StatusChoicesPage() {
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div data-testid="status-choices-page">
        <StatusChoiceFields prefix="page" />
      </div>
      <div data-testid="status-choices-card" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 text-card-foreground">
        <p className="type-caption text-muted-foreground">Status choices on a card</p>
        <StatusChoiceFields prefix="card" />
      </div>
    </div>
  )
}

// A status of five or more (4.109): OptionSelect, each option's kind icon
// in its colour, on the trigger and in the list; and one with plain icons.
const STAGES = [
  { value: 'idea', label: 'Idea', kind: 'planned' },
  { value: 'drafting', label: 'Drafting', kind: 'active' },
  { value: 'stuck', label: 'Stuck', kind: 'attention' },
  { value: 'shelved', label: 'Shelved', kind: 'paused' },
  { value: 'sent', label: 'Sent', kind: 'done' },
  { value: 'dropped', label: 'Dropped', kind: 'ended' },
] as const
const PICKUP = [
  { value: 'shop', label: 'From the Shop', icon: StoreIcon },
  { value: 'van', label: 'By Van', icon: TruckIcon },
] as const

function StatusSelectFields({ prefix }: { prefix: string }) {
  const [stage, setStage] = useState<string | null>('stuck')
  const [pickup, setPickup] = useState<string | null>('van')
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor={`${prefix}-stage`}>Stage</FieldLabel>
        <OptionSelect id={`${prefix}-stage`} options={STAGES} value={stage} onValueChange={setStage} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-pickup`}>Pick Up</FieldLabel>
        <OptionSelect id={`${prefix}-pickup`} options={PICKUP} value={pickup} onValueChange={setPickup} />
      </Field>
    </FieldGroup>
  )
}

function StatusSelectsPage() {
  return (
    <div className="flex max-w-sm flex-col gap-6">
      <div data-testid="status-selects-page">
        <StatusSelectFields prefix="page" />
      </div>
      <div data-testid="status-selects-card" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 text-card-foreground">
        <p className="type-caption text-muted-foreground">Status selects on a card</p>
        <StatusSelectFields prefix="card" />
      </div>
    </div>
  )
}

// A list's filters in a row (4.109): a 192px MultiChoice whose summary is
// long, beside a 192px Input; the two stay one line, the same height.
const FILTER_SHELVES = ['Hallway bookcase by the stairs', 'Study', 'Attic boxes', 'Kitchen'] as const

function NarrowFilterRow() {
  const [shelves, setShelves] = useState<string[]>(['Hallway bookcase by the stairs', 'Attic boxes'])
  return (
    <div data-testid="narrow-filters" className="flex items-start gap-2">
      <Input aria-label="Search by title" placeholder="Search by title" className="w-48" />
      <MultiChoice
        label="Shelf"
        options={FILTER_SHELVES}
        value={shelves}
        onValueChange={setShelves}
        placeholder="Any shelf"
        aria-label="Filter by shelf"
        className="w-48"
      />
    </div>
  )
}

const meta: Meta = {
  title: 'app/FormControls',
  parameters: { controls: { disable: true } },
}

export default meta

export const Form: StoryObj = { render: () => <OnAForm /> }

export const EditInPlace: StoryObj = { render: () => <InPlace /> }

export const Narrow: StoryObj = { render: () => <NarrowControls /> }

export const ChoicePairs: StoryObj = { name: 'Choice pairs', render: () => <ChoicePairForm /> }

export const StatusChoices: StoryObj = { name: 'Status choices', render: () => <StatusChoicesPage /> }

export const StatusSelects: StoryObj = { name: 'Status selects', render: () => <StatusSelectsPage /> }

export const NarrowFilters: StoryObj = { name: 'Narrow filters', render: () => <NarrowFilterRow /> }
