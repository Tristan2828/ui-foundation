// The `inPlace` presets (src/components/app/edit-in-place-presets.tsx):
// each one's check (what a draft saves as, or the words it's refused
// with), how a value reads at rest, and, for several fields edited as
// one, which part a refusal is about.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AppError } from '../src/api/contracts'
import type { EditInPlace } from '../src/components/app/edit-in-place'
import { inPlace } from '../src/components/app/edit-in-place-presets'
import { EditInPlaceStore } from '../src/components/app/edit-in-place-store'

const save = () => Promise.resolve()

// What a draft saves as, or the message it's refused with.
function check(edit: EditInPlace, draft: unknown) {
  const result = edit.schema!.safeParse(draft)
  return result.success ? { saves: result.data } : { refused: result.error.issues[0]?.message }
}

const html = (edit: EditInPlace) => renderToStaticMarkup(<>{edit.shown}</>)

describe('inPlace.text', () => {
  it('trims, saves a blank as null, and refuses a blank when required', () => {
    expect(check(inPlace.text({ value: 'a', save }), '  Mouse  ')).toEqual({ saves: 'Mouse' })
    expect(check(inPlace.text({ value: 'a', save }), '   ')).toEqual({ saves: null })
    expect(check(inPlace.text({ value: 'a', save, required: true }), '')).toEqual({ refused: 'Required' })
    expect(check(inPlace.text({ value: 'a', save, maxLength: 3 }), 'abcd')).toEqual({ refused: 'At most 3 characters' })
  })

  it('reads as the text, or nothing (the field’s "Not set")', () => {
    expect(inPlace.text({ value: 'Mouse', save }).shown).toBe('Mouse')
    expect(inPlace.text({ value: null, save }).shown).toBeNull()
    expect(inPlace.text({ value: '', save }).shown).toBeNull()
  })
})

describe('inPlace.number', () => {
  const minutes = inPlace.number({ value: 30, save, min: 0, max: 90, integer: true, unit: 'min' })
  it('checks min, max and whole numbers', () => {
    expect(check(minutes, '45')).toEqual({ saves: 45 })
    expect(check(minutes, '91')).toEqual({ refused: 'At most 90' })
    expect(check(minutes, '-1')).toEqual({ refused: 'At least 0' })
    expect(check(minutes, '2.5')).toEqual({ refused: 'Enter a whole number' })
    expect(check(minutes, 'ten')).toEqual({ refused: 'Enter a number' })
    expect(check(minutes, '')).toEqual({ saves: null })
  })

  it('reads with its unit, and the draft starts as the number', () => {
    expect(minutes.shown).toBe('30 min')
    expect(minutes.value).toBe('30')
  })

  it('counts 30 and 30.0 as the same value: no save', () => {
    expect(minutes.isEqual!('30', '30.0')).toBe(true)
    expect(minutes.isEqual!('30', '31')).toBe(false)
  })
})

describe('inPlace.money', () => {
  const price = inPlace.money({ value: '1234.56', save })
  it('reads as dollars and cents', () => {
    expect(price.shown).toBe('$1,234.56')
    expect(inPlace.money({ value: 5, save }).shown).toBe('$5.00')
    expect(inPlace.money({ value: null, save }).shown).toBeNull()
  })

  it('saves two decimals as the API writes a decimal, from what was typed', () => {
    expect(check(price, '$1,234.5')).toEqual({ saves: '1234.50' })
    expect(check(price, '12')).toEqual({ saves: '12.00' })
    expect(check(price, '0.1')).toEqual({ saves: '0.10' })
    expect(check(price, '007.25')).toEqual({ saves: '7.25' })
    expect(check(price, '')).toEqual({ saves: null })
  })

  it('refuses a third decimal, words, and (by default) a negative amount', () => {
    expect(check(price, '1.234')).toEqual({ refused: 'Enter an amount, like 12.50' })
    expect(check(price, 'lots')).toEqual({ refused: 'Enter an amount, like 12.50' })
    expect(check(price, '-5')).toEqual({ refused: 'At least $0.00' })
    expect(check(inPlace.money({ value: '0', save, min: -100 }), '-5')).toEqual({ saves: '-5.00' })
  })

  it('counts $5 and 5.00 as the same value', () => {
    expect(price.isEqual!('$5', '5.00')).toBe(true)
  })
})

