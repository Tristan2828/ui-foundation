// parseQuickAdd (src/lib/quick-add.ts): one line read into its title,
// day, time, repeat and the app's tokens, each with its span. Made-up
// lines; today is Friday 2026-11-20.
import { describe, expect, it } from 'vitest'
import { parseQuickAdd, type QuickAddOptions } from '../src/lib/quick-add'

const TOKENS: QuickAddOptions['tokens'] = [
  { key: 'list', symbol: '#', label: 'List', names: ['Home', 'Errands', 'Garden'] },
  { key: 'place', symbol: '@', label: 'Place', names: ['At the Desk', 'Out and About'] },
  { key: 'block', symbol: '/', label: 'Block', names: ['Morning', 'Afternoon', 'Evening'] },
]
const OPTIONS: QuickAddOptions = { today: '2026-11-20', timeZone: 'America/New_York', tokens: TOKENS }
const read = (text: string, more: Partial<QuickAddOptions> = {}) => parseQuickAdd(text, { ...OPTIONS, ...more })

describe('parseQuickAdd: days in words', () => {
  it.each([
    ['call the shop today', '2026-11-20'],
    ['call the shop tomorrow', '2026-11-21'],
    ['call the shop mon', '2026-11-23'],
    ['call the shop on monday', '2026-11-23'],
    ['call the shop fri', '2026-11-27'],
    ['call the shop next friday', '2026-11-27'],
    ['call the shop in 3 days', '2026-11-23'],
    ['call the shop in 2 weeks', '2026-12-04'],
    ['call the shop in a week', '2026-11-27'],
    ['call the shop Mar 14', '2027-03-14'],
    ['call the shop 14 march', '2027-03-14'],
    ['call the shop dec 1', '2026-12-01'],
    ['call the shop 3/14', '2027-03-14'],
    ['call the shop 11/20', '2026-11-20'],
    ['call the shop 12/1/27', '2027-12-01'],
  ])('%s', (text, day) => {
    const result = read(text)
    expect(result.date).toEqual({ value: day, span: expect.any(Object) })
    expect(result.title).toBe('call the shop')
    const span = result.date!.span!
    expect(text.slice(span.start, span.end)).toBe(text.slice('call the shop '.length))
  })

  it('reads 3/4 day first where the locale writes it so', () => {
    expect(read('pay 3/4', { locale: 'en-GB' }).date?.value).toBe('2027-04-03')
    expect(read('pay 3/4', { locale: 'en-US' }).date?.value).toBe('2027-03-04')
  })

  it('leaves what is not a day in the title', () => {
    for (const text of ['open 13/45', 'feb 30 note', 'monkey business', 'saturnine', 'in 3 hours']) {
      const result = read(text)
      expect(result.date).toBeNull()
      expect(result.title).toBe(text)
    }
  })

  it('reads the first day and leaves a second in the title', () => {
    const result = read('move tomorrow to friday')
    expect(result.date?.value).toBe('2026-11-21')
    expect(result.title).toBe('move to friday')
  })
})

describe('parseQuickAdd: times', () => {
  it.each([
    ['ring back at 3pm', '15:00'],
    ['ring back 3:30 pm', '15:30'],
    ['ring back at 15:45', '15:45'],
    ['ring back at noon', '12:00'],
    ['ring back 12am', '00:00'],
  ])('%s', (text, time) => {
    const result = read(text)
    expect(result.time?.value).toBe(time)
    expect(result.title).toBe('ring back')
    // A time with no day is today.
    expect(result.date).toEqual({ value: '2026-11-20', span: null })
  })

  it('keeps a time and a day apart', () => {
    const result = read('dentist dec 9 at 2:30pm')
    expect(result.date?.value).toBe('2026-12-09')
    expect(result.time?.value).toBe('14:30')
    expect(result.title).toBe('dentist')
    expect(result.reads.map((r) => [r.kind, r.text])).toEqual([
      ['date', 'dec 9'],
      ['time', 'at 2:30pm'],
    ])
  })

  it('leaves a bare number and a noon with no "at" in the title', () => {
    expect(read('buy 3 apples').time).toBeNull()
    expect(read('a noon walk').time).toBeNull()
    expect(read('at 13pm').time).toBeNull()
  })
})

