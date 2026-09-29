import type { Meta, StoryObj } from '@storybook/react-vite'
import { InfoIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// TooltipContent's own `side` prop plus its slotted text are the meaningful
// Controls here; Tooltip/TooltipTrigger have nothing to expose. The
// screenshot baseline still captures the closed trigger — nothing here
// forces the tooltip open on render.
interface TooltipStoryArgs {
  side: 'top' | 'right' | 'bottom' | 'left'
  content: string
}

const meta: Meta<TooltipStoryArgs> = {
  title: 'ui/Tooltip',
  argTypes: {
    side: {
      control: 'select',
      options: ['top', 'right', 'bottom', 'left'],
    },
    content: { control: 'text' },
  },
  args: {
    side: 'top',
    content: 'Helpful info',
  },
  render: (args) => (
    <Tooltip>
      <TooltipTrigger render={<Button variant="outline" size="icon-sm" aria-label="Info" />}>
        <InfoIcon />
      </TooltipTrigger>
      <TooltipContent side={args.side}>{args.content}</TooltipContent>
    </Tooltip>
  ),
}

export default meta
type Story = StoryObj<TooltipStoryArgs>

export const Default: Story = {}
