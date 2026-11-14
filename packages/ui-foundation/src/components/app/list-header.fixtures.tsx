import type { Meta, StoryObj } from '@/fixtures/types'
import { ClockIcon, DownloadIcon, LayoutDashboardIcon, LibraryIcon, RefreshCwIcon } from 'lucide-react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { ListHeader } from './list-header'

// A list's header: a title with its count and New alone; one related link
// out as a button; several folded into ⋯ with the page's extras and Show
// deleted; and Show deleted on, with its notice and Back to the list.
// Siblings: a switch between three peer lists beside the title, the
// current one marked, ⋯ keeping only Show deleted. Secondary action
// (4.117): one more button beside New, on a list with ⋯ and one without;
// on a phone it's ⋯'s first item (e2e/list-header-secondary.spec.ts). Axe
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

export const Siblings: StoryObj = {
  render: () => (
    <div className="max-w-4xl">
      <ListHeader
        title="Houseplants"
        count={12}
        siblings={[
          { label: 'Houseplants', to: '/', count: 12 },
          { label: 'Cuttings', to: '/cuttings', count: 6 },
          { label: 'Seeds', to: '/seeds', count: 3 },
        ]}
        newAction={{ label: 'New plant', onClick: () => {} }}
        deleted={{ shown: false, onShownChange: () => {}, noun: 'plants' }}
      />
    </div>
  ),
}

// One more button beside New (4.117): "Refresh Now" on a list with a ⋯
// menu (a refresh in flight disables it for a moment), and "Add from
// Catalog" on one with nothing else in ⋯, so ⋯ shows on a phone only.
function SecondaryGallery() {
  const [refreshing, setRefreshing] = useState(false)
  const [refreshed, setRefreshed] = useState(0)
  const [added, setAdded] = useState(0)
  const refresh = () => {
    setRefreshing(true)
    setTimeout(() => {
      setRefreshing(false)
      setRefreshed((was) => was + 1)
    }, 300)
  }
  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <ListHeader
        title="Feeds"
        count={18}
        secondaryAction={{ label: 'Refresh Now', icon: RefreshCwIcon, onClick: refresh, disabled: refreshing }}
        more={[{ label: 'Export', icon: DownloadIcon, onSelect: () => {} }]}
        newAction={{ label: 'New feed', onClick: () => {} }}
        deleted={{ shown: false, onShownChange: () => {}, noun: 'feeds' }}
      />
      <ListHeader
        title="Books"
        count={42}
        secondaryAction={{ label: 'Add from Catalog', icon: LibraryIcon, onClick: () => setAdded((was) => was + 1) }}
        newAction={{ label: 'New book', to: '/books/new' }}
      />
      <p data-testid="secondary-log" className="type-body text-muted-foreground">
        Refreshed {refreshed}, added {added}
      </p>
    </div>
  )
}

export const SecondaryAction: StoryObj = { name: 'Secondary action', render: () => <SecondaryGallery /> }
