import type { Meta, StoryObj } from '@storybook/react-vite'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

// Both states on screen at once, each with a visible label, for the same
// reason as the Switch story: checked and unchecked paint different tokens
// (border-input vs bg-primary), and a checkbox with no label is an axe
// violation.
interface CheckboxStoryArgs {
  disabled: boolean
}

const meta: Meta<CheckboxStoryArgs> = {
  title: 'ui/Checkbox',
  argTypes: { disabled: { control: 'boolean' } },
  args: { disabled: false },
  render: (args) => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Checkbox id="checkbox-on" defaultChecked disabled={args.disabled} />
        <Label htmlFor="checkbox-on">Charge the battery</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="checkbox-off" disabled={args.disabled} />
        <Label htmlFor="checkbox-off">Pair the receiver</Label>
      </div>
    </div>
  ),
}

export default meta
type Story = StoryObj<CheckboxStoryArgs>

export const Default: Story = {}
