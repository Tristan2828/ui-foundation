import type { Meta, StoryObj } from '@storybook/react-vite'
import { Separator } from '@/components/ui/separator'

const meta: Meta<typeof Separator> = {
  title: 'ui/Separator',
  component: Separator,
  argTypes: {
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
    },
  },
  args: {
    orientation: 'horizontal',
  },
  render: (args) =>
    args.orientation === 'vertical' ? (
      <div className="flex h-6 items-center gap-3">
        <span className="text-sm text-muted-foreground">Left</span>
        <Separator {...args} />
        <span className="text-sm text-muted-foreground">Right</span>
      </div>
    ) : (
      <div className="w-full">
        <Separator {...args} />
      </div>
    ),
}

export default meta
type Story = StoryObj<typeof Separator>

export const Default: Story = {}
