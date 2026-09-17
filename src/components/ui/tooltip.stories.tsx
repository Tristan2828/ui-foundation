import type { Meta, StoryObj } from '@storybook/react-vite'
import { InfoIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const meta: Meta<typeof Tooltip> = {
  title: 'ui/Tooltip',
}

export default meta
type Story = StoryObj<typeof Tooltip>

export const AllVariants: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger render={<Button variant="outline" size="icon-sm" aria-label="Info" />}>
        <InfoIcon />
      </TooltipTrigger>
      <TooltipContent>Helpful info</TooltipContent>
    </Tooltip>
  ),
}
