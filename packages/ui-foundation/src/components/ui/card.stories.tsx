import type { Meta, StoryObj } from '@storybook/react-vite'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Card is a compound component with no cva variant prop of its own — its
// Controls surface the slotted text content instead of a discrete variant.
interface CardStoryArgs {
  title: string
  description: string
  body: string
}

const meta: Meta<CardStoryArgs> = {
  title: 'ui/Card',
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    body: { control: 'text' },
  },
  args: {
    title: 'Card title',
    description: 'Card description text.',
    body: 'Card body content.',
  },
  render: (args) => (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{args.title}</CardTitle>
        <CardDescription>{args.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{args.body}</p>
      </CardContent>
    </Card>
  ),
}

export default meta
type Story = StoryObj<CardStoryArgs>

export const Default: Story = {}
