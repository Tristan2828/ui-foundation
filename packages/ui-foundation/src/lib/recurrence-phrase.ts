// How a repeat is typed (#326): a task app's phrases ("every 2nd tue at
// 9am", "every! 3 days", "every jan 1 until mar 1") read into a Recurrence
// as you type, with a clear refusal for what can't be read, and the way
// back, a Recurrence written as a phrase the reader takes again.
//
// What it reads, after "every" (or "every!", repeat from when it's done):
//
// - an interval: `day`, `3 days`, `other week`, `2 months`, `year`
//   (`daily`, `weekly`, `monthly`, `yearly` alone too); a week can take
//   `on mon, fri`, a month `on the 15th`, `on the 2nd tue`, `on the last day`
// - weekdays: `weekday`, `weekend`, `mon`, `mon, wed and fri`, `other tue`
// - a day of the month: `15th`, `2nd tue`, `last fri`, `last day of the month`
// - a day of the year: `jan 1`, `1 jan`
//
// then, in any order: `at 9am, 5:30pm` (`noon`, `17:00`), `starting dec 1`
// (`from`), `until mar 1` (`ending`), `for 10 times`, `weeks start sun`
// (WKST, 4.114). A day with no year is the next one: from today for
// `starting`, from the start for `until`.
import {
  formatRule,
  normalizeRecurrence,
  parseRule,
  RecurrenceError,
  WEEKDAY_CODES,
  weekStartMatters,
  type Recurrence,
  type RuleParts,
  type WeekdayCode,
} from '@/lib/recurrence'

export type PhraseOptions = {
  /** Today, `'YYYY-MM-DD'` in the rule's zone: where a day with no year counts from. */
  today: string
  /** The IANA zone the rule is read in. */
  timeZone: string
  /** The times when the phrase has no "at" (the field's current ones). Defaults to 09:00. */
  times?: string[]
  /** The start when the phrase has no "starting". Defaults to `today`. */
  start?: string
  /**
   * The day weeks start on (4.114): a weekly rule read with no "weeks
   * start" gets it as its WKST (`'SU'` adds `WKST=SU`). Defaults to
   * Monday, which is no WKST.
   */
  weekStart?: WeekdayCode
  /**
   * Whether the phrase may say its times ("at 9am"; the default). False
   * refuses them, for a record whose times are fields of its own: the
   * rule keeps `times` (or 09:00).
   */
  readTimes?: boolean
}

export type PhraseResult = { ok: true; value: Recurrence } | { ok: false; error: string }

