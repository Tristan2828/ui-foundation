import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

// SheetContent's own `side` prop plus the slotted title/description text are
// the meaningful Controls here; Sheet/SheetTrigger have nothing to expose.
interface SheetStoryArgs {
  side: 'top' | 'right' | 'bottom' | 'left'
  title: string
  description: string
}

const meta: Meta<SheetStoryArgs> = {
  title: 'ui/Sheet',
  argTypes: {
    side: {
      control: 'select',
      options: ['top', 'right', 'bottom', 'left'],
    },
    title: { control: 'text' },
    description: { control: 'text' },
  },
  args: {
    side: 'right',
    title: 'Sheet title',
    description: 'Sheet description text.',
  },
  render: (args) => (
    <Sheet>
      <SheetTrigger render={<Button variant="outline">Open sheet</Button>} />
      <SheetContent side={args.side}>
        <SheetHeader>
          <SheetTitle>{args.title}</SheetTitle>
          <SheetDescription>{args.description}</SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <Button>Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
}

export default meta
type Story = StoryObj<SheetStoryArgs>

export const Default: Story = {}
