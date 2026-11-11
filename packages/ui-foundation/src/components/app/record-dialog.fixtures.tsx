import type { Meta, StoryObj } from '@/fixtures/types'
import { useEffect, useState } from 'react'
import { createMemoryRouter, Link, Outlet, RouterProvider, useLocation, useParams, useSearchParams, type InitialEntry } from 'react-router'
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import type { AppError } from '@/api/contracts'
import { Badge } from '@/components/ui/badge'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { DataTable } from './data-table'
import { editInPlace } from './edit-in-place'
import { EntityView } from './entity-view'
import { FormDialog } from './form-dialog'
import { Markdown } from './markdown'
import { RecordDialogRoute, RecordLink } from './record-dialog'
import { recordDialogState, useNewRecordDialog } from './record-dialog-context'

// A list whose records open in a dialog over it (RecordDialogRoute), in a
// memory router: /projects is the list (a search kept in `?q=`, a table
// whose row click opens the record, and a few RecordLinks as a board's
// cards would be), /projects/:id the record (EntityView), and / a page
// with a RecordLink to a project, which opens the full page (not its list).
// The address shows above everything, for the specs. Project 99 doesn't
// exist (not found), "broken" fails (error, with Retry), "slow" never
// loads. Owner is edited in place (its Esc is the field's, not the
// dialog's). Open, Loading and Not found start with a record open over the
// list, the list's entry before it, so Back closes it.
// The Dialog only stories are the same list with `fullPage={false}` (no
// page behind the dialog: a deep link opens it over the list), and Rows
// open their page has `opens` kind `page`. The name cell is a plain link
// to the record: `opens` makes a click on it open the record as the row
// does.
// The List at its own path stories have the list at /projects/list and the
// record at /projects/:id, siblings under one RecordDialogRoute with
// `listPath="list"`. The Sub-records stories are a project's page with its
// tasks, each opening at /projects/:id/tasks/:taskId in the dialog over the
// project's page (`fullPage={false}`: a reload is the dialog again).
// The New record stories (4.82) have a `new` child route (`newPath`): New
// project opens a FormDialog over the list, a deep link to /projects/new
// too, and Add opens the new project over the list. A name of "fail" is
// refused. The Rail stories' records use EntityView's `rail` layout, its
// rail beside the main column at the dialog's 1,120px.
// e2e/record-dialog.spec.ts drives it; axe in both themes is
// fixtures-visual.spec.ts's COMPOSITE_STORIES.

type Project = { id: number; name: string; status: 'Planned' | 'Active' | 'Done'; notes: string }

// Mutable: a project added in the New record stories joins the list.

const PROJECTS: Project[] = [
  { id: 1, name: 'Repaint the fence', status: 'Active', notes: 'Two coats, the second **after a dry day**.' },
  { id: 2, name: 'Fix the gate latch', status: 'Planned', notes: 'Measure twice, cut once.' },
  { id: 3, name: 'Clear the gutters', status: 'Done', notes: '' },
  { id: 4, name: 'Plant the hedge', status: 'Planned', notes: 'Ten plants, a foot apart.' },
]

const NOT_FOUND: AppError = { kind: 'notfound', message: "This project doesn't exist, or isn't yours." }
const BROKEN: AppError = { kind: 'server', message: 'The server had a problem. Try again in a moment.' }

type Opens = 'dialog' | 'dialog-only' | 'page'

const COLUMNS: LegacyColumnDef<Project, unknown>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
    enableSorting: false,
    cell: ({ row }) => (
      <Link to={`/projects/${row.original.id}`} className="type-label underline">
        {row.original.name}
      </Link>
    ),
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    enableSorting: false,
    cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge>,
  },
]

const noop = () => {}

