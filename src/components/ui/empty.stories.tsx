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

const meta: Meta<typeof Empty> = {
  title: 'ui/Empty',
}

export default meta
type Story = StoryObj<typeof Empty>

export const AllVariants: Story = {
  render: () => (
    <Empty className="w-full border border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InfoIcon />
        </EmptyMedia>
        <EmptyTitle>No items yet</EmptyTitle>
        <EmptyDescription>Create one to get started.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm">Create item</Button>
      </EmptyContent>
    </Empty>
  ),
}