const WEEKDAY_WORDS: [RegExp, number][] = [
  [/^mon(day)?$/, 0],
  [/^tue(s|sday)?$/, 1],
  [/^wed(s|nesday)?$/, 2],
  [/^thu(r|rs|rsday)?$/, 3],
  [/^fri(day)?$/, 4],
  [/^sat(urday)?$/, 5],
  [/^sun(day)?$/, 6],
]
const MONTH_WORDS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const ORDINAL_WORDS: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, last: -1 }
const WEEKDAY = String.raw`(?:mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)`
const MONTH = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`
const ORDINAL = String.raw`(?:(\d{1,2})(?:st|nd|rd|th)|first|second|third|fourth|fifth|last)`
const EXAMPLES = '“every 3 days”, “every 2nd tue” or “every jan 1”'

const weekdayOf = (word: string) => WEEKDAY_WORDS.find(([pattern]) => pattern.test(word))?.[1] ?? -1
const monthOf = (word: string) => MONTH_WORDS.indexOf(word.slice(0, 3)) + 1
const pad = (value: number) => String(value).padStart(2, '0')

class Refusal extends Error {}

/** A cursor over the phrase: each read skips spaces first and either matches where it is or moves nothing. */
class Reader {
  at = 0
  readonly text: string
  constructor(text: string) {
    this.text = text
  }

  read(pattern: string): RegExpExecArray | null {
    const expression = new RegExp(String.raw`\s*(?:${pattern})(?![a-z0-9])`, 'y')
    expression.lastIndex = this.at
    const match = expression.exec(this.text)
    if (match) this.at = expression.lastIndex
    return match
  }

  get done() {
    return this.text.slice(this.at).trim() === ''
  }

  get rest() {
    return this.text.slice(this.at).trim()
  }
}

function ordinalValue(word: string, digits: string | undefined): number {
  return digits ? Number(digits) : ORDINAL_WORDS[word]
}

function weekdayList(reader: Reader): number[] {
  const first = reader.read(WEEKDAY)
  if (!first) return []
  const days = [weekdayOf(first[0].trim())]
  for (;;) {
    const mark = reader.at
    const next = reader.read(String.raw`(?:,\s*and|,|and|&)\s*(${WEEKDAY})`)
    if (!next) {
      reader.at = mark
      break
    }
    days.push(weekdayOf(next[1]))
  }
  return [...new Set(days)].sort()
}

function checkNth(nth: number, text: string): number {
  if (nth === 0 || nth > 5) throw new Refusal(`“${text}”: a month has at most five of a weekday.`)
  return nth
}

function checkMonthDay(day: number): number {
  if (day < 1 || day > 31) throw new Refusal('A month has at most 31 days.')
  return day
}

type Body = Omit<RuleParts, 'until' | 'count' | 'weekStart'>

/** What comes after "every": the rule's frequency and days. */
function readBody(reader: Reader): Body {
  const base: Body = { freq: 'DAILY', interval: 1, byDay: [], byMonthDay: [], byMonth: [] }
  let match = reader.read(String.raw`(\d+|other)\s+(day|week|month|year)s?`)
  if (match) {
    const interval = match[1] === 'other' ? 2 : Number(match[1])
    if (interval < 1) throw new Refusal(`“every ${match[1]} ${match[2]}s” never comes round.`)
    if (interval > 999) throw new Refusal('That interval is too long.')
    return readOn(reader, { ...base, interval, freq: unit(match[2]) })
  }
  match = reader.read(String.raw`(day|week|month|year)`)
  if (match) return readOn(reader, { ...base, freq: unit(match[1]) })
  if (reader.read(String.raw`(?:weekday|workday)s?`)) return { ...base, freq: 'WEEKLY', byDay: [0, 1, 2, 3, 4].map(plainDay) }
  if (reader.read(String.raw`weekends?`)) return { ...base, freq: 'WEEKLY', byDay: [5, 6].map(plainDay) }
  match = reader.read(String.raw`last\s+day(?:\s+of\s+(?:the\s+)?month)?`)
  if (match) return { ...base, freq: 'MONTHLY', byMonthDay: [-1] }
  match = reader.read(String.raw`${ORDINAL}\s+(${WEEKDAY})(?:\s+of\s+(?:the\s+|every\s+)?month)?`)
  if (match) {
    const word = match[0].trim().split(/\s+/)[0]
    const nth = checkNth(ordinalValue(word, match[1]), match[0].trim())
    return { ...base, freq: 'MONTHLY', byDay: [{ nth, day: weekdayOf(match[2]) }] }
  }
  match = reader.read(String.raw`(\d{1,2})(?:st|nd|rd|th)?\s+(${MONTH})|(${MONTH})\s+(\d{1,2})(?:st|nd|rd|th)?`)
  if (match) {
    const month = monthOf(match[2] ?? match[3])
    const day = Number(match[1] ?? match[4])
    if (day < 1 || day > [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]) {
      throw new Refusal(`“${match[0].trim()}” isn't a day of the year.`)
    }
    return { ...base, freq: 'YEARLY', byMonth: [month], byMonthDay: [day] }
  }
  match = reader.read(String.raw`(\d{1,2})(?:st|nd|rd|th)(?:\s+day)?(?:\s+of\s+(?:the\s+|every\s+)?month)?`)
  if (match) return { ...base, freq: 'MONTHLY', byMonthDay: [checkMonthDay(Number(match[1]))] }
  if (reader.read('other')) {
    const days = weekdayList(reader)
    if (!days.length) throw new Refusal('Say which day after “every other”, like “every other tue”, or “every other week”.')
    return { ...base, freq: 'WEEKLY', interval: 2, byDay: days.map(plainDay) }
  }
  const days = weekdayList(reader)
  if (days.length) return { ...base, freq: 'WEEKLY', byDay: days.map(plainDay) }
  throw new Refusal(unread(reader))
}

const plainDay = (day: number) => ({ nth: null, day })
const unit = (word: string): Body['freq'] =>
  word === 'day' ? 'DAILY' : word === 'week' ? 'WEEKLY' : word === 'month' ? 'MONTHLY' : 'YEARLY'

