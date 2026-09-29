import type { Meta, StoryObj } from '@storybook/react-vite'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'

// Toaster itself takes no interesting props — the Control that matters is
// which toast() variant the trigger button fires, plus its message.
interface ToastStoryArgs {
  type: 'success' | 'error' | 'info' | 'warning' | 'loading'
  message: string
}

const meta: Meta<ToastStoryArgs> = {
  title: 'ui/Toast',
  argTypes: {
    type: {
      control: 'select',
      options: ['success', 'error', 'info', 'warning', 'loading'],
    },
    message: { control: 'text' },
  },
  args: {
    type: 'success',
    message: 'Saved successfully',
  },
  render: (args) => (
    <>
      <Toaster />
      <Button variant="outline" onClick={() => toast[args.type](args.message)}>
        Show toast
      </Button>
    </>
  ),
}

export default meta
type Story = StoryObj<ToastStoryArgs>

export const Default: Story = {}
