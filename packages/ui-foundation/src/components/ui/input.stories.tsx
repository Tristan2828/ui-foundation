import type { Meta, StoryObj } from '@storybook/react-vite'
import { Input } from '@/components/ui/input'

const meta: Meta<typeof Input> = {
  title: 'ui/Input',
  component: Input,
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number'],
    },
    placeholder: {
      control: 'text',
    },
    disabled: {
      control: 'boolean',
    },
  },
  args: {
    type: 'text',
    placeholder: 'Type here',
    disabled: false,
  },
}

export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = {}
