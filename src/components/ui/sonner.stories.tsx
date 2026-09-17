import type { Meta, StoryObj } from '@storybook/react-vite'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'

const meta: Meta<typeof Toaster> = {
  title: 'ui/Toast',
}

export default meta
type Story = StoryObj<typeof Toaster>

export const AllVariants: Story = {
  render: () => (
    <>
      <Toaster />
      <Button variant="outline" onClick={() => toast.success('Saved successfully')}>
        Show toast
      </Button>
    </>
  ),
}
