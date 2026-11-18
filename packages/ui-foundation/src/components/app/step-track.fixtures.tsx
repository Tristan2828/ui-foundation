import type { ReactNode } from 'react'
import type { Meta, StoryObj } from '@/fixtures/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EqualItems, type EqualItem } from './equal-items'
import { StepTrack, type StepTrackStep } from './step-track'

// StepTrack (4.128), all made up: the stepper look's steps read only, as
// a list card shows a program's phases with a caption under the current
// one. Then the edges: no caption, a step that needs a look, long titles,
// seven steps (the row scrolls sideways on a phone), none, and the
// stepper beside it with the same items, so the marks can be compared.
// Axe, the token-colour check and the glyph check measure every one in
// both themes and each palette (e2e/fixtures-visual.spec.ts);
// e2e/step-track.spec.ts reads the list's names and measures it at a
// laptop's and a phone's width.
const meta: Meta = {
  title: 'app/StepTrack',
  parameters: { controls: { disable: true } },
}

export default meta

const PHASES: StepTrackStep[] = [
  { id: 'foundation', title: 'Foundation', step: 'done' },
  { id: 'build', title: 'Build', step: 'done' },
  { id: 'peak', title: 'Peak', step: 'current' },
  { id: 'taper', title: 'Taper' },
]

const SEVEN: StepTrackStep[] = Array.from({ length: 7 }, (_, i) => ({
  id: `w${i + 1}`,
  title: `Week ${i + 1}`,
  step: i < 5 ? ('done' as const) : i === 5 ? ('current' as const) : undefined,
}))

const LONG: StepTrackStep[] = [
  { id: 'l1', title: 'Getting used to running three times a week', step: 'done' },
  { id: 'l2', title: 'Building up the long run with one longer day at the end of each week', step: 'current' },
  { id: 'l3', title: 'Tapering' },
]

// A list card as an app's list draws one: a title, a badge, the track.
function ListCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="max-w-md">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <h2 className="type-body font-semibold text-foreground">{title}</h2>
        <Badge variant="outline-success">Active</Badge>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export const OnACard: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6">
      <ListCard title="Spring 10K plan">
        <StepTrack label="Spring 10K plan, phases" steps={PHASES} caption="Day 12" />
      </ListCard>
      <ListCard title="Strength block">
        <StepTrack label="Strength block, weeks" steps={SEVEN} caption="Day 38" />
      </ListCard>
    </div>
  ),
}

export const Edges: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6">
      <ListCard title="No caption">
        <StepTrack label="No caption" steps={PHASES} />
      </ListCard>
      <ListCard title="Needs a look">
        <StepTrack
          label="Needs a look"
          steps={PHASES.map((step) => (step.id === 'build' ? { ...step, attention: 'needs an answer' } : step))}
          caption="Day 3"
        />
      </ListCard>
      <ListCard title="Long titles">
        <StepTrack label="Long titles" steps={LONG} caption="Week 9" />
      </ListCard>
      <ListCard title="Nothing current">
        <StepTrack label="Nothing current" steps={PHASES.map((step) => ({ ...step, step: undefined }))} caption="Not started" />
      </ListCard>
      <ListCard title="No steps">
        <StepTrack label="No steps" steps={[]} emptyText="No phases yet" />
      </ListCard>
    </div>
  ),
}

// The same items in the stepper and the track: the marks are one part.
const ITEMS: EqualItem[] = PHASES.map((step) => ({ ...step, fields: [{ label: 'Weeks', value: '1–3' }] }))

export const BesideTheStepper: StoryObj = {
  render: () => (
    <Card className="max-w-3xl">
      <CardContent className="flex flex-col gap-6">
        <StepTrack label="Phases, read only" steps={ITEMS} caption="Day 12" />
        <EqualItems look="stepper" label="Phases, stepper" items={ITEMS} />
      </CardContent>
    </Card>
  ),
}
