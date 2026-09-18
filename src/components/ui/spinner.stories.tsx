import type { Meta, StoryObj } from '@storybook/react-vite'
import { Spinner } from '@/components/ui/spinner'

// Spinner has no cva variant — size is a plain className, so the Control
// maps a named size to the class Spinner already accepts via its own prop.
const SIZE_CLASSNAMES = {
  sm: 'size-3',
  default: 'size-4',
  lg: 'size-6',
} as const

interface SpinnerStoryArgs {
  size: keyof typeof SIZE_CLASSNAMES
}

const meta: Meta<SpinnerStoryArgs> = {
  title: 'ui/Spinner',
  argTypes: {
    size: {
      control: 'select',
      options: Object.keys(SIZE_CLASSNAMES),
    },
  },
  args: {
    size: 'default',
  },
  render: (args) => <Spinner className={SIZE_CLASSNAMES[args.size]} />,
}

export default meta
type Story = StoryObj<SpinnerStoryArgs>

export const Default: Story = {}
