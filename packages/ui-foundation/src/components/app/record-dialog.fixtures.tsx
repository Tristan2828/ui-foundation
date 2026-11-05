import type { Meta, StoryObj } from '@/fixtures/types'
import { useEffect, useState } from 'react'
import { createMemoryRouter, Link, Outlet, RouterProvider, useLocation, useParams, useSearchParams, type InitialEntry } from 'react-router'
import type { LegacyColumnDef } from '@tanstack/react-table/legacy'
import type { AppError } from '@/api/contracts'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { DataTable } from './data-table'
import { editInPlace } from './edit-in-place'
import { EntityView } from './entity-view'
import { Markdown } from './markdown'
import { RecordDialogRoute, RecordLink } from './record-dialog'
import { recordDialogState, useOpenRecord } from './record-dialog-context'

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
// e2e/record-dialog.spec.ts drives it; axe in both themes is
// fixtures-visual.spec.ts's COMPOSITE_STORIES.

type Project = { id: number; name: string; status: 'Planned' | 'Active' | 'Done'; notes: string }

const PROJECTS: Project[] = [
  { id: 1, name: 'Repaint the fence', status: 'Active', notes: 'Two coats, the second **after a dry day**.' },
  { id: 2, name: 'Fix the gate latch', status: 'Planned', notes: 'Measure twice, cut once.' },
  { id: 3, name: 'Clear the gutters', status: 'Done', notes: '' },
  { id: 4, name: 'Plant the hedge', status: 'Planned', notes: 'Ten plants, a foot apart.' },
]

const NOT_FOUND: AppError = { kind: 'notfound', message: "This project doesn't exist, or isn't yours." }
const BROKEN: AppError = { kind: 'server', message: 'The server had a problem. Try again in a moment.' }

const COLUMNS: LegacyColumnDef<Project, unknown>[] = [
  { id: 'name', accessorKey: 'name', header: 'Name', enableSorting: false },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    enableSorting: false,
    cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge>,
  },
]

const noop = () => {}

function ProjectList() {
  const [params, setParams] = useSearchParams()
  const openRecord = useOpenRecord()
  const q = params.get('q') ?? ''
  const rows = PROJECTS.filter((project) => project.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="flex flex-col gap-6">
      <h1 className="type-page-title">Projects</h1>
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
        onRowClick={(row) => openRecord(`/projects/${row.id}`)}
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

function ProjectView() {
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
      back={{ to: '/projects', label: 'Projects' }}
      sections={[
        {
          title: 'Details',
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
      ]}
    />
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

function Projects({ initialEntries, initialIndex }: { initialEntries: InitialEntry[]; initialIndex?: number }) {
  const [router] = useState(() =>
    createMemoryRouter(
      [
        {
          path: '/',
          element: <Layout />,
          children: [
            { index: true, element: <Home /> },
            {
              path: 'projects',
              element: <RecordDialogRoute list={<ProjectList />} label="Project" />,
              children: [{ path: ':id', element: <ProjectView /> }],
            },
          ],
        },
      ],
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
const openOver = (id: string, search = ''): InitialEntry[] => {
  const list = { pathname: '/projects', search, hash: '' }
  return [list, { pathname: `/projects/${id}`, state: recordDialogState({ ...list, state: null }) }]
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
