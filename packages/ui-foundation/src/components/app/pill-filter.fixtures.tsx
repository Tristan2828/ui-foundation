import type { Meta, StoryObj } from '@/fixtures/types'
import { useState } from 'react'
import { Emoji } from './emoji'
import { PillFilter } from './pill-filter'

// PillFilter with a lead before some labels (a topic's emoji) and none on
// others. Axe and the token check run it in both themes
// (e2e/fixtures-visual.spec.ts); e2e/pill-filter.spec.ts drives it.

const TOPICS = [
  { value: 'science', label: 'Science', lead: <Emoji emoji="🔬" className="size-3.5" /> },
  { value: 'sports', label: 'Sports', lead: <Emoji emoji="⚽" className="size-3.5" /> },
  { value: 'local', label: 'Local' },
]

function Topics() {
  const [value, setValue] = useState('')
  return (
    <div className="flex flex-col gap-2">
      <PillFilter label="Topic" options={TOPICS} value={value} onValueChange={setValue} />
      <output data-testid="topic-value">{value || 'all'}</output>
    </div>
  )
}

const meta: Meta = {
  title: 'app/PillFilter',
  parameters: { controls: { disable: true } },
}

export default meta

export const WithLeads: StoryObj = { render: () => <Topics /> }