/** A week's "on mon, fri", a month's "on the 15th" / "on the 2nd tue" / "on the last day". */
function readOn(reader: Reader, body: Body): Body {
  if (body.freq === 'WEEKLY') {
    const mark = reader.at
    if (reader.read('on')) {
      const days = weekdayList(reader)
      if (!days.length) throw new Refusal('Say which day after “on”, like “every week on mon”.')
      return { ...body, byDay: days.map(plainDay) }
    }
    reader.at = mark
  }
  if (body.freq === 'MONTHLY') {
    const mark = reader.at
    if (reader.read(String.raw`on(?:\s+the)?`)) {
      if (reader.read(String.raw`last\s+day`)) return { ...body, byMonthDay: [-1] }
      const nth = reader.read(String.raw`${ORDINAL}\s+(${WEEKDAY})`)
      if (nth) {
        const word = nth[0].trim().split(/\s+/)[0]
        return { ...body, byDay: [{ nth: checkNth(ordinalValue(word, nth[1]), nth[0].trim()), day: weekdayOf(nth[2]) }] }
      }
      const day = reader.read(String.raw`(\d{1,2})(?:st|nd|rd|th)?`)
      if (day) return { ...body, byMonthDay: [checkMonthDay(Number(day[1]))] }
      throw new Refusal('Say which day after “on the”, like “every month on the 15th”.')
    }
    reader.at = mark
  }
  return body
}

function unread(reader: Reader): string {
  const word = reader.rest.split(/[\s,]+/).slice(0, 3).join(' ')
  return `Couldn't read “${word}”. Try ${EXAMPLES}.`
}

function readTime(reader: Reader): string | null {
  const match = reader.read(String.raw`noon|midnight|(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|a|p)?`)
  if (!match) return null
  const word = match[0].trim()
  if (word === 'noon') return '12:00'
  if (word === 'midnight') return '00:00'
  let hour = Number(match[1])
  const minute = match[2] ? Number(match[2]) : 0
  const half = match[3]?.[0]
  if (half) {
    if (hour < 1 || hour > 12) throw new Refusal(`“${word}” isn't a time of day.`)
    hour = (hour % 12) + (half === 'p' ? 12 : 0)
  }
  if (hour > 23 || minute > 59) throw new Refusal(`“${word}” isn't a time of day.`)
  return `${pad(hour)}:${pad(minute)}`
}

function readTimes(reader: Reader): string[] {
  const first = readTime(reader)
  if (!first) throw new Refusal('Say a time after “at”, like “at 9am”.')
  const times = [first]
  for (;;) {
    const mark = reader.at
    if (!reader.read(String.raw`,\s*and|,|and|&`)) break
    const next = readTime(reader)
    if (!next) {
      reader.at = mark
      break
    }
    times.push(next)
  }
  return times
}

const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
const DAYS_IN = (year: number, month: number) => [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]

function addDays(day: string, count: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + count * 86_400_000).toISOString().slice(0, 10)
}

