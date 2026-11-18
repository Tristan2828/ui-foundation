import type { Meta, StoryObj } from '@/fixtures/types'
import { useRef, useState, type ReactElement } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { AppError } from '@/api/contracts'
import { Badge } from '@/components/ui/badge'
import { inPlace, type InPlaceLinkValue } from './edit-in-place-presets'
import { EntityView, type EntityViewSection } from './entity-view'

// The `inPlace` presets on a record's view: one line per field, each with
// its own control, check and look at rest. A "server" in state saves after
// a short wait and refuses what a real one would (a budget over its cap,
// a model the plan doesn't offer), so the refusals show where they land.
// e2e/edit-in-place-presets.spec.ts edits each one, and runs axe on every
// state in both themes.

type Project = {
  name: string
  code: string | null
  hours: number | null
  budget: string | null
  due: string
  priority: 'low' | 'normal' | 'high' | null
  categoryId: number | null
  model: string
  effort: string
  docsUrl: string | null
  docsLabel: string | null
  siteUrl: string | null
  siteLabel: string | null
  ticketUrl: string | null
  ticketLabel: string | null
}

const CATEGORIES = [
  { id: 1, label: 'Garden' },
  { id: 2, label: 'Kitchen' },
  { id: 3, label: 'Garage' },
  { id: 4, label: 'Hallway' },
  { id: 5, label: 'Workshop' },
]

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
] as const

const PRIORITY_VARIANT = { low: 'secondary', normal: 'outline', high: 'destructive' } as const

const MODELS = [
  { value: 'small', label: 'Small' },
  { value: 'large', label: 'Large' },
  { value: 'legacy', label: 'Legacy' },
]

const EFFORTS = [
  { value: 'low', label: 'Low' },
  { value: 'high', label: 'High' },
  { value: 'max', label: 'Max' },
]

const refusal = (field: string, message: string): AppError => ({
  kind: 'validation',
  message: 'Validation failed',
  fieldErrors: { [field]: [message] },
})

// A record held in state, saved after a short wait like a server would,
// with the server's own rules.
function useProject() {
  const [project, setProject] = useState<Project>({
    name: 'Shed roof',
    code: null,
    hours: 12,
    budget: '1234.56',
    due: '2026-09-02',
    priority: 'normal',
    categoryId: 1,
    model: 'small',
    effort: 'low',
    docsUrl: 'https://docs.example.com/roofing/felt',
    docsLabel: null,
    siteUrl: 'https://example.com/supplies',
    siteLabel: 'Supplier',
    ticketUrl: null,
    ticketLabel: null,
  })
  const latest = useRef(project)
  const save = (change: Partial<Project>) =>
    new Promise<void>((resolve, reject) =>
      setTimeout(() => {
        if (change.budget != null && Number(change.budget) > 10000) return reject(refusal('budget', 'Over the yearly cap of $10,000.00'))
        if (change.model === 'legacy') return reject(refusal('model', 'Legacy is not offered on this plan'))
        latest.current = { ...latest.current, ...change }
        setProject(latest.current)
        resolve()
      }, 100),
    )
  return { project, save }
}

const searchCategories = (text: string) =>
  new Promise<typeof CATEGORIES>((resolve) =>
    setTimeout(() => resolve(CATEGORIES.filter((category) => category.label.toLowerCase().includes(text.toLowerCase()))), 50),
  )

const linkOf = (url: string | null, label: string | null): InPlaceLinkValue => ({ url, label })

