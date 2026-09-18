import type { Meta, StoryObj } from '@storybook/react-vite'
import { InfoIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

// Empty is a compound component with no cva variant prop of its own — its
// Controls surface the slotted text content instead of a discrete variant.
interface EmptyStoryArgs {
  title: string
  description: string
  actionLabel: string
}

const meta: Meta<EmptyStoryArgs> = {
  title: 'ui/Empty',
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    actionLabel: { control: 'text' },
  },
  args: {
    title: 'No items yet',
    description: 'Create one to get started.',
    actionLabel: 'Create item',
  },
  render: (args) => (
    <Empty className="w-full border border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InfoIcon />
        </EmptyMedia>
        <EmptyTitle>{args.title}</EmptyTitle>
        <EmptyDescription>{args.description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm">{args.actionLabel}</Button>
      </EmptyContent>
    </Empty>
  ),
}

export default meta
type Story = StoryObj<EmptyStoryArgs>

export const Default: Story = {}
