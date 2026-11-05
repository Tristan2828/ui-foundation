// FillInQueue's index logic (which record is on screen as `items` change)
// and its states, rendered to markup. Moving through it is
// e2e/fill-in-queue.spec.ts's.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FillInField, type FillInFieldSpec } from '../src/components/app/fill-in-field'
import { FillInChoice, FillInQueue, type FillInQueueProps } from '../src/components/app/fill-in-queue'
import { nextFillInKey, resolveFillInIndex } from '../src/components/app/fill-in-queue-index'

describe('resolveFillInIndex', () => {
  it('follows the held record wherever it is in the list', () => {
    expect(resolveFillInIndex(['a', 'b', 'c'], 'c', 0)).toBe(2)
    expect(resolveFillInIndex(['x', 'a', 'b', 'c'], 'c', 2)).toBe(3)
  })

  it('stays at the same place when the held record left, which now holds the next one', () => {
    // "b" saved and filled: it left, and "c" is where it was.
    expect(resolveFillInIndex(['a', 'c'], 'b', 1)).toBe(1)
  })

  it('keeps the place inside a shorter list, and is -1 for an empty one', () => {
    expect(resolveFillInIndex(['a', 'b'], 'z', 5)).toBe(1)
    expect(resolveFillInIndex(['a'], null, 0)).toBe(0)
    expect(resolveFillInIndex([], 'a', 0)).toBe(-1)
  })
})

describe('nextFillInKey', () => {
  it('is the record after, wrapping from the last to the first', () => {
    expect(nextFillInKey(['a', 'b', 'c'], 'a', 0)).toBe('b')
    expect(nextFillInKey(['a', 'b', 'c'], 'c', 2)).toBe('a')
  })

  it('moves past a saved record still in the list (still missing something)', () => {
    expect(nextFillInKey([1, 2, 3], 2, 1)).toBe(3)
  })

  it('is the one now in its place when the saved record already left', () => {
    expect(nextFillInKey([1, 3], 2, 1)).toBe(3)
    // The last one left: the place stays inside the list.
    expect(nextFillInKey([1, 2], 3, 2)).toBe(2)
  })

  it('is the same record when it is the only one, and null with none', () => {
    expect(nextFillInKey(['a'], 'a', 0)).toBe('a')
    expect(nextFillInKey([], 'a', 0)).toBeNull()
  })
})

type Item = { id: number; name: string }
const ITEMS: Item[] = [
  { id: 1, name: 'Repaint the fence' },
  { id: 2, name: 'Learn Rust' },
]

const props = (over: Partial<FillInQueueProps<Item>> = {}): FillInQueueProps<Item> => ({
  items: ITEMS,
  getKey: (item) => item.id,
  renderItem: (item) => <h2>{item.name}</h2>,
  onSave: () => {},
  ...over,
})

const render = (p: FillInQueueProps<Item>) => renderToStaticMarkup(<FillInQueue {...p} />)

describe('FillInQueue', () => {
  it('shows the first record, its place, the progress and both buttons', () => {
    const html = render(props({ progress: { done: 12, total: 160 } }))
    expect(html).toContain('Repaint the fence')
    expect(html).not.toContain('Learn Rust')
    expect(html).toContain('Record 1 of 2')
    expect(html).toContain('12 of 160 filled')
    expect(html).toMatch(/role="progressbar"[^>]*aria-valuemax="160"[^>]*aria-valuenow="12"/)
    expect(html).toContain('>Skip<')
    expect(html).toContain('Save and next')
  })

  it('starts at `index` and disables Save and next until it can save', () => {
    const html = render(props({ index: 1, canSave: false }))
    expect(html).toContain('Learn Rust')
    expect(html).toContain('Record 2 of 2')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save and next<\/button>/)
    const asked = render(props({ canSave: (item) => item.id === 2 }))
    expect(asked).toMatch(/<button[^>]*disabled=""[^>]*>Save and next<\/button>/)
    expect(render(props())).not.toMatch(/<button[^>]*disabled=""[^>]*>Save and next<\/button>/)
  })

  it("names the record's group above it, with its count, and lists each group's count under the bar", () => {
    const html = render(
      props({
        progress: { done: 3, total: 10 },
        groups: [
          { id: 'a', label: 'Money', progress: { done: 1, total: 4 } },
          { id: 'b', label: 'House', progress: { done: 2, total: 6 } },
        ],
        getGroup: (item) => (item.id === 1 ? 'b' : 'a'),
      }),
    )
    expect(html).toMatch(/data-slot="fill-in-queue-group"[^>]*>.*House.*2 of 6 filled/)
    expect(html).toMatch(/data-slot="fill-in-queue-groups"[^>]*>.*Money 1 of 4.*House 2 of 6/)
    // One group counted: no list, only its line on the record.
    const one = render(props({ groups: [{ id: 'b', label: 'House', progress: { done: 2, total: 6 } }], getGroup: () => 'b' }))
    expect(one).not.toContain('fill-in-queue-groups')
    expect(one).toContain('fill-in-queue-group"')
  })

  it('has a loading, an error and an empty state', () => {
    expect(render(props({ loading: true }))).toContain('data-state="loading"')
    const failed = render(props({ error: { kind: 'network', message: 'Offline' }, onRetry: () => {} }))
    expect(failed).toContain('data-state="error"')
    expect(failed).toContain('Offline')
    expect(failed).toContain('Try again')
    expect(render(props({ error: <span>Broken list</span> }))).toContain('Broken list')
    const empty = render(props({ items: [], progress: { done: 2, total: 2 } }))
    expect(empty).toContain('data-state="empty"')
    expect(empty).toContain('Nothing left to fill in')
    expect(empty).toContain('2 of 2 filled')
  })
})