describe('inPlace.date', () => {
  it('saves the day, or null once cleared', () => {
    const due = inPlace.date({ value: '2026-09-02', save })
    expect(check(due, '2026-10-01')).toEqual({ saves: '2026-10-01' })
    expect(check(due, '')).toEqual({ saves: null })
    expect(check(inPlace.date({ value: '2026-09-02', save, required: true }), '')).toEqual({ refused: 'Required' })
    expect(due.kind).toBe('choice')
  })

  it('reads as the day, never shifted by the time zone', () => {
    expect(inPlace.date({ value: '2026-09-02', save, locale: 'en-US' }).shown).toBe('Sep 2, 2026')
    expect(inPlace.date({ value: '', save }).shown).toBeNull()
  })
})

describe('inPlace.select', () => {
  const options = [
    { value: 'low', label: 'Low' },
    { value: 'high', label: 'High' },
  ] as const
  it('reads as the option’s label, or its own render', () => {
    expect(inPlace.select({ value: 'high', options, save }).shown).toBe('High')
    const badge = inPlace.select({ value: 'low', options, save, render: (value, label) => <b data-value={value}>{label}</b> })
    expect(html(badge)).toBe('<b data-value="low">Low</b>')
  })

  it('saves the pick; "Not set" is refused only when required', () => {
    expect(check(inPlace.select({ value: 'low', options, save }), 'high')).toEqual({ saves: 'high' })
    expect(check(inPlace.select({ value: 'low', options, save }), null)).toEqual({ saves: null })
    expect(check(inPlace.select({ value: 'low', options, save, required: true }), null)).toEqual({ refused: 'Required' })
  })
})

describe('inPlace.reference', () => {
  it('reads as the saved record’s name and saves the id picked', () => {
    const category = inPlace.reference({ value: 3, label: 'Tools', search: () => Promise.resolve([]), save })
    expect(category.shown).toBe('Tools')
    expect(check(category, 7)).toEqual({ saves: 7 })
    expect(category.kind).toBe('choice')
  })
})

describe('inPlace.link', () => {
  it('reads as its label, else the host, opening in a new tab', () => {
    const docs = inPlace.link({ value: { url: 'https://docs.example.com/guide', label: null }, save })
    expect(html(docs)).toMatch(/<a href="https:\/\/docs.example.com\/guide" target="_blank" rel="noopener noreferrer"[^>]*>docs.example.com<svg/)
    const named = inPlace.link({ value: { url: 'https://docs.example.com/guide', label: 'The guide' }, save })
    expect(html(named)).toMatch(/>The guide<svg/)
  })

  it('never makes a link of an address the box would refuse', () => {
    const stored = inPlace.link({ value: { url: 'javascript:alert(1)', label: 'Click' }, save })
    expect(html(stored)).not.toContain('<a')
  })

  it('checks the address with linkRule and saves both as one value', () => {
    const link = inPlace.link({ value: { url: null, label: null }, save })
    expect(check(link, { url: 'example.com', label: ' Home ' })).toEqual({ saves: { url: 'https://example.com', label: 'Home' } })
    expect(check(link, { url: '', label: '' })).toEqual({ saves: { url: null, label: null } })
    expect(check(link, { url: 'javascript:alert(1)', label: '' })).toEqual({ refused: 'Use a web or email address' })
    expect(check(link, { url: '', label: 'Home' })).toEqual({ refused: 'Add the address, or clear the label' })
  })

  it('puts a refusal on the box it’s about', () => {
    const link = inPlace.link({ value: { url: null, label: null }, save })
    const refused = link.schema!.safeParse({ url: 'a b', label: '' })
    expect(refused.success).toBe(false)
    if (!refused.success) expect(link.fieldErrors!(refused.error)).toEqual({ url: 'An address has no spaces' })
    expect(link.errorsOnFields).toBe(true)
  })
})

