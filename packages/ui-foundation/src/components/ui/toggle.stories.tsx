import type { Meta, StoryObj } from '@storybook/react-vite'
import { BoldIcon, FlagIcon } from 'lucide-react'
import { Toggle } from '@/components/ui/toggle'

// A pressed/not-pressed button (aria-pressed). Each pair shows both
// states at once, so axe and the token check see them in both themes.
// The flag inside a table cell (cell pattern 15's variant) has its own
// story under patterns/CellPatterns.
const meta: Meta = {
  title: 'ui/Toggle',
  parameters: { controls: { disable: true } },
}

export default meta

export const Default: StoryObj = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Toggle aria-label="Bold">
        <BoldIcon />
      </Toggle>
      <Toggle aria-label="Bold" defaultPressed>
        <BoldIcon />
      </Toggle>
      <Toggle variant="outline" size="sm">
        Show archived
      </Toggle>
      <Toggle variant="outline" size="sm" defaultPressed>
        Show archived
      </Toggle>
      <Toggle size="icon-sm" aria-label="Flag">
        <FlagIcon />
      </Toggle>
      <Toggle size="icon-xs" aria-label="Flag" defaultPressed>
        <FlagIcon />
      </Toggle>
    </div>
  ),
}
