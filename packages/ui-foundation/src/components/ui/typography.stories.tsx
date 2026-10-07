import type { Meta, StoryObj } from '@storybook/react-vite'

// Not a component: the five typography roles (styles/theme.css, the type-*
// utilities in styles/index.css), and the three for headings inside
// written text, each on screen in the colour it's usually paired with, so
// axe checks their contrast in both themes.
const ROLES = [
  { role: 'type-page-title', sample: 'Widgets', colour: 'text-foreground' },
  { role: 'type-section-title', sample: 'Shipping details', colour: 'text-foreground' },
  { role: 'type-body', sample: 'Electric height-adjustable desk, 120x60cm top.', colour: 'text-foreground' },
  { role: 'type-label', sample: 'Available from', colour: 'text-foreground' },
  { role: 'type-caption', sample: 'Showing 1–25 of 132', colour: 'text-muted-foreground' },
  { role: 'type-heading-1', sample: 'Plan', colour: 'text-foreground' },
  { role: 'type-heading-2', sample: 'Steps', colour: 'text-foreground' },
  { role: 'type-heading-3', sample: 'Parts', colour: 'text-foreground' },
] as const

const meta: Meta = {
  title: 'ui/Typography',
  parameters: { controls: { disable: true } },
}

export default meta

export const Default: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-4">
      {ROLES.map(({ role, sample, colour }) => (
        <div key={role} className="flex items-baseline gap-6">
          <code className="w-40 shrink-0 font-mono text-xs text-muted-foreground">{role}</code>
          <span data-role={role} className={`${role} ${colour}`}>
            {sample}
          </span>
        </div>
      ))}
    </div>
  ),
}
