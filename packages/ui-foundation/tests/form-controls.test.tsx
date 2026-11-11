// The form and in-place controls' pure parts (4.86, F10 to F18): reading a
// typed day, the markup ChoiceButtons, DateField and EditableValue's row
// look draw, and when Create is offered. Behaviour in a browser (typing,
// picking, saving, the row hover, a phone's chevron) is
// e2e/form-controls.spec.ts's.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ChoiceButtons } from '../src/components/app/choice-buttons'
import { DateField } from '../src/components/app/date-field'
import { editRowClass } from '../src/components/app/edit-row'
import { namesRecord } from '../src/lib/names-record'
import { parsePlainDate, plainDateExamples, unreadableDateMessage } from '../src/lib/plain-date'

describe('parsePlainDate', () => {
  const today = '2026-11-11'
  const read = (text: string, locale = 'en-US') => parsePlainDate(text, { today, locale })

  it('reads a month and day in this year, the US way', () => {
    expect(read('3/14')).toBe('2026-03-14')
    expect(read('03/04')).toBe('2026-03-04')
    expect(read('3-14')).toBe('2026-03-14')
  })

  it('reads a year typed after it, two digits or four', () => {
    expect(read('3/14/25')).toBe('2025-03-14')
    expect(read('3/14/2024')).toBe('2024-03-14')
  })

  it('reads the day first where the locale does', () => {
    expect(read('14/3', 'en-GB')).toBe('2026-03-14')
    expect(read('4/3', 'en-GB')).toBe('2026-03-04')
    expect(read('4/3', 'en-US')).toBe('2026-04-03')
  })

  it('reads a month by name, before or after the day, with or without a year', () => {
    expect(read('Mar 14')).toBe('2026-03-14')
    expect(read('march 14')).toBe('2026-03-14')
    expect(read('Mar. 14, 2025')).toBe('2025-03-14')
    expect(read('Sept 2')).toBe('2026-09-02')
    expect(read('14 Mar')).toBe('2026-03-14')
    expect(read('14th March 2024')).toBe('2024-03-14')
    expect(read('March 1st')).toBe('2026-03-01')
  })

  it('reads the day DateField shows, so leaving the box changes nothing', () => {
    expect(read('Nov 11, 2026')).toBe('2026-11-11')
    expect(read('11 Nov 2026', 'en-GB')).toBe('2026-11-11')
  })

  it('reads the wire format and the relative words', () => {
    expect(read('2026-03-14')).toBe('2026-03-14')
    expect(read('2026-3-4')).toBe('2026-03-04')
    expect(read('today')).toBe('2026-11-11')
    expect(read(' Today ')).toBe('2026-11-11')
    expect(read('yesterday')).toBe('2026-11-10')
    expect(read('tomorrow')).toBe('2026-11-12')
    expect(parsePlainDate('yesterday', { today: '2026-03-01' })).toBe('2026-02-28')
  })

  it('gives blank for blank, and null for what is no day', () => {
    expect(read('')).toBe('')
    expect(read('   ')).toBe('')
    expect(read('soon')).toBeNull()
    expect(read('Feb 30')).toBeNull()
    expect(read('13/1')).toBeNull()
    expect(read('2/29/2027')).toBeNull()
    expect(read('2/29/2028')).toBe('2028-02-29')
    expect(read('Ma 14')).toBeNull()
    expect(read('Foo 14')).toBeNull()
    expect(read('3/14/123')).toBeNull()
  })

  it('says what to type, in the locale order', () => {
    expect(plainDateExamples('en-US')).toBe('3/14 or Mar 14')
    expect(plainDateExamples('en-GB')).toBe('14/3 or 14 Mar')
    expect(unreadableDateMessage('en-US')).toBe('Try a date like 3/14 or Mar 14')
  })
})

describe('ChoiceButtons', () => {
  const formats = [
    { value: 'print', label: 'Print' },
    { value: 'ebook', label: 'Ebook' },
    { value: 'audio', label: 'Audio' },
  ] as const

  it('draws one pressed button per option, as a named group', () => {
    const html = renderToStaticMarkup(
      <ChoiceButtons aria-label="Format" options={formats} value="ebook" onValueChange={() => {}} />,
    )
    expect(html).toContain('role="group"')
    expect(html).toContain('aria-label="Format"')
    expect(html.match(/<button/g)).toHaveLength(3)
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(html).toMatch(/aria-pressed="true"[^>]*>Ebook</)
  })

  it('presses nothing for a value it has no option for', () => {
    const html = renderToStaticMarkup(
      <ChoiceButtons aria-label="Format" options={formats} value={null} onValueChange={() => {}} />,
    )
    expect(html).not.toContain('aria-pressed="true"')
  })
})

describe('DateField', () => {
  it('is a box with the calendar on its button, marked as a date', () => {
    const html = renderToStaticMarkup(<DateField id="due" value="2026-09-02" onChange={() => {}} locale="en-US" />)
    expect(html).toContain('data-kind="date"')
    expect(html).toMatch(/<input[^>]*id="due"/)
    expect(html).toContain('value="Sep 2, 2026"')
    expect(html).toContain('aria-label="Open calendar"')
  })

  it('shows the examples in an empty box', () => {
    const html = renderToStaticMarkup(<DateField id="due" value="" onChange={() => {}} locale="en-US" />)
    expect(html).toContain('placeholder="3/14 or Mar 14"')
  })

  it('without typing, is the button alone, still marked as a date', () => {
    const html = renderToStaticMarkup(<DateField id="due" typing={false} value="2026-09-02" onChange={() => {}} />)
    expect(html).toMatch(/<button[^>]*id="due"/)
    expect(html).not.toContain('<input')
    expect(html).toContain('data-kind="date"')
  })
})

describe('a row edited in place', () => {
  it('wears the list row hover: the table tint and the 3px primary bar', () => {
    expect(editRowClass).toContain('hover:bg-(--table-hover)')
    expect(editRowClass).toContain('hover:shadow-[inset_3px_0_0_0_var(--primary)]')
    // A finger's target on a phone or a touch screen.
    expect(editRowClass).toContain('max-md:min-h-11')
    expect(editRowClass).toContain('pointer-coarse:min-h-11')
  })
})

describe('Create from a reference picker', () => {
  const records = [{ label: 'Harbor Light' }, { label: 'The Salt Road' }]
  it('is offered only for a name no record has, ignoring case and spaces', () => {
    expect(namesRecord(records, 'harbor light ')).toBe(true)
    expect(namesRecord(records, 'Harbor')).toBe(false)
    expect(namesRecord([], 'Anything')).toBe(false)
  })
})