describe('inPlace.fields', () => {
  const pair = () =>
    inPlace.fields({
      value: { model: 'small', effort: 'low' } as { model: string | null; effort: string | null },
      fields: {
        model: { kind: 'select', label: 'Model', required: true, options: [{ value: 'small', label: 'Small' }, { value: 'large', label: 'Large' }] },
        effort: { kind: 'select', label: 'Effort', required: true, options: [{ value: 'low', label: 'Low' }, { value: 'max', label: 'Max' }] },
      },
      rule: ({ model, effort }) => (effort === 'max' && model !== 'large' ? 'Max effort needs the large model' : null),
      save,
    })

  it('reads as each part, joined', () => {
    expect(html(pair())).toBe('<span>Small</span><span> · Low</span>')
  })

  it('saves the parts together once every part and the rule pass', () => {
    expect(check(pair(), { model: 'large', effort: 'max' })).toEqual({ saves: { model: 'large', effort: 'max' } })
  })

  it('refuses on the pair when the rule fails, on no one part', () => {
    const edit = pair()
    const refused = edit.schema!.safeParse({ model: 'small', effort: 'max' })
    expect(refused.success).toBe(false)
    if (refused.success) return
    expect(refused.error.issues[0]?.message).toBe('Max effort needs the large model')
    expect(edit.fieldErrors!(refused.error)).toBeNull()
  })

  it('puts a part’s own refusal, and a 422 naming its field, on that part', () => {
    const edit = pair()
    const refused = edit.schema!.safeParse({ model: null, effort: 'low' })
    if (refused.success) throw new Error('expected a refusal')
    expect(edit.fieldErrors!(refused.error)).toEqual({ model: 'Model: Required' })
    const server: AppError = { kind: 'validation', message: 'Validation failed', fieldErrors: { effort: ['Not offered on this plan'] } }
    expect(edit.fieldErrors!(server)).toEqual({ effort: 'Not offered on this plan' })
  })

  it('saves on leaving it when a part is a list, on Enter when every part is typed into', () => {
    expect(pair().kind).toBe('multi')
    const typed = inPlace.fields({
      value: { low: 1, high: 3 },
      fields: { low: { kind: 'number', label: 'Low' }, high: { kind: 'number', label: 'High' } },
      rule: ({ low, high }) => (low !== null && high !== null && low > high ? 'Low must not be above high' : null),
      save,
    })
    expect(typed.kind).toBe('text')
    expect(check(typed, { low: '4', high: '3' })).toEqual({ refused: 'Low must not be above high' })
  })

  it('through the store: a refused save keeps the draft, the part’s message on the part', async () => {
    const store = new EditInPlaceStore()
    const edit = inPlace.fields({
      value: { model: 'small', effort: 'low' },
      fields: {
        model: { kind: 'text', label: 'Model' },
        effort: { kind: 'text', label: 'Effort' },
      },
      save: () => Promise.reject({ kind: 'validation', message: 'Validation failed', fieldErrors: { model: ['Unknown model'] } } satisfies AppError),
    })
    store.register('pair', () => edit)
    await store.start('pair')
    store.change('pair', { model: 'huge', effort: 'low' })
    expect(await store.commit('pair')).toBe(false)
    const state = store.state('pair')
    expect(state.status).toBe('open')
    if (state.status === 'closed') return
    expect(state.draft).toEqual({ model: 'huge', effort: 'low' })
    expect(state.error).toBe('Unknown model')
    expect(state.fieldErrors).toEqual({ model: 'Unknown model' })
  })
})
