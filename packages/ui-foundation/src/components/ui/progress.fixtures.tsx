import type { Meta, StoryObj } from '@/fixtures/types'
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress'

// A thin (4px) bar with its label and value, and one with no label of its
// own, named by aria-label, at a few points along.
const meta: Meta = {
  title: 'ui/Progress',
  render: () => (
    <div className="flex max-w-sm flex-col gap-6">
      <Progress value={62}>
        <ProgressLabel>Array</ProgressLabel>
        <ProgressValue />
      </Progress>
      <Progress value={5} aria-label="Cache" />
      <Progress value={100} aria-label="Done" />
    </div>
  ),
}

export default meta
type Story = StoryObj

export const Default: Story = {}
