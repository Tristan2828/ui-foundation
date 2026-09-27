import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from '@/components/ui/badge'

const TONE_ROWS = [
  ['success', 'outline-success', 'tinted-success'],
  ['warning', 'outline-warning', 'tinted-warning'],
  ['destructive', 'outline-destructive', 'tinted-destructive'],
] as const

const meta: Meta<typeof Badge> = {
  title: 'ui/Badge',
  component: Badge,
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'outline',
        'destructive',
        'success',
        'warning',
        'outline-success',
        'outline-warning',
        'outline-destructive',
        'tinted-success',
        'tinted-warning',
        'tinted-destructive',
        'ghost',
        'link',
      ],
    },
    children: {
      control: 'text',
    },
  },
  args: {
    variant: 'default',
    children: 'Badge',
  },
}

export default meta
type Story = StoryObj<typeof Badge>

export const Default: Story = {}

// Every tone in every style, on the page background, so axe's
// color-contrast rule sees all nine at once in both themes — the check
// that keeps these tokens honest (e2e/storybook-visual.spec.ts).
//
// Deliberately has no screenshot baseline: one would have to be generated
// on Linux through CI's artifact upload (docs/ARCHITECTURE.md), and the
// real assertion here is the measured contrast, not the pixels.
export const AllTones: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-col gap-3">
      {TONE_ROWS.map((row) => (
        <div key={row[0]} className="flex items-center gap-2">
          {row.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
        </div>
      ))}
    </div>
  ),
}
