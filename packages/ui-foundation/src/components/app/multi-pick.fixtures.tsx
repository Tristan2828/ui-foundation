import type { Meta, StoryObj } from '@/fixtures/types'
import { TagIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { AppError } from '@/api/contracts'
import { editInPlace } from './edit-in-place'
import { EntityView, type EntityViewSection } from './entity-view'
import { FormDialog } from './form-dialog'
import { MultiPick, type MultiPickOption } from './multi-pick'

// MultiPick, a small set's picker (cell-patterns.md "A small set"), in
// both places it goes. InPlace is a record's Labels edited in place: every
// label shown on opening, each click saved on its own after 500ms, and
// "Archived" refused the way a 422 on the field is. Saves counts the
// requests a server would get. Create "<typed>" there opens the app's
// small New Label form with the name (onCreate), and the label it adds is
// picked and saved. OnAForm is the same control changing a form's value;
// its Create saves the label at once (400ms), refusing "Restricted" the
// way a 422 would. e2e/multi-pick.spec.ts drives both, axe in both themes
// included.

type Label = { id: number; name: string; colour: string }

// Whole class names, as an app's own slot -> class map has them.
const LABELS: Label[] = [
  { id: 1, name: 'Finance', colour: 'text-category-1' },
  { id: 2, name: 'Design', colour: 'text-category-2' },
  { id: 3, name: 'Support', colour: 'text-category-3' },
  { id: 4, name: 'Facilities', colour: 'text-category-4' },
  { id: 5, name: 'Legal', colour: 'text-category-5' },
  { id: 6, name: 'Hiring', colour: 'text-category-6' },
  { id: 7, name: 'Security', colour: 'text-category-7' },
  { id: 8, name: 'Archived', colour: 'text-category-8' },
  { id: 9, name: 'Travel', colour: 'text-category-9' },
  { id: 10, name: 'Training', colour: 'text-category-10' },
]

const optionOf = (label: Label): MultiPickOption<number> => ({
  id: label.id,
  label: label.name,
  icon: <TagIcon className={`size-3.5 ${label.colour}`} />,
})

// The app's label list: the ten above, and any added since.
function useLabels() {
  const [labels, setLabels] = useState(LABELS)
  const nextId = useRef(101)
  const add = (name: string) => {
    const label: Label = { id: nextId.current++, name, colour: 'text-category-1' }
    setLabels((current) => [...current, label])
    return label
  }
  const nameOf = (id: number) => labels.find((label) => label.id === id)?.name ?? String(id)
  return { labels, options: labels.map(optionOf), add, nameOf }
}

function LabelBadges({ labels, ids }: { labels: readonly Label[]; ids: readonly number[] }) {
  if (ids.length === 0) return <span className="text-muted-foreground">No labels</span>
  return (
    <span className="flex flex-wrap gap-1" data-testid="saved-labels">
      {labels
        .filter((label) => ids.includes(label.id))
        .map((label) => (
          <Badge key={label.id} variant="outline">
            <TagIcon aria-hidden="true" className={label.colour} />
            {label.name}
          </Badge>
        ))}
    </span>
  )
}

const meta: Meta = {
  title: 'app/MultiPick',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
}

export default meta

// The app's small create form, opened with the typed name: resolves with
// the new label once it's added, or null when cancelled.
function useNewLabelForm(add: (name: string) => Label) {
  const [name, setName] = useState<string | null>(null)
  const settle = useRef<(option: MultiPickOption<number> | null) => void>(() => {})
  const create = (typed: string) =>
    new Promise<MultiPickOption<number> | null>((resolve) => {
      settle.current = resolve
      setName(typed)
    })
  const close = (option: MultiPickOption<number> | null) => {
    settle.current(option)
    setName(null)
  }
  const dialog = (
    <FormDialog
      title="New Label"
      open={name !== null}
      onOpenChange={(open) => {
        if (!open) close(null)
      }}
      onSubmit={(event) => {
        event.preventDefault()
        if (name?.trim()) close(optionOf(add(name.trim())))
      }}
      isSubmitting={false}
      submitLabel="Add Label"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="new-label-name" required>
            Name
          </FieldLabel>
          <Input id="new-label-name" value={name ?? ''} onChange={(event) => setName(event.target.value)} />
        </Field>
      </FieldGroup>
    </FormDialog>
  )
  return { create, dialog }
}

function InPlaceRecord() {
  const { labels: all, options, add, nameOf } = useLabels()
  const newLabel = useNewLabelForm(add)
  const [labels, setLabels] = useState<number[]>([1, 3])
  const [saves, setSaves] = useState(0)
  // One pick, applied to the latest saved labels when it lands: the
  // record's latest value, as useRecordUpdate builds a change from it.
  const savePick = (id: number, picked: boolean) =>
    new Promise<void>((resolve, reject) =>
      setTimeout(() => {
        setSaves((count) => count + 1)
        if (id === 8) {
          const error: AppError = {
            kind: 'validation',
            message: 'The request was refused.',
            fieldErrors: { labels: ['Archived is set by the archive job, not by hand.'] },
          }
          reject(error)
          return
        }
        setLabels((current) => (picked ? [...current, id].sort((a, b) => a - b) : current.filter((other) => other !== id)))
        resolve()
      }, 500),
    )
  const edit = editInPlace<number[]>({
    kind: 'multi',
    value: labels,
    // Never called: nothing is drafted, each pick saves itself.
    save: (next) => Promise.resolve(setLabels(next)),
    control: (props) => (
      <MultiPick
        id={props.id}
        options={options}
        value={labels}
        onPick={savePick}
        onCreate={newLabel.create}
        aria-label={props.label}
        aria-describedby={props.describedBy}
      />
    ),
  })
  const sections: EntityViewSection[] = [
    {
      title: 'Details',
      fields: [
        { label: 'Labels', value: <LabelBadges labels={all} ids={labels} />, edit },
        { label: 'Saves', value: <span data-testid="saves">{saves}</span> },
        { label: 'Saved', value: <span data-testid="saved">{labels.map(nameOf).join(', ') || 'none'}</span> },
      ],
    },
  ]
  return (
    <>
      <EntityView isLoading={false} back={{ to: '/projects', label: 'Projects' }} title="Office move" sections={sections} />
      {newLabel.dialog}
    </>
  )
}

function InPlaceInRouter() {
  const [router] = useState(() =>
    createMemoryRouter([
      { path: '/', element: <InPlaceRecord /> },
      { path: '/projects', element: <p>Projects</p> },
    ]),
  )
  return <RouterProvider router={router} />
}

export const InPlace: StoryObj = { render: () => <InPlaceInRouter /> }

function Form() {
  const { options, add, nameOf } = useLabels()
  const [labels, setLabels] = useState<number[]>([2])
  // Saved at once, no form: the server's answer is the option, or its refusal.
  const createNow = (name: string) =>
    new Promise<MultiPickOption<number>>((resolve, reject) =>
      setTimeout(() => {
        if (name.toLowerCase() === 'restricted') {
          const error: AppError = {
            kind: 'validation',
            message: 'The request was refused.',
            fieldErrors: { name: ['That name is kept for the system.'] },
          }
          reject(error)
          return
        }
        resolve(optionOf(add(name)))
      }, 400),
    )
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <MultiPick options={options} value={labels} onValueChange={setLabels} onCreate={createNow} aria-label="Labels" />
      <p className="type-caption text-muted-foreground" data-testid="form-value">
        Value: {labels.map(nameOf).join(', ') || 'none'}
      </p>
    </div>
  )
}

export const OnAForm: StoryObj = { render: () => <Form /> }