function ProjectList({ opens, listAt = '/projects', canCreate = false }: { opens: Opens; listAt?: string; canCreate?: boolean }) {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const rows = PROJECTS.filter((project) => project.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="flex flex-col gap-6">
      <h1 className="type-page-title">Projects</h1>
      <p className="type-caption text-muted-foreground">
        The list is at <span data-testid="list-at">{listAt}</span>
      </p>
      <DataTable<Project>
        columns={COLUMNS}
        data={rows}
        total={rows.length}
        page={1}
        pageSize={25}
        onPageChange={noop}
        sorting={[]}
        onSortingChange={noop}
        isLoading={false}
        emptyTitle="No projects match"
        getRowId={(row) => String(row.id)}
        opens={{ kind: opens, to: (row) => `/projects/${row.id}` }}
        toolbar={
          <Input
            className="w-64"
            placeholder="Search projects"
            aria-label="Search projects"
            value={q}
            onChange={(event) => setParams(event.target.value ? { q: event.target.value } : {}, { replace: true })}
          />
        }
      />
      <nav aria-label="Other projects" className="flex flex-wrap gap-2">
        {canCreate && (
          <RecordLink to="/projects/new" className="type-label underline">
            New project
          </RecordLink>
        )}
        <RecordLink to="/projects/99" className="type-label underline">
          A deleted project
        </RecordLink>
        <RecordLink to="/projects/broken" className="type-label underline">
          A project that fails
        </RecordLink>
        <RecordLink to="/projects/slow" className="type-label underline">
          A project still loading
        </RecordLink>
      </nav>
    </div>
  )
}

