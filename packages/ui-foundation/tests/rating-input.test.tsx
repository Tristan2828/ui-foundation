// RatingInput (src/components/app/rating-input.tsx) as markup: a radio
// group named by its label, one radio per star named "2 of 5", the set
// one checked and the stars up to it filled. And `inPlace.rating`: always
// editable, its check, how it reads at rest, and that a pick saves at once
// through the store while an arrow's value waits for the pause. Clicking,
// the keys, clearing and a phone's targets are e2e/rating-input.spec.ts.
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EditControlProps } from '../src/components/app/edit-in-place'
import { inPlace } from '../src/components/app/edit-in-place-presets'
import { EditInPlaceStore } from '../src/components/app/edit-in-place-store'
import { RatingInput } from '../src/components/app/rating-input'

const html = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>)
const count = (markup: string, pattern: RegExp) => markup.match(pattern)?.length ?? 0

describe('RatingInput', () => {
  it('is a radio group named by its label, a radio per star named in words', () => {
    const markup = html(<RatingInput label="Taste" value={3} onChange={() => {}} />)
    expect(markup).toContain('role="radiogroup"')
    expect(markup).toContain('aria-label="Taste"')
    expect(count(markup, /role="radio"/g)).toBe(5)
    for (const n of [1, 2, 3, 4, 5]) expect(markup).toContain(`aria-label="${n} of 5"`)
    expect(count(markup, /aria-checked="true"/g)).toBe(1)
    expect(markup).toMatch(/aria-checked="true"[^>]*aria-label="3 of 5"|aria-label="3 of 5"[^>]*aria-checked="true"/)
    expect(count(markup, /data-filled=""/g)).toBe(3)
  })

  it('fills nothing for null, rounds and clamps, and draws hearts out of max', () => {
    expect(count(html(<RatingInput label="Value" value={null} onChange={() => {}} />), /data-filled=""/g)).toBe(0)
    expect(count(html(<RatingInput label="Value" value={3.6} onChange={() => {}} />), /data-filled=""/g)).toBe(4)
    expect(count(html(<RatingInput label="Value" value={9} onChange={() => {}} />), /data-filled=""/g)).toBe(5)
    const hearts = html(<RatingInput label="Loved" value={7} max={10} glyph="heart" onChange={() => {}} />)
    expect(count(hearts, /role="radio"/g)).toBe(10)
    expect(hearts).toContain('data-glyph="heart"')
    expect(hearts).toContain('aria-label="10 of 10"')
  })

  it('draws as RatingScore: filled in the ink, the rest outlines in muted-foreground', () => {
    const markup = html(<RatingInput label="Taste" value={1} onChange={() => {}} />)
    expect(markup).toContain('text-foreground')
    expect(count(markup, /text-muted-foreground/g)).toBe(4)
    expect(markup).toContain('pointer-coarse:size-11')
  })
})

describe('inPlace.rating', () => {
  const save = () => Promise.resolve()

  it('is always editable, one pick, its draft the rounded value', () => {
    const rating = inPlace.rating({ value: 4.2, save })
    expect(rating.alwaysEditable).toBe(true)
    expect(rating.kind).toBe('choice')
    expect(rating.value).toBe(4)
    expect(inPlace.rating({ value: undefined, save }).value).toBeNull()
  })

  it('reads at rest as RatingScore, or nothing (the field’s "Not set")', () => {
    expect(html(inPlace.rating({ value: 4, save }).shown)).toContain('aria-label="4 of 5"')
    expect(html(inPlace.rating({ value: 2, max: 3, glyph: 'heart', save }).shown)).toContain('data-glyph="heart"')
    expect(inPlace.rating({ value: null, save }).shown).toBeNull()
  })

  it('saves null when cleared, and refuses it when required', () => {
    expect(inPlace.rating({ value: 3, save }).schema!.safeParse(null)).toEqual({ success: true, data: null })
    expect(inPlace.rating({ value: 3, save, required: true }).schema!.safeParse(null).success).toBe(false)
  })

  it('its control is a RatingInput named by the field', () => {
    const rating = inPlace.rating({ value: 3, save })
    const props: EditControlProps<unknown> = {
      id: 'r',
      value: 3,
      onChange: () => {},
      commit: () => {},
      cancel: () => {},
      disabled: false,
      invalid: false,
      label: 'My Rating',
      describedBy: 'r-status',
      onProblem: () => {},
    }
    const markup = html(rating.control(props))
    expect(markup).toContain('data-slot="rating-input"')
    expect(markup).toContain('aria-label="My Rating"')
    expect(markup).toContain('aria-describedby="r-status"')
  })
})

describe('inPlace.rating through the store', () => {
  afterEach(() => vi.useRealTimers())

  it('a pick saves at once and stays open; pressing it again saves null', async () => {
    const store = new EditInPlaceStore()
    const saved: unknown[] = []
    const rating = inPlace.rating({ value: 4, save: async (value) => void saved.push(value) })
    store.register('rating', () => rating)
    expect(store.state('rating').status).toBe('open')
    expect(await store.commit('rating', 2)).toBe(true)
    expect(saved).toEqual([2])
    expect(store.state('rating').status).toBe('open')
    expect(await store.commit('rating', null)).toBe(true)
    expect(saved).toEqual([2, null])
  })

  it('an arrow’s value waits for the pause, so only the last of several saves', async () => {
    vi.useFakeTimers()
    const store = new EditInPlaceStore()
    const saved: unknown[] = []
    store.register('rating', () => inPlace.rating({ value: 1, save: async (value) => void saved.push(value) }))
    store.change('rating', 2)
    store.change('rating', 3)
    store.change('rating', 4)
    expect(saved).toEqual([])
    await vi.advanceTimersByTimeAsync(1100)
    expect(saved).toEqual([4])
  })
})