describe('FillInChoice', () => {
  const choices = [
    { value: 'small', label: 'Small' },
    { value: 'large', label: 'Large' },
  ] as const

  it('is a group named by its label, a toggle per choice, the picked one pressed', () => {
    const html = renderToStaticMarkup(<FillInChoice label="Effort" choices={choices} value="large" onChange={() => {}} />)
    const labelId = html.match(/<div id="([^"]+)"[^>]*>Effort<\/div>/)?.[1]
    expect(labelId).toBeDefined()
    expect(html).toContain(`role="group" aria-labelledby="${labelId}"`)
    expect(html).toMatch(/aria-pressed="false"[^>]*>Small</)
    expect(html).toMatch(/aria-pressed="true"[^>]*>Large</)
  })

  it('draws a suggestion dashed, and says it under the row', () => {
    const html = renderToStaticMarkup(
      <FillInChoice
        label="Effort"
        choices={choices}
        value={null}
        onChange={() => {}}
        suggestion={{ value: 'small', note: 'from similar projects' }}
      />,
    )
    expect(html).toMatch(/data-suggested="true"[^>]*border-dashed|border-dashed[^>]*data-suggested="true"/)
    expect(html).toContain('Suggested: Small (from similar projects)')
  })
})

describe('FillInField', () => {
  const draw = (field: FillInFieldSpec, value: string | number | null = null) =>
    renderToStaticMarkup(<FillInField field={field} value={value} onChange={() => {}} />)
  const few = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
  ]

  it('draws a short choice as a row of toggles, a long one as a select', () => {
    expect(draw({ name: 'x', label: 'Pick', kind: 'choice', choices: few })).toContain('data-slot="fill-in-choice"')
    const many = Array.from({ length: 10 }, (_, i) => ({ value: i, label: `Item ${i}` }))
    const html = draw({ name: 'x', label: 'Paid from', kind: 'reference', choices: many })
    expect(html).toContain('data-slot="fill-in-select"')
    expect(html).toContain('Pick one')
  })

  it('draws money with its symbol and a suggestion to use, the value as typed', () => {
    const html = draw({ name: 'price', label: 'Price', kind: 'money', suggestion: { value: 249, note: 'last seen' } }, 12.5)
    expect(html).toContain('data-slot="fill-in-input"')
    expect(html).toContain('>$<')
    expect(html).toContain('value="12.5"')
    expect(html).toContain('Use $249.00')
    expect(html).toContain('(last seen)')
  })

  it('draws text, a number and a date by kind', () => {
    expect(draw({ name: 'n', label: 'Model', kind: 'text' }, 'X1')).toMatch(/<input[^>]*value="X1"/)
    expect(draw({ name: 'n', label: 'Count', kind: 'number' }, 3)).toMatch(/type="number"[^>]*value="3"|value="3"[^>]*type="number"/)
    expect(draw({ name: 'd', label: 'Due', kind: 'date' }, '2026-09-02')).toContain('Sep 2, 2026')
  })
})
