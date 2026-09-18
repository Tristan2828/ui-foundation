import type { Meta, StoryObj } from '@storybook/react-vite'
import { Skeleton } from '@/components/ui/skeleton'

// Skeleton has no cva variant — its only real dimensions are width/height,
// which the Controls expose as numbers rather than a Tailwind class string.
interface SkeletonStoryArgs {
  width: number
  height: number
  lines: number
}

const meta: Meta<SkeletonStoryArgs> = {
  title: 'ui/Skeleton',
  argTypes: {
    width: { control: { type: 'number', min: 16, max: 320 } },
    height: { control: { type: 'number', min: 4, max: 64 } },
    lines: { control: { type: 'number', min: 1, max: 5 } },
  },
  args: {
    width: 192,
    height: 16,
    lines: 2,
  },
  render: (args) => (
    <div className="flex flex-col gap-2">
      {Array.from({ length: args.lines }, (_, i) => (
        <Skeleton key={i} style={{ width: args.width, height: args.height }} />
      ))}
    </div>
  ),
}

export default meta
type Story = StoryObj<SkeletonStoryArgs>

export const Default: Story = {}
