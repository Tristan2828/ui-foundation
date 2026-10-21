import type { Meta, StoryObj } from '@storybook/react-vite'
import { TagIcon } from 'lucide-react'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Badge } from '@/components/ui/badge'
import type { AppError } from '@/api/contracts'
import { editInPlace } from './edit-in-place'
import { EntityView, type EntityViewSection } from './entity-view'
import { MultiPick, type MultiPickOption } from './multi-pick'

// MultiPick, a small set's picker (cell-patterns.md "A small set"), in
// both places it goes. InPlace is a record's Labels edited in place: every
// label shown on opening, each click saved on its own after 500ms, and
// "Archived" refused the way a 422 on the field is. Saves counts the
// requests a server would get. OnAForm is the same control changing a
// form's value. e2e/multi-pick.spec.ts drives both, axe in both themes
// included.

// Whole class names, as an app's own slot -> class map has them.
const LABELS: { id: number; name: string; colour: string }[] = [
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

const OPTIONS: MultiPickOption<number>[] = LABELS.map((label) => ({
  id: label.id,
  label: label.name,
  icon: <TagIcon className={`size-3.5 ${label.colour}`} />,
}))

const nameOf = (id: number) => LABELS.find((label) => label.id === id)?.name ?? String(id)

function LabelBadges({ ids }: { ids: readonly number[] }) {
  if (ids.length === 0) return <span className="text-muted-foreground">No labels</span>
  return (
    <span className="flex flex-wrap gap-1" data-testid="saved-labels">
      {LABELS.filter((label) => ids.includes(label.id)).map((label) => (
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

function InPlaceRecord() {
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
        options={OPTIONS}
        value={labels}
        onPick={savePick}
        aria-label={props.label}
        aria-describedby={props.describedBy}
      />
    ),
  })
  const sections: EntityViewSection[] = [
    {
      title: 'Details',
      fields: [
        { label: 'Labels', value: <LabelBadges ids={labels} />, edit },
        { label: 'Saves', value: <span data-testid="saves">{saves}</span> },
        { label: 'Saved', value: <span data-testid="saved">{labels.map(nameOf).join(', ') || 'none'}</span> },
      ],
    },
  ]
  return <EntityView isLoading={false} back={{ to: '/projects', label: 'Projects' }} title="Office move" sections={sections} />
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
  const [labels, setLabels] = useState<number[]>([2])
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <MultiPick options={OPTIONS} value={labels} onValueChange={setLabels} aria-label="Labels" />
      <p className="type-caption text-muted-foreground" data-testid="form-value">
        Value: {labels.map(nameOf).join(', ') || 'none'}
      </p>
    </div>
  )
}

export const OnAForm: StoryObj = { render: () => <Form /> }
