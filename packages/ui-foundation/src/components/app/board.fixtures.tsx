import type { Meta, StoryObj } from '@/fixtures/types'
import { useState } from 'react'
import type { AppError } from '@/api/contracts'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenuGroup, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Board, type BoardColumn, type BoardGroup, type BoardPlace } from './board'
import { StageCircle, type StageCircleStage, type StageCircleTone } from './stage-circle'

// A board of projects by stage (app/Board): drag a card to another column,
// or its Move button; Archived has no column, so a card moved there leaves
// the board. Axe and the token check are e2e/fixtures-visual.spec.ts's;
// moving is e2e/board.spec.ts's.
const meta: Meta = {
  title: 'app/Board',
  parameters: { controls: { disable: true } },
}

export default meta

type Stage = 'idea' | 'planned' | 'active' | 'finished' | 'archived'
type Size = 'quick' | 'weekend' | 'big'
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

const COLUMNS: BoardColumn<Stage, Size>[] = (Object.keys(STAGES) as (keyof typeof STAGES)[]).map((value) => ({
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

// Order, groups and the header's slots. Each story keeps its own
// projects in state, so a move shows, and prints the last onMove call in a
// sr-only line (e2e/board.spec.ts reads it).
type Sized = Project & { size: Size }

const MORE: Sized[] = [
  { id: 1, name: 'Repaint the fence', stage: 'idea', note: 'Two coats', size: 'weekend' },
  { id: 2, name: 'Plant a herb bed', stage: 'idea', note: 'Spring', size: 'quick' },
  { id: 7, name: 'Oil the hinges', stage: 'idea', note: 'Five minutes', size: 'quick' },
  { id: 8, name: 'Build a shed', stage: 'idea', note: 'Needs a permit', size: 'big' },
  { id: 9, name: 'Sort the toolbox', stage: 'idea', note: 'One evening', size: 'quick' },
  { id: 3, name: 'Fix the gate latch', stage: 'planned', note: 'Parts ordered', size: 'quick' },
  { id: 4, name: 'Build a bookshelf', stage: 'active', note: '3 of 5 steps', size: 'weekend' },
  { id: 5, name: 'Learn to bake bread', stage: 'active', note: 'Sourdough next', size: 'weekend' },
  { id: 6, name: 'Clear the garage', stage: 'finished', note: 'Done in a weekend', size: 'weekend' },
  { id: 10, name: 'Wash the windows', stage: 'finished', note: 'Inside and out', size: 'quick' },
]

const SIZES: BoardGroup<Size>[] = [
  { value: 'quick', label: 'Quick' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'big', label: 'Big', defaultOpen: false },
]

// What an app does with onMove's place: the card leaves its spot and lands
// before `beforeId` (or after `afterId`, or at the end).
function placeProject(all: Sized[], project: Sized, stage: Stage, place: BoardPlace<Size>): Sized[] {
  const moved = { ...project, stage, size: place.group ?? project.size }
  const rest = all.filter((p) => p.id !== project.id)
  const before = place.beforeId === null ? -1 : rest.findIndex((p) => p.id === place.beforeId)
  const after = place.afterId === null ? -1 : rest.findIndex((p) => p.id === place.afterId)
  const at = before >= 0 ? before : after >= 0 ? after + 1 : rest.length
  return [...rest.slice(0, at), moved, ...rest.slice(at)]
}

const describePlace = (project: Sized, stage: Stage, place: BoardPlace<Size>) =>
  `${project.name} → ${stage}${place.group ? ` (${place.group})` : ''}, before ${place.beforeId ?? 'none'}, after ${place.afterId ?? 'none'}`

function OrderedBoard({
  columns,
  grouped = false,
  slots = false,
}: {
  columns: BoardColumn<Stage, Size>[]
  grouped?: boolean
  slots?: boolean
}) {
  const [projects, setProjects] = useState(MORE)
  const [last, setLast] = useState('No move yet')
  return (
    <div className="flex flex-col gap-2">
      <Board<Sized, Stage, Size>
        aria-label="Projects by stage"
        columns={columns}
        items={projects}
        getId={(project) => project.id}
        getColumn={(project) => project.stage}
        getGroup={grouped ? (project) => project.size : undefined}
        getName={(project) => project.name}
        renderCard={(project) => <ProjectCard project={project} />}
        ordered
        pageSize={grouped ? 2 : 3}
        phone={slots ? 'counts' : undefined}
        onMove={(project, stage, place) => {
          setLast(describePlace(project, stage, place))
          setProjects((all) => placeProject(all, project, stage, place))
        }}
        moveTo={MOVE_TO}
        menu={() => (
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => {}}>Copy Link</DropdownMenuItem>
          </DropdownMenuGroup>
        )}
      />
      <p data-testid="last-move" className="sr-only">
        {last}
      </p>
    </div>
  )
}

const plainColumns = (over: Partial<Record<Stage, Partial<BoardColumn<Stage, Size>>>> = {}): BoardColumn<Stage, Size>[] =>
  COLUMNS.map((column) => ({ ...column, ...over[column.value] }))

// Ordered: drag a card between two others (a line shows where it lands), or
// its ⋯ menu's Move Up, Move Down and Move to Top. Idea shows three, then
// "Show 2 More". Finished is `ordered: false`: no line, no Order items.
export const Ordered: StoryObj = {
  render: () => <OrderedBoard columns={plainColumns({ finished: { ordered: false } })} />,
}

// Grouped: Idea split by size, each a heading with its count that folds
// (Big starts folded; a card dropped on its heading lands at its end), and
// a footer under the groups.
export const Grouped: StoryObj = {
  render: () => (
    <OrderedBoard
      grouped
      columns={plainColumns({
        idea: { groups: SIZES, footer: <a href="#someday" className="underline underline-offset-4">Someday 4</a> },
        finished: { ordered: false },
      })}
    />
  ),
}

// Slots: Idea is the lead column with a +, every column has a caption, one
// a note; below lg a row of counts over short names picks the one column.
export const Slots: StoryObj = {
  render: () => (
    <OrderedBoard
      slots
      columns={plainColumns({
        idea: {
          lead: true,
          description: 'Anything worth doing one day',
          shortName: 'Ideas',
          action: (
            <Button variant="ghost" size="icon" aria-label="Add an idea">
              <PlusIcon aria-hidden="true" />
            </Button>
          ),
        },
        planned: { description: 'Has a date or the parts', shortName: 'Planned' },
        active: { description: 'Under way now', note: '1 waiting on parts', shortName: 'Active' },
        finished: { description: 'Newest first', shortName: 'Done', ordered: false },
      })}
    />
  ),
}
