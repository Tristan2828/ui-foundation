import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { EntityForm } from './entity-form'
import { ListEditor } from './list-editor'

// ListEditor on the package's form layer (EntityForm, react-hook-form's
// useFieldArray, zod), each form showing the value it would save.
// - Default: every item shows its fields, a sub-records section as the
//   entity playbook builds it (no `summary`, no `onDuplicate`).
// - RowsThatOpen (#222): a long list of rich, repetitive items. Each shows
//   as one line that opens to its fields, one at a time; Duplicate copies
//   an item in right after it. An item the save refuses opens to show why.
// e2e/list-editor.spec.ts drives both.

const checklistSchema = z.object({
  items: z.array(z.object({ text: z.string().min(1, 'Say what to pack.') })).max(20),
})
type Checklist = z.infer<typeof checklistSchema>

function ChecklistForm() {
  const form = useForm<Checklist>({
    resolver: zodResolver(checklistSchema),
    defaultValues: { items: [{ text: 'Spare cables' }, { text: 'Rain jacket' }] },
  })
  const items = useFieldArray({ control: form.control, name: 'items' })
  const [saved, setSaved] = useState<Checklist | null>(null)
  return (
    <div className="flex flex-col gap-3 p-6">
      <EntityForm
        title="Pack for the trip"
        onSubmit={form.handleSubmit(setSaved)}
        isSubmitting={false}
        submitLabel="Save"
        onCancel={() => form.reset()}
      >
        <FieldSet>
          <FieldLegend variant="label">Checklist</FieldLegend>
          <ListEditor
            aria-label="Checklist"
            items={items.fields}
            itemName={(index) => `item ${index + 1}`}
            addLabel="Add item"
            emptyText="No items yet."
            max={20}
            onAdd={() => items.append({ text: '' })}
            onRemove={items.remove}
            onMove={items.move}
            renderItem={(index) => {
              const error = form.formState.errors.items?.[index]?.text
              return (
                <Field data-invalid={!!error || undefined} className="min-w-0 flex-1">
                  <Input
                    aria-label={`Item ${index + 1} text`}
                    aria-invalid={!!error || undefined}
                    {...form.register(`items.${index}.text`)}
                  />
                  <FieldError errors={[error]} />
                </Field>
              )
            }}
          />
        </FieldSet>
      </EntityForm>
      <p className="type-caption text-muted-foreground">
        Saved: <output data-testid="checklist-saved">{saved ? JSON.stringify(saved) : 'nothing yet'}</output>
      </p>
    </div>
  )
}

const MAX_EXERCISES = 10

const count = (message: string) => z.number({ message: 'Enter a number.' }).int('Enter a whole number.').min(1, message)
const exercise = z.object({
  name: z.string().min(1, 'Name the exercise.'),
  sets: count('At least 1 set.'),
  reps: count('At least 1 rep.'),
  weight: z.number({ message: 'Enter a number.' }).min(0, 'No less than 0 kg.'),
  rest: z.number({ message: 'Enter a number.' }).int('Enter a whole number.').min(0, 'No less than 0 s.'),
})
const workoutSchema = z.object({ exercises: z.array(exercise).max(MAX_EXERCISES) })
type Workout = z.infer<typeof workoutSchema>
type Exercise = Workout['exercises'][number]

const blankExercise: Exercise = { name: '', sets: 3, reps: 10, weight: 0, rest: 60 }

// Made-up data: a leg day whose lifts repeat with one number changed.
const legDay: Exercise[] = [
  { name: 'Back squat', sets: 1, reps: 10, weight: 40, rest: 60 },
  { name: 'Back squat', sets: 3, reps: 8, weight: 60, rest: 120 },
  { name: 'Back squat', sets: 2, reps: 6, weight: 70, rest: 150 },
  { name: 'Romanian deadlift', sets: 3, reps: 10, weight: 50, rest: 90 },
  { name: 'Leg press', sets: 4, reps: 12, weight: 100, rest: 90 },
  { name: 'Walking lunge', sets: 3, reps: 12, weight: 16, rest: 60 },
  { name: 'Leg curl', sets: 3, reps: 12, weight: 30, rest: 60 },
  { name: 'Calf raise', sets: 4, reps: 15, weight: 40, rest: 45 },
]

