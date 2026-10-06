import type { Meta, StoryObj } from '@storybook/react-vite'
import { StageCircle, type StageCircleStage, type StageCircleTone } from './stage-circle'

// Cell pattern 19 on screen: an ordered lifecycle as an app maps it (the
// word beside each circle, toned only where it means something), then
// every stage in every tone, so the glyph contrast check measures each
// pairing in both themes (e2e/storybook-visual.spec.ts).
type Status = 'planned' | 'scheduled' | 'inProgress' | 'inReview' | 'done' | 'cancelled'

// What an app writes in its <entity>-format.ts: one lookup typed by the
// enum, so a new value can't go unmapped.
const STATUS_STAGE: Record<Status, { label: string; stage: StageCircleStage; tone?: StageCircleTone }> = {
  planned: { label: 'Planned', stage: 0 },
  scheduled: { label: 'Scheduled', stage: 1 },
  inProgress: { label: 'In progress', stage: 2, tone: 'info' },
  inReview: { label: 'In review', stage: 3 },
  done: { label: 'Done', stage: 'complete', tone: 'success' },
  cancelled: { label: 'Cancelled', stage: 'exit' },
}

const STAGES: StageCircleStage[] = [0, 1, 2, 3, 'complete', 'exit']
const TONES: StageCircleTone[] = ['muted', 'info', 'success', 'warning', 'destructive']

const meta: Meta = {
  title: 'app/StageCircle',
  parameters: { controls: { disable: true } },
}

export default meta

export const Default: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-6">
      <ul aria-label="A lifecycle" className="flex flex-col gap-2">
        {Object.entries(STATUS_STAGE).map(([status, { label, stage, tone }]) => (
          <li key={status} className="inline-flex items-center gap-1.5">
            <StageCircle stage={stage} tone={tone} />
            {label}
          </li>
        ))}
      </ul>
      <table aria-label="Every stage in every tone" className="type-body">
        <thead>
          <tr>
            <th className="pr-4 text-left type-label">Tone</th>
            {STAGES.map((stage) => (
              <th key={stage} className="px-2 type-label">
                {stage}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TONES.map((tone) => (
            <tr key={tone}>
              <th scope="row" className="pr-4 text-left font-normal">
                {tone}
              </th>
              {STAGES.map((stage) => (
                <td key={stage} className="px-2 py-1">
                  <StageCircle stage={stage} tone={tone} className="mx-auto" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
}
