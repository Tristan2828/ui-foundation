import type { Meta, StoryObj } from '@storybook/react-vite'
import { Spinner } from '@/components/ui/spinner'

const meta: Meta<typeof Spinner> = {
  title: 'ui/Spinner',
}

export default meta
type Story = StoryObj<typeof Spinner>

export const AllVariants: Story = {
  render: () => <Spinner />,
}