// The line an exercise shows while it's closed: what it is and how much.
function exerciseSummary({ name, sets, reps, weight }: Exercise) {
  const load = Number.isFinite(weight) && weight > 0 ? ` at ${weight} kg` : ''
  return `${name || 'New exercise'} · ${sets} × ${reps}${load}`
}

const numberFields = [
  { key: 'sets', label: 'Sets' },
  { key: 'reps', label: 'Reps' },
  { key: 'weight', label: 'Weight (kg)' },
  { key: 'rest', label: 'Rest (s)' },
] as const

function WorkoutForm() {
  const form = useForm<Workout>({ resolver: zodResolver(workoutSchema), defaultValues: { exercises: legDay } })
  const exercises = useFieldArray({ control: form.control, name: 'exercises' })
  // The summaries follow what's typed, as the fields do.
  const values = useWatch({ control: form.control, name: 'exercises' })
  const [saved, setSaved] = useState<Workout | null>(null)
  const errors = form.formState.errors.exercises
  return (
    <div className="flex flex-col gap-3 p-6">
      <EntityForm
        title="Leg day"
        onSubmit={form.handleSubmit(setSaved)}
        isSubmitting={false}
        submitLabel="Save"
        onCancel={() => form.reset()}
      >
        <FieldSet>
          <FieldLegend variant="label">Exercises</FieldLegend>
          <ListEditor
            aria-label="Exercises"
            items={exercises.fields}
            itemName={(index) => `exercise ${index + 1}`}
            summary={(index) => exerciseSummary(values[index] ?? blankExercise)}
            invalid={(index) => !!errors?.[index]}
            addLabel="Add exercise"
            emptyText="No exercises yet."
            max={MAX_EXERCISES}
            onAdd={() => exercises.append(blankExercise)}
            onDuplicate={(index) => exercises.insert(index + 1, { ...form.getValues(`exercises.${index}`) })}
            onRemove={exercises.remove}
            onMove={exercises.move}
            renderItem={(index) => {
              const itemErrors = errors?.[index]
              const id = `exercise-${index}`
              return (
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field data-invalid={!!itemErrors?.name || undefined} className="col-span-2 sm:col-span-4">
                    <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
                    <Input
                      id={`${id}-name`}
                      aria-label={`Exercise ${index + 1} name`}
                      aria-invalid={!!itemErrors?.name || undefined}
                      {...form.register(`exercises.${index}.name`)}
                    />
                    <FieldError errors={[itemErrors?.name]} />
                  </Field>
                  {numberFields.map(({ key, label }) => (
                    <Field key={key} data-invalid={!!itemErrors?.[key] || undefined}>
                      <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
                      <Input
                        id={`${id}-${key}`}
                        type="number"
                        inputMode="decimal"
                        aria-label={`Exercise ${index + 1} ${label.toLowerCase()}`}
                        aria-invalid={!!itemErrors?.[key] || undefined}
                        {...form.register(`exercises.${index}.${key}`, { valueAsNumber: true })}
                      />
                      <FieldError errors={[itemErrors?.[key]]} />
                    </Field>
                  ))}
                </div>
              )
            }}
          />
          <FieldError errors={[errors?.root ?? errors]} />
        </FieldSet>
      </EntityForm>
      <p className="type-caption text-muted-foreground">
        Saved: <output data-testid="workout-saved">{saved ? JSON.stringify(saved) : 'nothing yet'}</output>
      </p>
    </div>
  )
}

const meta: Meta<typeof ListEditor> = {
  title: 'app/ListEditor',
  component: ListEditor,
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
}

export default meta

export const Default: StoryObj<typeof ListEditor> = { render: () => <ChecklistForm /> }

export const RowsThatOpen: StoryObj<typeof ListEditor> = { render: () => <WorkoutForm /> }
