import { describe, expect, it } from 'vitest'
import { formatOccurrence, formatRecurrence, todayIn } from '@/lib/recurrence-format'
import { parseRecurrencePhrase, recurrencePhrase } from '@/lib/recurrence-phrase'
import { nextOccurrences, type Recurrence } from '@/lib/recurrence'

// The phrase reader, its way back, and the label (#326). Today is Thursday
// 2026-11-12 in every test.
const TODAY = '2026-11-12'
const options = { today: TODAY, timeZone: 'America/Chicago' }

function read(text: string, more: Partial<typeof options> & { times?: string[]; start?: string } = {}): Recurrence {
  const result = parseRecurrencePhrase(text, { ...options, ...more })
  if (!result.ok) throw new Error(`${text}: ${result.error}`)
  return result.value
}

function refusal(text: string): string {
  const result = parseRecurrencePhrase(text, options)
  if (result.ok) throw new Error(`${text} was read as ${result.value.rule}`)
  return result.error
}

describe('the examples it must read', () => {
  it.each([
    ['every 3 days', 'FREQ=DAILY;INTERVAL=3'],
    ['every weekday', 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'],
    ['every 2nd tue', 'FREQ=MONTHLY;BYDAY=2TU'],
    ['every last day of the month', 'FREQ=MONTHLY;BYMONTHDAY=-1'],
    ['every jan 1', 'FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1'],
    ['every other week', 'FREQ=WEEKLY;INTERVAL=2'],
    ['every! 3 days', 'FREQ=DAILY;INTERVAL=3'],
  ])('%s', (text, rule) => {
    const value = read(text)
    expect(value.rule).toBe(rule)
    expect(value.start).toBe(TODAY)
    expect(value.times).toEqual(['09:00'])
    expect(value.timeZone).toBe('America/Chicago')
    expect(value.fromCompletion).toBe(text.startsWith('every!'))
  })

  it('at 9am, 5pm', () => {
    expect(read('every day at 9am, 5pm').times).toEqual(['09:00', '17:00'])
    expect(read('every day at 5pm and 9:30am').times).toEqual(['09:30', '17:00'])
    expect(read('every day at noon, midnight, 17:45').times).toEqual(['00:00', '12:00', '17:45'])
    expect(read('every day at 12am').times).toEqual(['00:00'])
  })

  it('starting dec 1', () => {
    expect(read('every 2nd tue starting dec 1').start).toBe('2026-12-01')
    // Already past this year: next year's.
    expect(read('every day starting mar 1').start).toBe('2027-03-01')
    expect(read('every day starting today').start).toBe(TODAY)
    expect(read('every day starting tomorrow').start).toBe('2026-11-13')
    expect(read('every day from 2027-01-05').start).toBe('2027-01-05')
    expect(read('every day starting 5 jan 2028').start).toBe('2028-01-05')
  })

  it('until mar 1', () => {
    expect(read('every day until mar 1').rule).toBe('FREQ=DAILY;UNTIL=20270301')
    // Counted from the start, wherever it's said.
    expect(read('every day until mar 1 starting apr 1').rule).toBe('FREQ=DAILY;UNTIL=20280301')
    expect(read('every day until dec 1, 2027').rule).toBe('FREQ=DAILY;UNTIL=20271201')
  })

  it('for 10 times', () => {
    expect(read('every day for 10 times').rule).toBe('FREQ=DAILY;COUNT=10')
  })

  it('all of it at once, in any order', () => {
    expect(read('Every 2nd Tue at 9am, 5pm, starting Dec 1, until Mar 1')).toEqual({
      rule: 'FREQ=MONTHLY;BYDAY=2TU;UNTIL=20270301',
      start: '2026-12-01',
      times: ['09:00', '17:00'],
      timeZone: 'America/Chicago',
      fromCompletion: false,
    })
    expect(read('every! 3 days starting dec 1 at 7:30am').start).toBe('2026-12-01')
  })
})

describe('more it reads', () => {
  it.each([
    ['daily', 'FREQ=DAILY'],
    ['weekly', 'FREQ=WEEKLY'],
    ['monthly', 'FREQ=MONTHLY'],
    ['yearly', 'FREQ=YEARLY'],
    ['weekdays', 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'],
    ['every day', 'FREQ=DAILY'],
    ['every week', 'FREQ=WEEKLY'],
    ['every 2 weeks', 'FREQ=WEEKLY;INTERVAL=2'],
    ['every 2 weeks on mon, fri', 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR'],
    ['every week on thursday', 'FREQ=WEEKLY;BYDAY=TH'],
    ['every weekend', 'FREQ=WEEKLY;BYDAY=SA,SU'],
    ['every mon', 'FREQ=WEEKLY;BYDAY=MO'],
    ['every mon, wed and fri', 'FREQ=WEEKLY;BYDAY=MO,WE,FR'],
    ['every friday and monday', 'FREQ=WEEKLY;BYDAY=MO,FR'],
    ['every other tue', 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU'],
    ['every last fri', 'FREQ=MONTHLY;BYDAY=-1FR'],
    ['every first monday of the month', 'FREQ=MONTHLY;BYDAY=1MO'],
    ['every 15th', 'FREQ=MONTHLY;BYMONTHDAY=15'],
    ['every 31st', 'FREQ=MONTHLY;BYMONTHDAY=31'],
    ['every last day', 'FREQ=MONTHLY;BYMONTHDAY=-1'],
    ['every month', 'FREQ=MONTHLY'],
    ['every 3 months on the 15th', 'FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=15'],
    ['every 2 months on the 2nd tue', 'FREQ=MONTHLY;INTERVAL=2;BYDAY=2TU'],
    ['every month on the last day', 'FREQ=MONTHLY;BYMONTHDAY=-1'],
    ['every 1 jan', 'FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1'],
    ['every feb 29th', 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29'],
    ['every december 25', 'FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=25'],
    ['every year', 'FREQ=YEARLY'],
    ['every 2 years', 'FREQ=YEARLY;INTERVAL=2'],
  ])('%s', (text, rule) => {
    expect(read(text).rule).toBe(rule)
  })

  it('keeps the field’s times and start when the phrase gives none', () => {
    const value = read('every 3 days', { times: ['07:00', '19:00'], start: '2026-10-01' })
    expect(value.times).toEqual(['07:00', '19:00'])
    expect(value.start).toBe('2026-10-01')
  })

  it('reads what it reads the same, whatever the case and spacing', () => {
    expect(read('  EVERY   2ND  TUE  ').rule).toBe('FREQ=MONTHLY;BYDAY=2TU')
    expect(read('every 3 days.').rule).toBe('FREQ=DAILY;INTERVAL=3')
  })
})

describe('what it refuses, saying why', () => {
  it.each([
    ['', 'Type how it repeats'],
    ['   ', 'Type how it repeats'],
    ['3 days', 'Start with “every”'],
    ['tomorrow at 9', 'Start with “every”'],
    ['every', 'Say how often after “every”'],
    ['every blue moon', 'Couldn’t read “blue moon”'.replace('’', "'")],
    ['every 0 days', 'never comes round'],
    ['every 6th tue', 'at most five of a weekday'],
    ['every 32nd', 'at most 31 days'],
    ['every feb 30', 'isn\'t a day of the year'],
    ['every day at', 'Say a time after “at”'],
    ['every day at 25:00', 'isn\'t a time of day'],
    ['every day at 13pm', 'isn\'t a time of day'],
    ['every day starting', 'Say a day after “starting”'],
    ['every day starting feb 30', 'isn\'t a day'],
    ['every day until someday', 'Say a day after “until”'],
    ['every day for ten times', 'Say how many after “for”'],
    ['every day for 0 times', 'never comes round'],
    ['every day until mar 1 for 3 times', 'not both'],
    ['every! 3 days for 10 times', 'can\'t stop after a number of times'],
    ['every day at 9am at 5pm', 'says “at” twice'],
    ['every other', 'Say which day after “every other”'],
    ['every week on', 'Say which day after “on”'],
    ['every month on the', 'Say which day after “on the”'],
    ['every day banana', 'Couldn\'t read “banana”'],
    ['every day until 2026-11-01', 'ends before it starts'],
  ])('%j', (text, message) => {
    expect(refusal(text)).toContain(message)
  })
})

describe('the way back: a phrase it reads again to the same rule', () => {
  it.each([
    'every 3 days',
    'every weekday at 8am',
    'every 2nd tue at 9am, 5pm',
    'every last day of the month',
    'every last fri at 6:30pm',
    'every jan 1 at noon',
    'every other week',
    'every! 3 days',
    'every 2 weeks on mon and fri',
    'every 3 months on the 15th',
    'every 2 months on the 2nd tue',
    'every day starting dec 1 until mar 1',
    'every day for 10 times',
    'every year',
    'every weekend',
    'every mon, wed and fri at 7:30am',
  ])('%s', (text) => {
    const value = read(text)
    const phrase = recurrencePhrase(value, TODAY)
    expect(phrase).not.toBeNull()
    expect(read(phrase!)).toEqual(value)
  })

  it('writes the phrase people type', () => {
    expect(recurrencePhrase(read('every 2nd tue at 9am, 5:30pm starting dec 1'), TODAY)).toBe(
      'every 2nd tue at 9am, 5:30pm starting dec 1',
    )
    expect(recurrencePhrase(read('every! 3 days until mar 1, 2028'), TODAY)).toBe('every! 3 days at 9am until mar 1, 2028')
  })

  it('says null for a rule it has no phrase for', () => {
    const value: Recurrence = { rule: 'FREQ=MONTHLY;BYMONTHDAY=1,15', start: TODAY, times: ['09:00'], timeZone: 'UTC', fromCompletion: false }
    expect(recurrencePhrase(value, TODAY)).toBeNull()
  })
})

describe('the label', () => {
  const label = (text: string) => formatRecurrence(read(text), { locale: 'en-US' })

  it.each([
    ['every 2nd tue at 9am', 'Every 2nd Tue at 9:00 AM'],
    ['every 3 days', 'Every 3 days at 9:00 AM'],
    ['every day at 9am, 5:30pm', 'Every day at 9:00 AM and 5:30 PM'],
    ['every day at 8am, noon, 6pm', 'Every day at 8:00 AM, 12:00 PM and 6:00 PM'],
    ['every weekday at 8am', 'Every weekday at 8:00 AM'],
    ['every weekend', 'Every weekend at 9:00 AM'],
    ['every mon, wed and fri', 'Every Mon, Wed and Fri at 9:00 AM'],
    // A week with no days falls on the start's weekday (Thursday).
    ['every other week', 'Every other week on Thu at 9:00 AM'],
    ['every week', 'Every Thu at 9:00 AM'],
    ['every 3 weeks on mon', 'Every 3 weeks on Mon at 9:00 AM'],
    ['every last fri', 'Every last Fri at 9:00 AM'],
    ['every last day of the month', 'Every last day of the month at 9:00 AM'],
    ['every 15th', 'Every 15th at 9:00 AM'],
    ['every 22nd', 'Every 22nd at 9:00 AM'],
    ['every 11th', 'Every 11th at 9:00 AM'],
    ['every month', 'Every 12th at 9:00 AM'],
    ['every 3 months on the 15th', 'Every 3 months on the 15th at 9:00 AM'],
    ['every jan 1', 'Every Jan 1 at 9:00 AM'],
    ['every year', 'Every Nov 12 at 9:00 AM'],
    ['every 2 years', 'Every other year on Nov 12 at 9:00 AM'],
    ['every 3 years', 'Every 3 years on Nov 12 at 9:00 AM'],
    ['every! 3 days', 'Every 3 days after done, at 9:00 AM'],
    ['every day until mar 1', 'Every day at 9:00 AM, until Mar 1, 2027'],
    ['every day for 10 times', 'Every day at 9:00 AM, 10 times'],
  ])('%s → %s', (text, expected) => {
    expect(label(text)).toBe(expected)
  })

  it('leaves the times out when asked, and shows a rule it cannot read as stored', () => {
    expect(formatRecurrence(read('every 2nd tue'), { locale: 'en-US', times: false })).toBe('Every 2nd Tue')
    const odd: Recurrence = { rule: 'FREQ=SECONDLY', start: TODAY, times: ['09:00'], timeZone: 'UTC', fromCompletion: false }
    expect(formatRecurrence(odd)).toBe('FREQ=SECONDLY')
  })
})

describe('an occurrence', () => {
  it('is its day and time in the rule’s zone, the year only when it isn’t this one', () => {
    const now = new Date('2026-11-12T18:00:00Z')
    const [first] = nextOccurrences(read('every 2nd tue at 9am'), now, 1)
    expect(formatOccurrence(first, 'America/Chicago', { locale: 'en-US', now })).toBe('Tue, Dec 8, 9:00 AM')
    const [later] = nextOccurrences(read('every jan 1'), now, 1)
    expect(formatOccurrence(later, 'America/Chicago', { locale: 'en-US', now })).toBe('Fri, Jan 1, 2027, 9:00 AM')
    expect(todayIn('America/Chicago', new Date('2026-11-13T03:00:00Z'))).toBe('2026-11-12')
  })
})
