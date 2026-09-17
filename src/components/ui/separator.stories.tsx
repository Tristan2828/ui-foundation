import type { Meta, StoryObj } from '@storybook/react-vite'
import { Separator } from '@/components/ui/separator'

const meta: Meta<typeof Separator> = {
  title: 'ui/Separator',
}

export default meta
type Story = StoryObj<typeof Separator>

export const AllVariants: Story = {
  render: () => (
    <div className="flex w-full flex-col gap-3">
      <Separator />
      <div className="flex h-6 items-center gap-3">
        <span className="text-sm text-muted-foreground">Left</span>
        <Separator orientation="vertical" />
        <span className="text-sm text-muted-foreground">Right</span>
      </div>
    </div>
  ),
}
