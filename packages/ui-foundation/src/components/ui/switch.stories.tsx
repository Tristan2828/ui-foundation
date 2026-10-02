import type { Meta, StoryObj } from '@storybook/react-vite'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

// Both states on screen at once, each with a visible label: the token
// check and axe only measure what is painted, and an unchecked track and a
// checked one use different tokens (bg-input vs bg-primary). A switch with
// no label is an axe violation, so the story shows the pairing to copy.
interface SwitchStoryArgs {
  size: 'sm' | 'default'
  disabled: boolean
}

const meta: Meta<SwitchStoryArgs> = {
  title: 'ui/Switch',
  argTypes: {
    size: { control: 'select', options: ['sm', 'default'] },
    disabled: { control: 'boolean' },
  },
  args: { size: 'default', disabled: false },
  render: (args) => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Switch id="switch-on" defaultChecked size={args.size} disabled={args.disabled} />
        <Label htmlFor="switch-on">In stock</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="switch-off" size={args.size} disabled={args.disabled} />
        <Label htmlFor="switch-off">Featured</Label>
      </div>
    </div>
  ),
}

export default meta
type Story = StoryObj<SwitchStoryArgs>

export const Default: Story = {}
