// SpinWheel's weighted pick and its slices, rendered to markup. Spinning,
// the live region and reduced motion are e2e/spin-wheel.spec.ts's.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SpinWheel, type SpinWheelProps } from '../src/components/app/spin-wheel'
import { pickSpinWheelIndex, type SpinWheelItem } from '../src/components/app/spin-wheel-pick'

const EQUAL: SpinWheelItem[] = [
  { id: 'a', label: 'Repaint the fence' },
  { id: 'b', label: 'Learn Rust' },
  { id: 'c', label: 'Plant a herb bed' },
  { id: 'd', label: 'Fix the gate latch' },
]

describe('pickSpinWheelIndex', () => {
  it('splits [0, 1) evenly between equal items, in order', () => {
    expect(pickSpinWheelIndex(EQUAL, 0)).toBe(0)
    expect(pickSpinWheelIndex(EQUAL, 0.2499)).toBe(0)
    expect(pickSpinWheelIndex(EQUAL, 0.25)).toBe(1)
    expect(pickSpinWheelIndex(EQUAL, 0.5)).toBe(2)
    expect(pickSpinWheelIndex(EQUAL, 0.9999)).toBe(3)
  })

  it('gives each item its weight over the sum', () => {
    const items: SpinWheelItem[] = [
      { id: 1, label: 'One', weight: 1 },
      { id: 2, label: 'Three', weight: 3 },
      { id: 3, label: 'Six', weight: 6 },
    ]
    expect(pickSpinWheelIndex(items, 0.09)).toBe(0)
    expect(pickSpinWheelIndex(items, 0.1)).toBe(1)
    expect(pickSpinWheelIndex(items, 0.39)).toBe(1)
    expect(pickSpinWheelIndex(items, 0.4)).toBe(2)
    // Over evenly spread values, each item's share is its weight's.
    const counts = [0, 0, 0]
    for (let step = 0; step < 1000; step++) counts[pickSpinWheelIndex(items, step / 1000)]++
    expect(counts).toEqual([100, 300, 600])
  })

  it('counts a missing, zero, negative or non-finite weight as 1', () => {
    const items: SpinWheelItem[] = [
      { id: 1, label: 'Zero', weight: 0 },
      { id: 2, label: 'Negative', weight: -2 },
      { id: 3, label: 'NaN', weight: Number.NaN },
      { id: 4, label: 'Missing' },
    ]
    expect([0.1, 0.3, 0.6, 0.9].map((value) => pickSpinWheelIndex(items, value))).toEqual([0, 1, 2, 3])
  })

  it('keeps out-of-range values on the wheel, and has nothing to pick from no items', () => {
    expect(pickSpinWheelIndex(EQUAL, 1)).toBe(3)
    expect(pickSpinWheelIndex(EQUAL, -1)).toBe(0)
    expect(pickSpinWheelIndex([], 0.5)).toBe(-1)
  })
})

const render = (props: Partial<SpinWheelProps> = {}) =>
  renderToStaticMarkup(<SpinWheel items={EQUAL} onResult={() => {}} {...props} />)

describe('SpinWheel', () => {
  it('draws a slice per item, each titled with its whole label, and counts them in the hub', () => {
    const html = render()
    expect(html.match(/data-slot="spin-wheel-slice"/g)).toHaveLength(4)
    expect(html).toContain('<title>Repaint the fence</title>')
    expect(html).toContain('Wheel, 4 items')
    expect(html).toMatch(/aria-hidden="true">4<\/text>/)
  })

  it('cuts a long label to its slice and leaves a thin slice unlabelled', () => {
    const items: SpinWheelItem[] = [
      { id: 1, label: 'Write a very long letter to an old friend about the garden', weight: 10 },
      { id: 2, label: 'Tiny', weight: 0.05 },
    ]
    const html = render({ items })
    expect(html).toContain('<title>Write a very long letter to an old friend about the garden</title>')
    expect(html).toMatch(/<text[^>]*>Write a very[^<]*…<\/text>/)
    expect(html).toContain('<title>Tiny</title>')
    expect(html).not.toMatch(/<text[^>]*>Tiny<\/text>/)
  })

  it('fills the picked slice solid and an emphasised one with a tint', () => {
    const html = render({ items: [...EQUAL.slice(0, 3), { id: 'd', label: 'Flagged', emphasis: true }], result: 'b' })
    const slices = html.split('data-slot="spin-wheel-slice"').slice(1)
    expect(slices[1]).toContain('data-picked="true"')
    expect(slices[1]).toContain('fill-primary')
    expect(slices[1]).toContain('fill-primary-foreground')
    expect(slices[3]).toContain('data-emphasis="true"')
    expect(slices[3]).toContain('fill-info/20')
    expect(slices[0]).not.toContain('data-picked')
  })

  it('shows the empty message and a disabled button with no items', () => {
    const html = render({ items: [], emptyMessage: 'Nothing yet', spinLabel: 'Pick one' })
    expect(html).toContain('Nothing yet')
    expect(html).not.toContain('<svg')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Pick one<\/button>/)
  })
})
