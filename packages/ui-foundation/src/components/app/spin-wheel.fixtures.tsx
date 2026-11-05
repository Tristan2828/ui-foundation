import type { Meta, StoryObj } from '@/fixtures/types'
import { useState } from 'react'
import { SpinWheel, type SpinWheelItem } from './spin-wheel'

// A wheel that picks what to do next (app/SpinWheel). Axe and the token
// check are e2e/fixtures-visual.spec.ts's; spinning is e2e/spin-wheel.spec.ts's.
const meta: Meta = {
  title: 'app/SpinWheel',
  parameters: { controls: { disable: true } },
}

export default meta

const DOZEN: SpinWheelItem[] = [
  { id: 1, label: 'Repaint the fence' },
  { id: 2, label: 'Learn Rust' },
  { id: 3, label: 'Plant a herb bed' },
  { id: 4, label: 'Fix the gate latch' },
  { id: 5, label: 'Build a bookshelf' },
  { id: 6, label: 'Bake sourdough bread' },
  { id: 7, label: 'Clear the garage' },
  { id: 8, label: 'Sort the photo albums' },
  { id: 9, label: 'Tune the bicycle' },
  { id: 10, label: 'Write a letter to an old friend' },
  { id: 11, label: 'Oil the hinges' },
  { id: 12, label: 'Read a chapter' },
]

const WEIGHTED: SpinWheelItem[] = [
  { id: 'fence', label: 'Repaint the fence', weight: 5 },
  { id: 'rust', label: 'Learn Rust', weight: 3 },
  { id: 'herbs', label: 'Plant a herb bed', weight: 2 },
  { id: 'latch', label: 'Fix the gate latch', weight: 1 },
  { id: 'hinges', label: 'Oil the hinges', weight: 0.3 },
  { id: 'chapter', label: 'Read a chapter', weight: 0.3 },
]

const EMPHASIS: SpinWheelItem[] = DOZEN.slice(0, 8).map((item) => ({ ...item, emphasis: item.id === 4 || item.id === 7 }))

function Picker({ items, random, durationMs }: { items: SpinWheelItem[]; random?: () => number; durationMs?: number }) {
  const [result, setResult] = useState<SpinWheelItem | null>(null)
  return (
    <div className="flex flex-col items-center gap-3">
      <SpinWheel
        aria-label="Things to do"
        items={items}
        result={result?.id ?? null}
        onResult={setResult}
        random={random}
        durationMs={durationMs}
        emptyMessage="Nothing to pick from: add a few things to do first."
      />
      <p className="type-body text-muted-foreground" data-testid="picked">
        {result ? (
          <>
            Next up: <span className="font-medium text-foreground">{result.label}</span>
          </>
        ) : (
          'Spin to pick what to do next.'
        )}
      </p>
    </div>
  )
}

export const Default: StoryObj = { render: () => <Picker items={DOZEN} /> }

// Bigger slices are likelier: weight 5 is five times weight 1.
export const Weighted: StoryObj = { render: () => <Picker items={WEIGHTED} /> }

// Flagged items are tinted slices.
export const Emphasis: StoryObj = { render: () => <Picker items={EMPHASIS} /> }

// A fixed `random`, so a test knows what it picks: 0.5 of a dozen equal
// slices is the seventh, "Clear the garage".
export const Fixed: StoryObj = { render: () => <Picker items={DOZEN} random={() => 0.5} durationMs={1200} /> }

export const Empty: StoryObj = { render: () => <Picker items={[]} /> }

// Picked at rest, a tinted slice, and the empty wheel, on one page for the
// contrast checks.
export const AllStates: StoryObj = {
  render: () => (
    <div className="grid gap-8 sm:grid-cols-2">
      <SpinWheel aria-label="Picked" items={EMPHASIS} result={2} onResult={() => {}} />
      <SpinWheel aria-label="Nothing" items={[]} onResult={() => {}} emptyMessage="No items yet" />
    </div>
  ),
}
