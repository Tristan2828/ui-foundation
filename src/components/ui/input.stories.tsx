import type { Meta, StoryObj } from '@storybook/react-vite'
import { Input } from '@/components/ui/input'

const meta: Meta<typeof Input> = {
  title: 'ui/Input',
}

export default meta
type Story = StoryObj<typeof Input>

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="story-input-default" className="text-xs text-muted-foreground">
          Default
        </label>
        <Input id="story-input-default" placeholder="Type here" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="story-input-disabled" className="text-xs text-muted-foreground">
          Disabled
        </label>
        <Input id="story-input-disabled" placeholder="Disabled" disabled />
      </div>
    </div>
  ),
}
