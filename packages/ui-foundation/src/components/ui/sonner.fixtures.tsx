import type { Meta, StoryObj } from '@/fixtures/types'
import { useEffect } from 'react'
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
        Show Toast
      </Button>
    </>
  ),
}

export default meta
type Story = StoryObj<ToastStoryArgs>

export const Default: Story = {}

// Every tone at once, held open and spread out (`expand`), so axe and the
// glyph check measure each icon on the popover surface in both themes
// and each palette (e2e/fixtures-visual.spec.ts): a success, a delete with
// Undo, an error that stays until it's closed, an info and a warning.
function AllTonesToasts() {
  useEffect(() => {
    const hold = { duration: Number.POSITIVE_INFINITY }
    toast.success('Added Paper Atlas', { ...hold, id: 'added' })
    toast.success('Deleted Harbor Light', { ...hold, id: 'deleted', action: { label: 'Undo', onClick: () => {} } })
    toast.error('Couldn’t save Harbor Light: the server didn’t answer.', { ...hold, id: 'failed', closeButton: true })
    toast.info('Prices are checked every morning.', { ...hold, id: 'info' })
    toast.warning('Two books are due back this week.', { ...hold, id: 'warning' })
  }, [])
  // All five on screen and none mid-fade, so axe never reads a toast
  // part-way through sonner's entrance or its fade past three.
  return <Toaster expand visibleToasts={5} toastOptions={{ style: { transition: 'none' } }} />
}

export const AllTones: Story = { render: () => <AllTonesToasts /> }
