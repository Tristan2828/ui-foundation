import type { Meta, StoryObj } from '@storybook/react-vite'
import { Link, MemoryRouter, Route, Routes, useSearchParams } from 'react-router'
import { CountLink } from './count-link'

// Cell pattern 20 on screen: a Projects table with each project's open
// Tasks counted, linking to the Tasks list filtered to it. Axe, the token
// check and the specs in e2e/storybook-visual.spec.ts measure it in both
// themes. The story's own router stands in for the app's, so a click goes
// to a stand-in Tasks list that shows the filter it was given.
const meta: Meta = {
  title: 'app/CountLink',
  parameters: { controls: { disable: true } },
}

export default meta

type Project = { id: number; name: string; openTaskCount: number }

const PROJECTS: Project[] = [
  { id: 1, name: 'Kitchen remodel', openTaskCount: 3 },
  { id: 2, name: 'Garden', openTaskCount: 1 },
  { id: 3, name: 'Taxes', openTaskCount: 0 },
  { id: 4, name: 'Move house', openTaskCount: 12 },
]

function ProjectsTable() {
  return (
    <table aria-label="Projects" className="type-body">
      <thead>
        <tr>
          <th className="pr-6 text-left type-label">Name</th>
          <th className="text-left type-label">Open tasks</th>
        </tr>
      </thead>
      <tbody>
        {PROJECTS.map(({ id, name, openTaskCount: count }) => (
          <tr key={id}>
            <td className="py-1 pr-6">{name}</td>
            <td className="py-1">
              <CountLink
                count={count}
                to={`/tasks?project=${id}`}
                label={`open ${count === 1 ? 'task' : 'tasks'} in ${name}`}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TasksList() {
  const [params] = useSearchParams()
  const project = PROJECTS.find(({ id }) => String(id) === params.get('project'))
  return (
    <div className="flex flex-col gap-2">
      <h1 className="type-section-title">Tasks</h1>
      <p>Filtered to {project?.name ?? 'nothing'}.</p>
      <Link to="/" className="underline underline-offset-4">
        Back to projects
      </Link>
    </div>
  )
}

export const Default: StoryObj = {
  render: () => (
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<ProjectsTable />} />
        <Route path="/tasks" element={<TasksList />} />
      </Routes>
    </MemoryRouter>
  ),
}