function PresetsRecord() {
  const { project, save } = useProject()
  const category = CATEGORIES.find((each) => each.id === project.categoryId)
  const sections: EntityViewSection[] = [
    {
      title: 'Details',
      fields: [
        { label: 'Code', edit: inPlace.text({ value: project.code, maxLength: 8, placeholder: 'ROOF-1', save: (code) => save({ code }) }) },
        { label: 'Hours', edit: inPlace.number({ value: project.hours, min: 0, max: 200, unit: 'h', save: (hours) => save({ hours }) }) },
        { label: 'Budget', edit: inPlace.money({ value: project.budget, save: (budget) => save({ budget }) }) },
        { label: 'Due', edit: inPlace.date({ value: project.due, required: true, save: (due) => save({ due }) }) },
        {
          label: 'Priority',
          edit: inPlace.select({
            value: project.priority,
            options: PRIORITIES,
            render: (priority, label) => <Badge variant={PRIORITY_VARIANT[priority]}>{label}</Badge>,
            save: (priority) => save({ priority }),
          }),
        },
        {
          label: 'Category',
          edit: inPlace.reference({
            value: project.categoryId,
            label: category?.label,
            search: searchCategories,
            placeholder: 'Search categories',
            save: (categoryId) => save({ categoryId }),
          }),
        },
      ],
    },
  ]
  return (
    <EntityView
      isLoading={false}
      back={{ to: '/', label: 'Projects' }}
      title={project.name}
      titleEdit={{ label: 'Name', ...inPlace.text({ value: project.name, required: true, save: (name) => save({ name: name }) }) }}
      sections={sections}
    />
  )
}

function FieldsAsOneRecord() {
  const { project, save } = useProject()
  const sections: EntityViewSection[] = [
    {
      title: 'Assistant',
      fields: [
        {
          label: 'Model and Effort',
          edit: inPlace.fields({
            value: { model: project.model, effort: project.effort },
            fields: {
              model: { kind: 'select', label: 'Model', required: true, options: MODELS },
              effort: { kind: 'select', label: 'Effort', required: true, options: EFFORTS },
            },
            rule: ({ model, effort }) => (effort === 'max' && model !== 'large' ? 'Max effort needs the large model' : null),
            save: ({ model, effort }) => save({ model, effort }),
          }),
        },
        {
          label: 'Hours and Budget',
          edit: inPlace.fields({
            value: { hours: project.hours, budget: project.budget },
            fields: {
              hours: { kind: 'number', label: 'Hours', min: 0 },
              budget: { kind: 'money', label: 'Budget' },
            },
            rule: ({ hours, budget }) => (budget !== null && hours === null ? 'A budget needs its hours' : null),
            save: ({ hours, budget }) => save({ hours, budget }),
          }),
        },
      ],
    },
  ]
  return <EntityView isLoading={false} back={{ to: '/', label: 'Projects' }} title={project.name} sections={sections} />
}

function LinksRecord() {
  const { project, save } = useProject()
  const sections: EntityViewSection[] = [
    {
      title: 'Links',
      fields: [
        {
          label: 'Docs',
          edit: inPlace.link({
            value: linkOf(project.docsUrl, project.docsLabel),
            save: ({ url, label }) => save({ docsUrl: url, docsLabel: label }),
          }),
        },
        {
          label: 'Supplier',
          edit: inPlace.link({
            value: linkOf(project.siteUrl, project.siteLabel),
            save: ({ url, label }) => save({ siteUrl: url, siteLabel: label }),
          }),
        },
        {
          label: 'Ticket',
          emptyLabel: 'No ticket',
          edit: inPlace.link({
            value: linkOf(project.ticketUrl, project.ticketLabel),
            save: ({ url, label }) => save({ ticketUrl: url, ticketLabel: label }),
          }),
        },
      ],
    },
  ]
  return <EntityView isLoading={false} back={{ to: '/', label: 'Projects' }} title={project.name} sections={sections} />
}

function InRouter({ Record }: { Record: () => ReactElement }) {
  const [router] = useState(() => createMemoryRouter([{ path: '/', element: <Record /> }]))
  return <RouterProvider router={router} />
}

const meta: Meta = {
  title: 'app/EditInPlacePresets',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
}

export default meta

export const Presets: StoryObj = { render: () => <InRouter Record={PresetsRecord} /> }

export const FieldsAsOne: StoryObj = { render: () => <InRouter Record={FieldsAsOneRecord} /> }

export const Links: StoryObj = { render: () => <InRouter Record={LinksRecord} /> }
