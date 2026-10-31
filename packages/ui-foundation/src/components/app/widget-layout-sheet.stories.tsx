import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router'
import { useWidgetLayout } from '@/hooks/use-widget-layout'
import { WidgetCard, WidgetCardGroup, WidgetList, WidgetListItem } from './widget-card'
import { WidgetLayoutSheet } from './widget-layout-sheet'

// A hub's Customize sheet (#263): the page renders its cards by
// useWidgetLayout's `visible`, and the sheet orders them and hides some,
// kept on this device. Default is the hub with its Customize button (the
// cards an accordion on a phone, side by side on a desktop); Open is the
// sheet as opened, for axe and the token check in both themes
// (e2e/storybook-visual.spec.ts). e2e/widget-layout-sheet.spec.ts drives
// it from the keyboard.
const meta: Meta = {
  title: 'app/WidgetLayoutSheet',
  parameters: { controls: { disable: true } },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
}

export default meta

const CARDS: Record<string, { title: string; rows: string[] }> = {
  ready: { title: 'Ready to start', rows: ['Repaint the shed', 'Read chapter 4', 'Fix the gate latch'] },
  waiting: { title: 'Waiting on', rows: ['Parts arrive', 'Weather clears'] },
  links: { title: 'Saved links', rows: ['Gate latch fitting guide', 'Reading list'] },
  garden: { title: 'Garden', rows: ['Water the beds', 'Turn the compost'] },
}

const IDS = Object.keys(CARDS)
const TITLES = Object.fromEntries(IDS.map((id) => [id, CARDS[id].title]))

function Hub({ open }: { open?: boolean }) {
  const layout = useWidgetLayout('ui-foundation:stories:hub', IDS)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="type-page-title text-foreground">Home</h1>
        <WidgetLayoutSheet layout={layout} titles={TITLES} defaultOpen={open} />
      </div>
      <WidgetCardGroup
        accordion="mobile"
        defaultOpen="ready"
        className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,--spacing(72)),1fr))] gap-4"
      >
        {layout.visible.map((id) => (
          <WidgetCard
            key={id}
            id={id}
            title={CARDS[id].title}
            isLoading={false}
            isEmpty={false}
            emptyMessage="Nothing here"
            summary={String(CARDS[id].rows.length)}
          >
            <WidgetList>
              {CARDS[id].rows.map((row) => (
                <WidgetListItem key={row}>{row}</WidgetListItem>
              ))}
            </WidgetList>
          </WidgetCard>
        ))}
      </WidgetCardGroup>
    </div>
  )
}

export const Default: StoryObj = {
  render: () => <Hub />,
}

export const Open: StoryObj = {
  render: () => <Hub open />,
}