describe('parseQuickAdd: repeats', () => {
  it('reads every! (from completion) as long as the phrase goes', () => {
    const result = read('wipe the shelves every! 2 weeks #home')
    expect(result.recurrence?.value).toMatchObject({ rule: 'FREQ=WEEKLY;INTERVAL=2', fromCompletion: true })
    expect(result.title).toBe('wipe the shelves')
    expect(result.tokens.map((t) => t.name)).toEqual(['Home'])
    const span = result.recurrence!.span
    expect('wipe the shelves every! 2 weeks #home'.slice(span.start, span.end)).toBe('every! 2 weeks')
    // No day typed: first due on its start.
    expect(result.date).toEqual({ value: '2026-11-20', span: null })
  })

  it('takes a typed day as the start, and the line time as its time', () => {
    const result = read('wipe the shelves monday every! 2 weeks at 8am')
    expect(result.recurrence?.value).toMatchObject({ start: '2026-11-23', times: ['08:00'] })
    expect(result.date?.value).toBe('2026-11-23')
    expect(result.time?.value).toBe('08:00')
    expect(result.title).toBe('wipe the shelves')
  })

  it('reads a time out of the phrase', () => {
    const result = read('water the ferns every mon and thu at 7pm')
    expect(result.recurrence?.value.rule).toBe('FREQ=WEEKLY;BYDAY=MO,TH')
    expect(result.recurrence?.value.times).toEqual(['19:00'])
    expect(result.time?.value).toBe('19:00')
    // First due on the first Monday or Thursday on or after today.
    expect(result.date).toEqual({ value: '2026-11-23', span: null })
    expect(result.reads.map((r) => r.kind)).toEqual(['recurrence'])
  })

  it('falls on its day when it says one', () => {
    expect(read('pay the bill every 25th').date?.value).toBe('2026-11-25')
    expect(read('bins every sunday').date?.value).toBe('2026-11-22')
    expect(read('report weekly').recurrence?.value.rule).toBe('FREQ=WEEKLY')
  })

  it('uses the given times when nothing says one', () => {
    expect(read('stretch daily', { times: ['10:00'] }).recurrence?.value.times).toEqual(['10:00'])
    expect(read('stretch daily').recurrence?.value.times).toEqual(['09:00'])
    expect(read('stretch daily').time).toBeNull()
  })

  it('leaves "every" with nothing it can read in the title', () => {
    const result = read('every little thing')
    expect(result.recurrence).toBeNull()
    expect(result.title).toBe('every little thing')
  })
})

describe('parseQuickAdd: tokens', () => {
  it('matches a few letters, the start of a name first', () => {
    const result = read('fix the gate #gar @out /aft')
    expect(result.tokens.map((t) => [t.key, t.name, t.label, t.text])).toEqual([
      ['list', 'Garden', 'List', '#gar'],
      ['place', 'Out and About', 'Place', '@out'],
      ['block', 'Afternoon', 'Block', '/aft'],
    ])
    expect(result.title).toBe('fix the gate')
  })

  it('falls back to letters anywhere in a name, ignoring spaces', () => {
    expect(read('note @desk').tokens[0]?.name).toBe('At the Desk')
    expect(read('note @outand').tokens[0]?.name).toBe('Out and About')
  })

  it('leaves a symbol that names nothing, or sits inside a word, in the title', () => {
    expect(read('tag #zzz').title).toBe('tag #zzz')
    expect(read('mail a@home.example').tokens).toEqual([])
    expect(read('1/2 cup').tokens).toEqual([])
    expect(parseQuickAdd('tidy #home', { today: '2026-11-20', timeZone: 'UTC' }).title).toBe('tidy #home')
  })

  it('reads one token of each kind, the first that names something', () => {
    const result = read('sort #nope #err #home')
    expect(result.tokens.map((t) => t.name)).toEqual(['Errands'])
    expect(result.title).toBe('sort #nope #home')
  })
})

describe('parseQuickAdd: ignored spans', () => {
  it('never reads an ignored span, so its words stay in the title', () => {
    const text = 'read the sun article'
    expect(read(text).date?.value).toBe('2026-11-22')
    const result = read(text, { ignore: [{ start: 9, end: 12 }] })
    expect(result.date).toBeNull()
    expect(result.title).toBe(text)
  })

  it('reads the next match past an ignored one', () => {
    const result = read('fri plan for mon', { ignore: [{ start: 0, end: 3 }] })
    expect(result.date?.value).toBe('2026-11-23')
    expect(result.title).toBe('fri plan for')
  })

  it('gives a repeat back whole', () => {
    const result = read('report weekly', { ignore: [{ start: 7, end: 13 }] })
    expect(result.recurrence).toBeNull()
    expect(result.title).toBe('report weekly')
  })
})

describe('parseQuickAdd: the whole line', () => {
  it('is a title when nothing reads', () => {
    expect(read('  just   a   title ')).toEqual({ title: 'just a title', date: null, time: null, recurrence: null, tokens: [], reads: [] })
  })

  it('marks every read in the line order', () => {
    const text = 'pay rent tomorrow at 3pm #home @desk'
    const result = read(text)
    expect(result.title).toBe('pay rent')
    expect(result.reads.map((r) => text.slice(r.start, r.end))).toEqual(['tomorrow', 'at 3pm', '#home', '@desk'])
  })
})