// What a gateway hook would give: loading for a moment, then the record,
// not found, or an error.
function useProject(id: string | undefined) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; project?: Project; error?: AppError } | null>(null)
  const key = `${id}:${attempt}`
  useEffect(() => {
    if (id === 'slow') return
    const timer = setTimeout(() => {
      if (id === 'broken') setResult({ key, error: BROKEN })
      else {
        const project = PROJECTS.find((candidate) => String(candidate.id) === id)
        setResult(project ? { key, project } : { key, error: NOT_FOUND })
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [id, key])
  const current = result?.key === key ? result : null
  return {
    project: current?.project,
    error: current?.error ?? null,
    isLoading: current === null,
    retry: () => setAttempt((count) => count + 1),
  }
}

function ProjectView({ listAt = '/projects', tasks = false, rail = false }: { listAt?: string; tasks?: boolean; rail?: boolean }) {
  const { id } = useParams()
  const { project, error, isLoading, retry } = useProject(id)
  const [owner, setOwner] = useState('Ada Lovelace')
  const owners = editInPlace<string>({
    kind: 'text',
    value: owner,
    save: async (next) => setOwner(next),
    control: (props) => (
      <Input
        id={props.id}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        readOnly={props.disabled}
        aria-invalid={props.invalid || undefined}
        aria-label={props.label}
        aria-describedby={props.describedBy}
      />
    ),
  })
  const next = PROJECTS.find((candidate) => candidate.id === (project?.id ?? 0) + 1)
  return (
    <EntityView
      title={project?.name}
      badges={project && <Badge variant="secondary">{project.status}</Badge>}
      isLoading={isLoading}
      error={error}
      onRetry={retry}
      back={{ to: listAt, label: 'Projects' }}
      layout={rail ? 'rail' : undefined}
      sections={[
        {
          title: 'Details',
          placement: rail ? 'rail' : undefined,
          fields: [
            { label: 'Status', value: project?.status },
            { label: 'Owner', value: owner, edit: owners },
            {
              label: 'Next project',
              value: next && <RecordLink to={`/projects/${next.id}`}>{next.name}</RecordLink>,
            },
          ],
        },
        { title: 'Notes', content: project?.notes && <Markdown>{project.notes}</Markdown>, emptyLabel: 'No notes' },
        ...(tasks && project ? [{ title: 'Tasks', content: <TaskList projectId={project.id} /> }] : []),
      ]}
    />
  )
}

// A project's sub-records, its tasks: each opens over the project's page.
type Task = { id: number; projectId: number; name: string; done: boolean }

const TASKS: Task[] = [
  { id: 11, projectId: 1, name: 'Sand the boards', done: true },
  { id: 12, projectId: 1, name: 'Buy the paint', done: false },
  { id: 21, projectId: 2, name: 'Order a new latch', done: false },
]

const TASK_COLUMNS: LegacyColumnDef<Task, unknown>[] = [
  { id: 'name', accessorKey: 'name', header: 'Task', enableSorting: false },
  {
    id: 'done',
    accessorKey: 'done',
    header: 'Done',
    enableSorting: false,
    cell: ({ row }) => (row.original.done ? 'Yes' : 'No'),
  },
]

function TaskList({ projectId }: { projectId: number }) {
  const rows = TASKS.filter((task) => task.projectId === projectId)
  return (
    <DataTable<Task>
      columns={TASK_COLUMNS}
      data={rows}
      total={rows.length}
      page={1}
      pageSize={25}
      onPageChange={noop}
      sorting={[]}
      onSortingChange={noop}
      isLoading={false}
      emptyTitle="No tasks yet"
      getRowId={(row) => String(row.id)}
      opens={{ kind: 'dialog-only', to: (row) => `/projects/${row.projectId}/tasks/${row.id}` }}
    />
  )
}

function TaskView() {
  const { id, taskId } = useParams()
  const task = TASKS.find((candidate) => String(candidate.id) === taskId && String(candidate.projectId) === id)
  return (
    <EntityView
      title={task?.name}
      isLoading={false}
      error={task ? null : NOT_FOUND}
      back={{ to: `/projects/${id}`, label: 'Project' }}
      sections={[{ title: 'Details', fields: [{ label: 'Done', value: task && (task.done ? 'Yes' : 'No') }] }]}
    />
  )
}

// The `new` route's form: a FormDialog with no `open`, opened by the route.
function NewProject() {
  const route = useNewRecordDialog()
  const [name, setName] = useState('')
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState<AppError | null>(null)
  const [saving, setSaving] = useState(false)
  return (
    <FormDialog
      title="New project"
      submitLabel="Add project"
      isSubmitting={saving}
      submitError={error}
      dirty={name !== ''}
      onSubmit={(event) => {
        event.preventDefault()
        if (!name.trim()) {
          setMissing(true)
          return
        }
        setSaving(true)
        setError(null)
        setTimeout(() => {
          setSaving(false)
          if (name.trim() === 'fail') {
            setError(BROKEN)
            return
          }
          const project: Project = { id: PROJECTS.length + 1, name: name.trim(), status: 'Planned', notes: '' }
          PROJECTS.push(project)
          route?.openRecord(`/projects/${project.id}`)
        }, 150)
      }}
    >
      <Field data-invalid={missing || undefined}>
        <FieldLabel htmlFor="new-project-name">Name</FieldLabel>
        <Input
          id="new-project-name"
          value={name}
          aria-invalid={missing || undefined}
          onChange={(event) => {
            setName(event.target.value)
            setMissing(false)
          }}
        />
        {missing && <FieldError>Give it a name</FieldError>}
      </Field>
    </FormDialog>
  )
}

function Home() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="type-page-title">Home</h1>
      <RecordLink to="/projects/1" className="type-label underline">
        Repaint the fence
      </RecordLink>
      <Link to="/projects" className="type-label underline">
        All projects
      </Link>
    </div>
  )
}

function Layout() {
  const location = useLocation()
  return (
    <div className="flex flex-col gap-4">
      <p className="type-caption text-muted-foreground">
        Address: <output data-testid="address">{`${location.pathname}${location.search}`}</output>
      </p>
      <Outlet />
    </div>
  )
}

// How the routes are laid out: the record a child of its list (`nested`,
// the default), the list a sibling at /projects/list (`sibling`), or a
// project's page whose tasks open over it (`sub-records`).
type Shape = 'nested' | 'sibling' | 'sub-records' | 'new'

function projectRoutes(shape: Shape, opens: Opens, rail: boolean) {
  if (shape === 'new')
    return [
      {
        path: 'projects',
        element: <RecordDialogRoute list={<ProjectList opens={opens} canCreate />} label="Project" newPath="new" />,
        children: [
          { path: 'new', element: <NewProject /> },
          { path: ':id', element: <ProjectView rail={rail} /> },
        ],
      },
    ]
  if (shape === 'sub-records')
    return [
      {
        path: 'projects/:id',
        element: <RecordDialogRoute list={<ProjectView tasks />} label="Task" fullPage={false} />,
        children: [{ path: 'tasks/:taskId', element: <TaskView /> }],
      },
    ]
  if (shape === 'sibling')
    return [
      {
        path: 'projects',
        element: (
          <RecordDialogRoute
            list={<ProjectList opens={opens} listAt="/projects/list" />}
            listPath="list"
            label="Project"
            fullPage={opens !== 'dialog-only'}
          />
        ),
        children: [{ path: 'list' }, { path: ':id', element: <ProjectView listAt="/projects/list" /> }],
      },
    ]
  return [
    {
      path: 'projects',
      element: <RecordDialogRoute list={<ProjectList opens={opens} />} label="Project" fullPage={opens !== 'dialog-only'} />,
      children: [{ path: ':id', element: <ProjectView rail={rail} /> }],
    },
  ]
}

function Projects({
  initialEntries,
  initialIndex,
  opens = 'dialog',
  shape = 'nested',
  rail = false,
}: {
  initialEntries: InitialEntry[]
  initialIndex?: number
  opens?: Opens
  shape?: Shape
  rail?: boolean
}) {
  const [router] = useState(() =>
    createMemoryRouter(
      [{ path: '/', element: <Layout />, children: [{ index: true, element: <Home /> }, ...projectRoutes(shape, opens, rail)] }],
      { initialEntries, initialIndex },
    ),
  )
  // The browser's Back, for the specs (a memory router has no history of the window's).
  useEffect(() => {
    ;(window as unknown as { recordDialogBack: () => void }).recordDialogBack = () => void router.navigate(-1)
  }, [router])
  return <RouterProvider router={router} />
}

// The list's entry, then the record opened over it.
const openOver = (id: string, search = '', listAt = '/projects', record = `/projects/${id}`): InitialEntry[] => {
  const list = { pathname: listAt, search, hash: '' }
  return [list, { pathname: record, state: recordDialogState({ ...list, state: null }) }]
}

const meta: Meta<typeof Projects> = {
  title: 'App/RecordDialog',
  component: Projects,
}
export default meta

type Story = StoryObj<typeof Projects>

export const Default: Story = {
  render: () => <Projects initialEntries={['/projects']} />,
}

export const Open: Story = {
  render: () => <Projects initialEntries={openOver('1', '?q=re')} initialIndex={1} />,
}

export const Loading: Story = {
  render: () => <Projects initialEntries={openOver('slow')} initialIndex={1} />,
}

export const NotFound: Story = {
  name: 'Not found',
  render: () => <Projects initialEntries={openOver('99')} initialIndex={1} />,
}

export const FullPage: Story = {
  name: 'Full page (a deep link)',
  render: () => <Projects initialEntries={['/projects/1']} />,
}

export const FromAnotherPage: Story = {
  name: 'Opened from another page',
  render: () => <Projects initialEntries={['/']} />,
}

export const DialogOnly: Story = {
  name: 'Dialog only',
  render: () => <Projects initialEntries={['/projects']} opens="dialog-only" />,
}

export const DialogOnlyDeepLink: Story = {
  name: 'Dialog only, a deep link',
  render: () => <Projects initialEntries={['/projects/1']} opens="dialog-only" />,
}

export const DialogOnlyFromAnotherPage: Story = {
  name: 'Dialog only, opened from another page',
  render: () => <Projects initialEntries={['/']} opens="dialog-only" />,
}

export const OpensPage: Story = {
  name: 'Rows open their page',
  render: () => <Projects initialEntries={['/projects']} opens="page" />,
}

export const ListAtItsOwnPath: Story = {
  name: 'List at its own path',
  render: () => <Projects initialEntries={['/projects/list']} shape="sibling" />,
}

export const ListAtItsOwnPathOpen: Story = {
  name: 'List at its own path, open',
  render: () => <Projects initialEntries={openOver('1', '?q=re', '/projects/list')} initialIndex={1} shape="sibling" />,
}

export const ListAtItsOwnPathDeepLink: Story = {
  name: 'List at its own path, a deep link',
  render: () => <Projects initialEntries={['/projects/1']} shape="sibling" />,
}

export const SubRecords: Story = {
  name: 'Sub-records',
  render: () => <Projects initialEntries={['/projects/1']} shape="sub-records" />,
}

export const SubRecordOpen: Story = {
  name: 'Sub-record, open',
  render: () => (
    <Projects initialEntries={openOver('1', '', '/projects/1', '/projects/1/tasks/12')} initialIndex={1} shape="sub-records" />
  ),
}

export const SubRecordDeepLink: Story = {
  name: 'Sub-record, a deep link',
  render: () => <Projects initialEntries={['/projects/1/tasks/12']} shape="sub-records" />,
}

export const NewRecord: Story = {
  name: 'New record',
  render: () => <Projects initialEntries={['/projects']} shape="new" />,
}

export const NewRecordOpen: Story = {
  name: 'New record, open',
  render: () => <Projects initialEntries={openOver('new')} initialIndex={1} shape="new" />,
}

export const NewRecordDeepLink: Story = {
  name: 'New record, a deep link',
  render: () => <Projects initialEntries={['/projects/new']} shape="new" />,
}

export const RailBeside: Story = {
  name: 'Rail beside',
  render: () => <Projects initialEntries={openOver('1')} initialIndex={1} rail />,
}
