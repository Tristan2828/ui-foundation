import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { AppError } from '@/api/contracts'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { FillInChoice, FillInQueue } from './fill-in-queue'

// Projects with no effort set yet, filled in one at a time
// (app/FillInQueue). Axe and the token check are
// e2e/storybook-visual.spec.ts's; moving through it is
// e2e/fill-in-queue.spec.ts's.
const meta: Meta = {
  title: 'app/FillInQueue',
  parameters: { controls: { disable: true } },
}

export default meta

type Effort = 'small' | 'medium' | 'large'
type Project = { id: number; name: string; area: string; added: string; effort?: Effort; notes?: string; guess?: Effort }

const PROJECTS: Project[] = [
  { id: 1, name: 'Repaint the fence', area: 'Garden', added: 'Added in March', guess: 'medium' },
  { id: 2, name: 'Learn Rust', area: 'Learning', added: 'Added in April' },
  { id: 3, name: 'Fix the gate latch', area: 'Garden', added: 'Added in May', guess: 'small' },
  { id: 4, name: 'Build a bookshelf', area: 'House', added: 'Added in June' },
  { id: 5, name: 'Clear the garage', area: 'House', added: 'Added in July', effort: 'large' },
]

const EFFORTS = [
  { value: 'small' as const, label: 'Small' },
  { value: 'medium' as const, label: 'Medium' },
  { value: 'large' as const, label: 'Large' },
]

const ERROR: AppError = { kind: 'network', message: "Couldn't reach the server." }

type Draft = { effort?: Effort | null; notes?: string }

function EffortQueue({ failOn }: { failOn?: number }) {
  const [projects, setProjects] = useState(PROJECTS)
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const missing = projects.filter((project) => project.effort === undefined)
  const draftOf = (project: Project): Draft => drafts[project.id] ?? {}
  const edit = (project: Project, change: Draft) =>
    setDrafts((all) => ({ ...all, [project.id]: { ...all[project.id], ...change } }))
  return (
    <FillInQueue
      items={missing}
      getKey={(project) => project.id}
      progress={{ done: projects.length - missing.length, total: projects.length }}
      canSave={(project) => Boolean(draftOf(project).effort)}
      onSave={async (project) => {
        await new Promise((resolve) => setTimeout(resolve, 300))
        if (project.id === failOn) throw new Error('The server refused the change: try again.')
        const draft = draftOf(project)
        setProjects((all) =>
          all.map((p) => (p.id === project.id ? { ...p, effort: draft.effort ?? undefined, notes: draft.notes } : p)),
        )
      }}
      renderItem={(project) => {
        const draft = draftOf(project)
        return (
          <>
            <div className="flex flex-col gap-1">
              <h2 className="type-section-title">{project.name}</h2>
              <p className="type-caption text-muted-foreground">
                {project.area} · {project.added}
              </p>
            </div>
            <FillInChoice
              label="Effort"
              choices={EFFORTS}
              value={draft.effort}
              onChange={(effort) => edit(project, { effort })}
              suggestion={project.guess ? { value: project.guess, note: 'from similar projects' } : undefined}
              shortcut
            />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`notes-${project.id}`}>Notes</FieldLabel>
                <Textarea
                  id={`notes-${project.id}`}
                  value={draft.notes ?? ''}
                  onChange={(event) => edit(project, { notes: event.target.value })}
                  placeholder="Anything to remember"
                />
              </Field>
            </FieldGroup>
          </>
        )
      }}
      empty="Every project has an effort"
    />
  )
}

// Save and next waits for an effort: `canSave` asks about the record on screen.
export const Default: StoryObj = { render: () => <EffortQueue /> }

// Saving "Learn Rust" is refused: the record stays, with the reason under the buttons.
export const SaveFails: StoryObj = { render: () => <EffortQueue failOn={2} /> }

const noop = () => {}

export const States: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-2">
        <h3 className="type-section-title">Loading</h3>
        <FillInQueue items={[]} getKey={() => 0} renderItem={() => null} onSave={noop} loading />
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="type-section-title">Empty</h3>
        <FillInQueue
          items={[]}
          getKey={() => 0}
          renderItem={() => null}
          onSave={noop}
          progress={{ done: 5, total: 5 }}
          empty="Every project has an effort"
        />
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="type-section-title">Error</h3>
        <FillInQueue items={[]} getKey={() => 0} renderItem={() => null} onSave={noop} error={ERROR} onRetry={noop} />
      </section>
    </div>
  ),
}
