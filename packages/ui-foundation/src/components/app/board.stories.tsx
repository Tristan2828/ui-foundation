import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { AppError } from '@/api/contracts'
import { Board, type BoardColumn } from './board'
import { StageCircle, type StageCircleStage, type StageCircleTone } from './stage-circle'

// A board of projects by stage (app/Board): drag a card to another column,
// or its Move button; Archived has no column, so a card moved there leaves
// the board. Axe and the token check are e2e/storybook-visual.spec.ts's;
// moving is e2e/board.spec.ts's.
const meta: Meta = {
  title: 'app/Board',
  parameters: { controls: { disable: true } },
}

export default meta

type Stage = 'idea' | 'planned' | 'active' | 'finished' | 'archived'
type Project = { id: number; name: string; stage: Stage; note: string }

const PROJECTS: Project[] = [
  { id: 1, name: 'Repaint the fence', stage: 'idea', note: 'Two coats' },
  { id: 2, name: 'Plant a herb bed', stage: 'idea', note: 'Spring' },
  { id: 3, name: 'Fix the gate latch', stage: 'planned', note: 'Parts ordered' },
  { id: 4, name: 'Build a bookshelf', stage: 'active', note: '3 of 5 steps' },
  { id: 5, name: 'Learn to bake bread', stage: 'active', note: 'Sourdough next' },
  { id: 6, name: 'Clear the garage', stage: 'finished', note: 'Done in a weekend' },
]

const STAGES: Record<Exclude<Stage, 'archived'>, { label: string; circle: StageCircleStage; tone?: StageCircleTone }> = {
  idea: { label: 'Idea', circle: 0 },
  planned: { label: 'Planned', circle: 1 },
  active: { label: 'Active', circle: 2, tone: 'info' },
  finished: { label: 'Finished', circle: 'complete', tone: 'success' },
}

const COLUMNS: BoardColumn<Stage>[] = (Object.keys(STAGES) as (keyof typeof STAGES)[]).map((value) => ({
  value,
  name: STAGES[value].label,
  label: (
    <span className="inline-flex items-center gap-1.5">
      <StageCircle stage={STAGES[value].circle} tone={STAGES[value].tone} />
      {STAGES[value].label}
    </span>
  ),
  empty: `No ${STAGES[value].label.toLowerCase()} projects`,
}))

const MOVE_TO = [
  ...COLUMNS.map((column) => ({ value: column.value, label: STAGES[column.value as keyof typeof STAGES].label })),
  { value: 'archived' as const, label: 'Archived' },
]

const ERROR: AppError = { kind: 'network', message: "Couldn't reach the server." }

function ProjectCard({ project }: { project: Project }) {
  return (
    <>
      <a href={`#project-${project.id}`} className="font-medium underline-offset-4 hover:underline">
        {project.name}
      </a>
      <span className="type-caption text-muted-foreground">{project.note}</span>
    </>
  )
}

function ProjectsBoard({
  initial = PROJECTS,
  readOnly = false,
  columnsOnly = false,
}: {
  initial?: Project[]
  readOnly?: boolean
  columnsOnly?: boolean
}) {
  const [projects, setProjects] = useState(initial)
  return (
    <Board
      aria-label="Projects by stage"
      columns={COLUMNS}
      items={projects}
      getId={(project) => project.id}
      getColumn={(project) => project.stage}
      getName={(project) => project.name}
      renderCard={(project) => <ProjectCard project={project} />}
      onMove={
        readOnly
          ? undefined
          : (project, stage) => setProjects((all) => all.map((p) => (p.id === project.id ? { ...p, stage } : p)))
      }
      moveTo={columnsOnly ? undefined : MOVE_TO}
      emptyTitle="No projects yet"
      emptyDescription="A new project starts as an idea."
    />
  )
}

export const Default: StoryObj = { render: () => <ProjectsBoard /> }

// Columns with no cards show their `empty` line: muted text on the column's
// muted fill, which axe checks in both themes.
export const EmptyColumns: StoryObj = { render: () => <ProjectsBoard initial={PROJECTS.slice(0, 2)} /> }

export const ReadOnly: StoryObj = { render: () => <ProjectsBoard readOnly /> }

// No `moveTo`: the Move menu is the columns, by their `name`.
export const ColumnsOnly: StoryObj = { render: () => <ProjectsBoard columnsOnly /> }

export const States: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h3 className="type-section-title">Loading</h3>
        <Board aria-label="Loading" columns={COLUMNS} items={[]} getId={() => 0} getColumn={() => 'idea'} getName={() => ''} renderCard={() => null} isLoading />
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="type-section-title">Empty</h3>
        <ProjectsBoard initial={[]} />
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="type-section-title">Error</h3>
        <Board aria-label="Failed" columns={COLUMNS} items={[]} getId={() => 0} getColumn={() => 'idea'} getName={() => ''} renderCard={() => null} error={ERROR} onRetry={() => {}} />
      </section>
    </div>
  ),
}
