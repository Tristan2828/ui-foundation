import type { Meta, StoryObj } from '@/fixtures/types'
import { ClockIcon, DownloadIcon, LayoutDashboardIcon } from 'lucide-react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { ListHeader } from './list-header'

// A list's header: a title with its count and New alone; one related link
// out as a button; several folded into ⋯ with the page's extras and Show
// deleted; and Show deleted on, with its notice and Back to the list. Axe
// and the glyph check measure them in both themes
// (e2e/fixtures-visual.spec.ts).
const meta: Meta = {
  title: 'app/ListHeader',
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

function Gallery() {
  const [shown, setShown] = useState(false)
  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <ListHeader title="Reminders" count={12} newAction={{ label: 'New reminder', to: '/reminders/new' }} />
      <ListHeader
        title="Medications"
        count={131}
        links={[{ label: 'Change log', to: '/medications/changes', icon: ClockIcon }]}
        newAction={{ label: 'New medication', onClick: () => {} }}
        deleted={{ shown, onShownChange: setShown, noun: 'medications' }}
      />
      <ListHeader
        title="Tasks"
        count={91}
        links={[
          { label: 'Board', to: '/tasks/board', icon: LayoutDashboardIcon },
          { label: 'Spin', to: '/tasks/spin' },
          { label: 'Fill in 54', to: '/tasks/fill-in' },
        ]}
        more={[{ label: 'Export', icon: DownloadIcon, onSelect: () => {} }]}
        newAction={{ label: 'New task', onClick: () => {} }}
        deleted={{ shown, onShownChange: setShown, noun: 'tasks' }}
      />
    </div>
  )
}

export const Default: StoryObj = { render: () => <Gallery /> }

export const ShowingDeleted: StoryObj = {
  render: () => (
    <div className="max-w-4xl">
      <ListHeader
        title="Medications"
        count={4}
        newAction={{ label: 'New medication', onClick: () => {} }}
        deleted={{ shown: true, onShownChange: () => {}, noun: 'medications' }}
      />
    </div>
  ),
}
