import { useState } from 'react'
import type { Meta, StoryObj } from '@/fixtures/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { QuickAddOptions, QuickAddResult } from '@/lib/quick-add'
import { QuickAddChip, QuickAddInput } from './quick-add-input'

// QuickAddInput on made-up chores, read on a fixed day
// (Friday 2026-11-20 in New York) so every run reads the same:
//
// - Default: a line with a day, a repeat from completion and a list read,
//   marked in the box and shown as chips; the app's Place and Block chips
//   after them (pressed, they step through their names); Enter adds the
//   line under the box.
// - Lines: one box per kind of read (a time, a weekday, a month day, a
//   repeat's own time, all three tokens), and one with nothing read.
// - GivenBack: "sun" read as Sunday, then given back with ✕.
// - Empty: no line yet, with the hint.
//
// e2e/quick-add-input.spec.ts types lines, presses ✕ and Enter; axe and
// the token check run every story in both themes (e2e/fixtures-visual.spec.ts).
const meta: Meta = {
  title: 'app/QuickAddInput',
  parameters: { controls: { disable: true } },
}

export default meta

const LISTS = ['Home', 'Errands', 'Garden', 'Work']
const PLACES = ['At the Desk', 'Out and About', 'On the Couch']
const BLOCKS = ['Morning', 'Afternoon', 'Evening']

const OPTIONS: Omit<QuickAddOptions, 'ignore'> = {
  today: '2026-11-20',
  timeZone: 'America/New_York',
  locale: 'en-US',
  tokens: [
    { key: 'list', symbol: '#', label: 'List', names: LISTS },
    { key: 'place', symbol: '@', label: 'Place', names: PLACES },
    { key: 'block', symbol: '/', label: 'Block', names: BLOCKS },
  ],
}

const HINT = (
  <>
    Dates, times and repeats in words (<code>every! 2 weeks</code> repeats from when it's done). <code>#</code> list,{' '}
    <code>@</code> place, <code>/</code> block: a few letters are enough. ✕ puts a chip's words back in the title.
  </>
)

function summary(result: QuickAddResult): string {
  const parts = [result.title || '(no title)']
  if (result.date) parts.push(result.date.value)
  if (result.time) parts.push(result.time.value)
  if (result.recurrence) parts.push(result.recurrence.value.rule + (result.recurrence.value.fromCompletion ? ' from done' : ''))
  for (const token of result.tokens) parts.push(`${token.key} ${token.name}`)
  return parts.join(' · ')
}

/** The app's own chips: List (Home when none is typed), Place and Block, each pressed to step on. */
function useAppChips() {
  const [picked, setPicked] = useState<Record<string, string | undefined>>({})
  const step = (key: string, names: string[], blank: boolean) => {
    setPicked((current) => {
      const order: (string | undefined)[] = blank ? [undefined, ...names] : names
      const at = order.indexOf(current[key])
      return { ...current, [key]: order[(at + 1) % order.length] }
    })
  }
  const chips = (result: QuickAddResult) => {
    const typed = new Set(result.tokens.map((token) => token.key))
    return (
      <>
        {!typed.has('list') && (
          <QuickAddChip label="List" value={picked.list ?? 'Home'} set={!!picked.list} onClick={() => step('list', LISTS, false)} />
        )}
        {!typed.has('place') && (
          <QuickAddChip label="Place" value={picked.place} set={!!picked.place} onClick={() => step('place', PLACES, true)} />
        )}
        {!typed.has('block') && (
          <QuickAddChip label="Block" value={picked.block} set={!!picked.block} onClick={() => step('block', BLOCKS, true)} />
        )}
      </>
    )
  }
  return { chips, reset: () => setPicked({}) }
}

function Box({ start, hint, label = 'Add To-Do' }: { start: string; hint?: boolean; label?: string }) {
  const [text, setText] = useState(start)
  const [added, setAdded] = useState<string[]>([])
  const [result, setResult] = useState<QuickAddResult | null>(null)
  const { chips, reset } = useAppChips()
  const add = (read: QuickAddResult) => {
    if (!read.title) return
    setAdded((current) => [...current, summary(read)])
    setText('')
    reset()
  }
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <QuickAddInput
        label={label}
        options={OPTIONS}
        value={text}
        onValueChange={setText}
        onSubmit={add}
        onResultChange={setResult}
        chips={chips}
        hint={hint ? HINT : undefined}
        placeholder="Type a to-do"
      />
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={!result?.title} onClick={() => result && add(result)}>
          Add To-Do
        </Button>
        <output data-testid="reading" className="min-w-0 truncate font-mono text-xs text-muted-foreground">
          {result ? summary(result) : ''}
        </output>
      </div>
      {added.length > 0 && (
        <ul aria-label="Added" className="flex flex-col gap-1 text-sm text-foreground">
          {added.map((line, i) => (
            <li key={i}>Added: {line}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export const Default: StoryObj = {
  render: () => (
    <Card className="max-w-xl">
      <CardContent>
        <Box start="Wipe the shelves monday every! 2 weeks #home" hint />
      </CardContent>
    </Card>
  ),
}

const LINES = [
  ['A time, today', 'Ring the garage at 3pm'],
  ['A weekday and a time', 'Return the library books fri 10:30am'],
  ['A month day', 'Renew the parking permit on dec 9'],
  ['In some days', 'Check on the seedlings in 3 days'],
  ["A repeat's own time", 'Water the ferns every mon and thu at 7pm'],
  ['All three tokens', 'Sort the receipts #work @desk /aft'],
  ['Nothing read', 'A plain title with nothing in it'],
]

export const Lines: StoryObj = {
  render: () => (
    <div className="grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2">
      {LINES.map(([label, line]) => (
        <Box key={label} label={label} start={line} />
      ))}
    </div>
  ),
}

export const GivenBack: StoryObj = {
  render: () => (
    <div className="max-w-xl">
      <Box label="A word that only looks like a day" start="Read the sun article" hint />
    </div>
  ),
}

export const Empty: StoryObj = {
  render: () => (
    <div className="max-w-xl">
      <Box start="" hint />
    </div>
  ),
}
