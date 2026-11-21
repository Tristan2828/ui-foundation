// StepTrack: the stepper look's steps read only, by markup. Widths
// and axe are e2e/step-track.spec.ts and e2e/fixtures-visual.spec.ts.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EqualItems } from '../src/components/app/equal-items'
import { StepTrack, type StepTrackStep } from '../src/components/app/step-track'

const STEPS: StepTrackStep[] = [
  { id: 'a', title: 'Phase 1', step: 'done' },
  { id: 'b', title: 'Phase 2', step: 'current' },
  { id: 'c', title: 'Phase 3' },
]

const count = (html: string, needle: string) => html.split(needle).length - 1
const marks = (html: string) => [...html.matchAll(/<span aria-hidden="true" data-slot="[^"]*-mark" class="([^"]*)"/g)].map((m) => m[1])

describe('StepTrack', () => {
  it('a named ordered list of steps, never a tablist, nothing to press', () => {
    const html = renderToStaticMarkup(<StepTrack label="Phases" steps={STEPS} caption="Day 12" />)
    expect(html).toMatch(/^<ol data-slot="step-track" aria-label="Phases"/)
    expect(count(html, '<li ')).toBe(3)
    expect(html).not.toContain('role="tab')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('tabindex')
    expect(count(html, 'aria-current="step"')).toBe(1)
  })

  it('the caption sits under the current step in place of "Current", and the name still says current', () => {
    const html = renderToStaticMarkup(<StepTrack label="Phases" steps={STEPS} caption="Day 12" />)
    expect(html).toContain('data-slot="step-track-caption" class="font-normal text-muted-foreground">Day 12</span>')
    expect(html).not.toContain('>Current<')
    expect(html).toContain('<span class="sr-only">Step 2: </span>Phase 2<span class="sr-only">, current</span>')
    expect(html).toContain('<span class="sr-only">Step 1: </span>Phase 1<span class="sr-only">, done</span>')
    // Without a caption, "Current" as the stepper says it, and no hidden words twice.
    const plain = renderToStaticMarkup(<StepTrack label="Phases" steps={STEPS} />)
    expect(plain).toContain('>Current</span>')
    expect(plain).not.toContain(', current')
  })

  it('the current step is ringed; a step that needs a look has its dot and words', () => {
    const html = renderToStaticMarkup(
      <StepTrack label="Phases" steps={STEPS.map((s) => (s.id === 'a' ? { ...s, attention: 'needs an answer' } : s))} />,
    )
    const [done, current, upcoming] = marks(html)
    expect(current).toContain('ring-2 ring-ring')
    expect(done).not.toContain('ring-2')
    expect(upcoming).not.toContain('ring-2')
    expect(html).toContain('data-slot="step-track-step-attention"')
    expect(html).toContain('<span class="sr-only">, needs an answer</span>')
  })

  it("the marks are the stepper's own", () => {
    const track = marks(renderToStaticMarkup(<StepTrack label="Phases" steps={STEPS} />))
    const stepper = marks(renderToStaticMarkup(<EqualItems look="stepper" label="Phases" items={STEPS} />))
    const base = (classes: string) => classes.split(' ').filter((c) => !c.includes('ring')).join(' ')
    expect(track.map(base)).toEqual(stepper.map(base))
  })

  it('no steps reads emptyText', () => {
    expect(renderToStaticMarkup(<StepTrack label="Phases" steps={[]} />)).toContain('>Nothing yet</p>')
    expect(renderToStaticMarkup(<StepTrack label="Phases" steps={[]} emptyText="No phases" />)).toContain('>No phases</p>')
  })
})
