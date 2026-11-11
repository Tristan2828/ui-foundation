// The form standard's pure parts (4.85): which fields share a row, how
// many problems react-hook-form's errors hold, and the markup Field,
// FieldLabel and FormSection draw. The layout in a browser, the bar, the
// move to the first problem and the leave guard are
// e2e/entity-form.spec.ts's.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FormSection } from '../src/components/app/form-section'
import { Field, FieldLabel } from '../src/components/ui/field'
import { fieldRows, type FieldRowItem } from '../src/lib/field-rows'
import { countFormErrors } from '../src/lib/form-errors'

const sizes = (...list: string[]): FieldRowItem[] =>
  list.map((entry) => {
    const [size, flag] = entry.split(':')
    return {
      size: size as FieldRowItem['size'],
      solo: flag === 'solo',
      kind: flag === 'date' || flag === 'number' ? flag : null,
    }
  })

/** The rows, as the sizes in each: a lone field is its size alone. */
function rowsOf(items: FieldRowItem[]): string[] {
  const places = fieldRows(items)
  const rows: string[] = []
  let current: string[] = []
  let left = 0
  items.forEach((item, at) => {
    const place = places[at]
    if (place.share === null) {
      if (current.length) rows.push(current.join(' '))
      current = []
      rows.push(item.size)
      return
    }
    if (left === 0) {
      if (current.length) rows.push(current.join(' '))
      current = []
      left = place.gaps + 1
    }
    current.push(item.size)
    left--
  })
  if (current.length) rows.push(current.join(' '))
  return rows
}

describe('fieldRows', () => {
  it('puts consecutive short fields in a row, up to three', () => {
    expect(rowsOf(sizes('full', 's', 's', 's', 's', 'full'))).toEqual(['full', 's s s', 's', 'full'])
  })

  it('shares by size: s 1, m 1.4, l 2.6 parts', () => {
    const [series, number] = fieldRows(sizes('l', 's'))
    expect(series.share).toBeCloseTo(2.6 / 3.6)
    expect(number.share).toBeCloseTo(1 / 3.6)
    expect(series.gaps).toBe(1)
    const shares = fieldRows(sizes('m', 'm', 's')).map((place) => place.share ?? 0)
    expect(shares.reduce((sum, share) => sum + share, 0)).toBeCloseTo(1)
  })

  it('gives a long field one short partner at most, never another long one', () => {
    expect(rowsOf(sizes('l', 'l', 's'))).toEqual(['l', 'l s'])
    expect(rowsOf(sizes('l', 's', 'm', 'm', 's'))).toEqual(['l s', 'm m s'])
    expect(rowsOf(sizes('s', 's', 'l'))).toEqual(['s s', 'l'])
  })

  it('keeps a solo field, a full one and a lone short one on rows of their own', () => {
    expect(rowsOf(sizes('s', 'm:solo', 's'))).toEqual(['s', 'm', 's'])
    expect(fieldRows(sizes('m'))[0].share).toBeNull()
    expect(rowsOf(sizes('m', 'full', 'm'))).toEqual(['m', 'full', 'm'])
  })

  it('keeps two dates or two numbers side by side on a phone, nothing else', () => {
    const pairs = (...list: string[]) => fieldRows(sizes(...list)).map((place) => place.phonePair)
    expect(pairs('m:date', 'm:date', 's')).toEqual([true, true, false])
    expect(pairs('s:number', 's:number')).toEqual([true, true])
    expect(pairs('m:date', 's:number')).toEqual([false, false])
    expect(pairs('m', 'm')).toEqual([false, false])
    // Only a pair: the third of three numbers takes its own row.
    expect(pairs('s:number', 's:number', 's:number')).toEqual([true, true, false])
  })
})

describe('countFormErrors', () => {
  it('counts each field once, however deep, and a list of its own', () => {
    expect(countFormErrors({})).toBe(0)
    expect(countFormErrors(undefined)).toBe(0)
    expect(
      countFormErrors({
        title: { type: 'required', message: 'Give it a title', ref: { name: 'title' } },
        link: { type: 'validate', message: 'Enter a full address' },
        checklist: [undefined, { text: { type: 'too_small', message: 'Say what it is' } }],
        pairings: { root: { type: 'too_big', message: 'Twenty at most' } },
      }),
    ).toBe(4)
  })
})

describe('Field and FieldLabel', () => {
  it('Field says its size, solo and kind to FieldGroup', () => {
    const html = renderToStaticMarkup(
      <Field size="m" solo kind="date">
        <span />
      </Field>,
    )
    expect(html).toContain('data-size="m"')
    expect(html).toContain('data-solo=""')
    expect(html).toContain('data-kind="date"')
    expect(renderToStaticMarkup(<Field />)).not.toContain('data-size')
  })

  it('a required label has an asterisk screen readers skip', () => {
    const html = renderToStaticMarkup(
      <FieldLabel htmlFor="title" required>
        Title
      </FieldLabel>,
    )
    expect(html).toMatch(/Title<span aria-hidden="true" data-slot="field-required"[^>]*>\*<\/span>/)
    expect(renderToStaticMarkup(<FieldLabel htmlFor="title">Title</FieldLabel>)).not.toContain('field-required')
  })
})

describe('FormSection', () => {
  it('is a section named by its title, on a card, with a field group inside', () => {
    const html = renderToStaticMarkup(
      <FormSection title="Reading">
        <Field size="m" />
      </FormSection>,
    )
    expect(html).toMatch(/<section aria-labelledby="([^"]+)" data-slot="form-section"/)
    const id = /aria-labelledby="([^"]+)"/.exec(html)![1]
    expect(html).toContain(`<h2 id="${id}"`)
    expect(html).toContain('data-slot="card"')
    expect(html).toContain('data-slot="field-group"')
  })
})
