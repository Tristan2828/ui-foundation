import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '@/components/ui/button'

const meta: Meta<typeof Button> = {
  title: 'ui/Button',
  component: Button,
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'xs', 'sm', 'lg'],
    },
    disabled: {
      control: 'boolean',
    },
    children: {
      control: 'text',
    },
  },
  args: {
    variant: 'default',
    size: 'default',
    disabled: false,
    children: 'Button',
  },
}

export default meta
type Story = StoryObj<typeof Button>

export const Default: Story = {}