/** A day: `today`, `tomorrow`, `2026-12-01`, `dec 1`, `1 dec`, `dec 1, 2027`; no year is the next one on or after `from`. */
function readDate(reader: Reader, from: string, after: string): string {
  if (reader.read('today')) return from
  if (reader.read('tomorrow')) return addDays(from, 1)
  const iso = reader.read(String.raw`(\d{4})-(\d{2})-(\d{2})`)
  if (iso) {
    const [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    if (month < 1 || month > 12 || day < 1 || day > DAYS_IN(year, month)) throw new Refusal(`“${iso[0].trim()}” isn't a day.`)
    return iso[0].trim()
  }
  const match = reader.read(
    String.raw`(?:(${MONTH})\s+(\d{1,2})(?:st|nd|rd|th)?|(\d{1,2})(?:st|nd|rd|th)?\s+(${MONTH}))(?:,?\s+(\d{4}))?`,
  )
  if (!match) throw new Refusal(`Say a day after “${after}”, like “${after} dec 1”.`)
  const month = monthOf(match[1] ?? match[4])
  const day = Number(match[2] ?? match[3])
  const text = match[0].trim()
  if (match[5]) {
    const year = Number(match[5])
    if (day < 1 || day > DAYS_IN(year, month)) throw new Refusal(`“${text}” isn't a day.`)
    return `${year}-${pad(month)}-${pad(day)}`
  }
  if (day < 1 || day > (month === 2 ? 29 : DAYS_IN(2001, month))) throw new Refusal(`“${text}” isn't a day.`)
  // The next one on or after `from` (Feb 29: the next leap year's).
  for (let year = Number(from.slice(0, 4)); ; year++) {
    if (day > DAYS_IN(year, month)) continue
    const candidate = `${year}-${pad(month)}-${pad(day)}`
    if (candidate >= from) return candidate
  }
}

/**
 * Reads a phrase into a Recurrence, or says why it can't. Live as you
 * type: call it on every change and show the result's label or its error.
 */
export function parseRecurrencePhrase(text: string, options: PhraseOptions): PhraseResult {
  try {
    return { ok: true, value: readPhrase(text, options) }
  } catch (error) {
    if (error instanceof Refusal || error instanceof RecurrenceError) return { ok: false, error: error.message }
    throw error
  }
}

function readPhrase(text: string, options: PhraseOptions): Recurrence {
  const normal = text.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim().replace(/[.]$/, '')
  if (!normal) throw new Refusal(`Type how it repeats, like ${EXAMPLES}.`)
  const reader = new Reader(normal)
  let fromCompletion = false
  let body: Body
  const shortcut = reader.read(String.raw`(daily|weekly|monthly|yearly|annually|weekdays)`)
  if (shortcut) {
    const word = shortcut[1]
    body =
      word === 'weekdays'
        ? { freq: 'WEEKLY', interval: 1, byDay: [0, 1, 2, 3, 4].map(plainDay), byMonthDay: [], byMonth: [] }
        : {
            freq: word === 'daily' ? 'DAILY' : word === 'weekly' ? 'WEEKLY' : word === 'monthly' ? 'MONTHLY' : 'YEARLY',
            interval: 1,
            byDay: [],
            byMonthDay: [],
            byMonth: [],
          }
    body = readOn(reader, body)
  } else {
    const every = /^\s*every(!)?/.exec(normal)
    if (!every) throw new Refusal('Start with “every”, like “every 3 days” or “every mon”.')
    reader.at = every[0].length
    fromCompletion = !!every[1]
    if (reader.done) throw new Refusal(`Say how often after “every”, like ${EXAMPLES}.`)
    body = readBody(reader)
  }

  let times: string[] | undefined
  let start: string | undefined
  let untilAt: number | undefined
  let untilText: string | undefined
  let count: number | null = null
  let weekStart: number | undefined
  const seen = new Set<string>()
  const once = (word: string) => {
    if (seen.has(word)) throw new Refusal(`It says “${word}” twice.`)
    seen.add(word)
  }
  while (!reader.done) {
    reader.read(',')
    if (reader.done) break
    const week = reader.read(String.raw`weeks?\s+(?:start|starts|starting|begin|begins|beginning)(?:\s+on)?\s+(${WEEKDAY})`)
    if (week) {
      once('weeks start')
      weekStart = weekdayOf(week[1])
    } else if (reader.read('at')) {
      if (options.readTimes === false) throw new Refusal('The times are set on their own here: leave out “at …”.')
      once('at')
      times = readTimes(reader)
    } else if (reader.read('(?:starting|starts|start|from)(?:\\s+on)?')) {
      once('starting')
      start = readDate(reader, options.today, 'starting')
    } else if (reader.read('(?:until|till|ending|ends)(?:\\s+on)?')) {
      once('until')
      // Read once the start is known: a day with no year counts from it.
      untilAt = reader.at
      readDate(reader, options.today, 'until')
      untilText = reader.text.slice(untilAt, reader.at)
    } else if (reader.read('for')) {
      once('for')
      const match = reader.read(String.raw`(\d+)\s+times?`)
      if (!match) throw new Refusal('Say how many after “for”, like “for 10 times”.')
      count = Number(match[1])
      if (count < 1) throw new Refusal('“for 0 times” never comes round.')
      if (count > 9999) throw new Refusal('That is too many times.')
    } else {
      throw new Refusal(unread(reader))
    }
  }
  if (count !== null && untilText !== undefined) throw new Refusal('Use “until” or “for N times”, not both.')
  if (count !== null && fromCompletion) {
    throw new Refusal('“every!” repeats from when it\'s done, so it can\'t stop after a number of times. Use “until”.')
  }
  const first = start ?? options.start ?? options.today
  const until = untilText === undefined ? null : readDate(new Reader(untilText), first, 'until')
  const defaultStart = body.freq === 'WEEKLY' && options.weekStart ? WEEKDAY_CODES.indexOf(options.weekStart) : 0
  return normalizeRecurrence({
    rule: formatRule({ ...body, until, count, weekStart: weekStart ?? defaultStart }),
    start: first,
    times: times ?? options.times ?? ['09:00'],
    timeZone: options.timeZone,
    fromCompletion,
  })
}

// ------------------------------------------------------- the way back

const DAY_WORDS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const ordinal = (value: number) => {
  const tens = value % 100
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][value % 10] ?? 'th'
  return `${value}${suffix}`
}
const listWords = (words: string[], and = 'and') =>
  words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} ${and} ${words[words.length - 1]}`

function phraseTime(time: string): string {
  const [hour, minute] = time.split(':').map(Number)
  if (hour === 12 && minute === 0) return 'noon'
  const half = hour < 12 ? 'am' : 'pm'
  const clock = hour % 12 || 12
  return minute ? `${clock}:${pad(minute)}${half}` : `${clock}${half}`
}

function phraseDate(day: string, today?: string): string {
  const [year, month, date] = day.split('-').map(Number)
  const words = `${MONTH_WORDS[month - 1]} ${date}`
  return today && Number(today.slice(0, 4)) === year && day >= today ? words : `${words}, ${year}`
}

const WEEKDAYS_MO_FR = 'MO,TU,WE,TH,FR'

/** The days part of a rule as a phrase ("every 2nd tue"), or null for one the reader can't write. */
function phraseBody(parts: RuleParts): string | null {
  const first = parts.weekStart ?? 0
  // A week's days from its first day: "on sun and wed" when weeks start on Sunday.
  const inWeek = (days: RuleParts['byDay']) => [...days].sort((a, b) => ((a.day - first + 7) % 7) - ((b.day - first + 7) % 7))
  const { freq, interval, byDay, byMonthDay, byMonth } = parts
  const codes = byDay.map(({ day }) => WEEKDAY_CODES[day]).join(',')
  const plain = byDay.every(({ nth }) => nth === null)
  const unitWord = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' }[freq]
  const every = interval === 1 ? unitWord : interval === 2 ? `other ${unitWord}` : `${interval} ${unitWord}s`
  if (byMonth.length && !(freq === 'YEARLY' && byMonth.length === 1)) return null
  switch (freq) {
    case 'DAILY':
      return byDay.length || byMonthDay.length ? null : every
    case 'WEEKLY': {
      if (!byDay.length) return every
      if (!plain) return null
      const names = listWords(inWeek(byDay).map(({ day }) => DAY_WORDS[day]))
      if (interval === 1) return codes === WEEKDAYS_MO_FR ? 'weekday' : codes === 'SA,SU' ? 'weekend' : names
      return `${every} on ${names}`
    }
    case 'MONTHLY': {
      if (byDay.length && byMonthDay.length) return null
      let on: string | null = null
      if (byDay.length === 1 && byDay[0].nth !== null) {
        on = `${byDay[0].nth === -1 ? 'last' : ordinal(byDay[0].nth)} ${DAY_WORDS[byDay[0].day]}`
      } else if (byMonthDay.length === 1) {
        on = byMonthDay[0] === -1 ? 'last day' : byMonthDay[0] > 0 ? ordinal(byMonthDay[0]) : null
        if (on === null) return null
      } else if (byDay.length || byMonthDay.length) {
        return null
      }
      if (on === null) return every
      if (interval === 1) return on === 'last day' ? 'last day of the month' : on
      return `${every} on the ${on}`
    }
    case 'YEARLY':
      if (byDay.length) return null
      if (!byMonth.length && !byMonthDay.length) return every
      if (interval !== 1 || byMonth.length !== 1 || byMonthDay.length !== 1 || byMonthDay[0] < 1) return null
      return `${MONTH_WORDS[byMonth[0] - 1]} ${byMonthDay[0]}`
  }
}

export type RecurrencePhraseOptions = {
  /** Leave out "at …" (false), for a field whose times are the record's own. */
  times?: boolean
  /**
   * The week start the phrase is read back with (PhraseOptions'
   * `weekStart`; Monday when left out). An every-N-weeks rule whose WKST
   * differs says it: "…, weeks start sun".
   */
  weekStart?: WeekdayCode
}

/**
 * The Recurrence as a phrase parseRecurrencePhrase reads back to it
 * ("every 2nd tue at 9am until mar 1"), or null for a rule it can't say
 * (several month days, BYMONTH on a daily rule). The start is said only
 * when it's after `today`.
 */
export function recurrencePhrase(value: Recurrence, today?: string, options: RecurrencePhraseOptions = {}): string | null {
  let parts: RuleParts
  try {
    parts = parseRule(value.rule)
  } catch {
    return null
  }
  const body = phraseBody(parts)
  if (body === null) return null
  const words = [`${value.fromCompletion ? 'every!' : 'every'} ${body}`]
  if (options.times !== false) words.push(`at ${value.times.map(phraseTime).join(', ')}`)
  if (today && value.start > today) words.push(`starting ${phraseDate(value.start, today)}`)
  if (parts.until) words.push(`until ${phraseDate(parts.until, today && value.start > today ? value.start : today)}`)
  if (parts.count !== null) words.push(`for ${parts.count} times`)
  const weekStart = parts.weekStart ?? 0
  if (weekStartMatters(parts) && weekStart !== WEEKDAY_CODES.indexOf(options.weekStart ?? 'MO')) {
    return `${words.join(' ')}, weeks start ${DAY_WORDS[weekStart]}`
  }
  return words.join(' ')
}

export { ordinal as ordinalWord, listWords }
