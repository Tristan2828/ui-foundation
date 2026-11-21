// One line typed into a quick add ("pay rent tomorrow at 3pm #home",
// "water plants every! 3 days @out") read into its parts as you type: the
// title left over, a day, a time, a repeat and the app's own tokens, each
// with the span of the line it came from, so a box can mark what it read
// and give a misread back to the title.
//
// What it reads, anywhere in the line:
//
// - the app's tokens: a symbol and a few letters of a name (`#ch` for
//   Chores, `@up` for "Up and Moving"); the name's start first, then
//   anywhere in it, in the order the app gave the names
// - a repeat: `every …` / `every! …` (from completion) and `daily`,
//   `weekly`, `monthly`, `yearly`, `weekdays`, read by
//   parseRecurrencePhrase, as long a phrase as it takes ("every mon at
//   9am until mar 1")
// - a time: `3pm`, `3:30 pm`, `at 15:00`, `at noon`
// - a day: `today`, `tomorrow`, a weekday (`fri`, `friday`: the next one
//   after today), `next friday` (the same day), `in 3 days`, `in 2
//   weeks`, `Mar 14`, `14 Mar`, `3/14` (`14/3` where the locale writes the
//   day first), each with an optional `on` before it. A day with no year
//   is the next one on or after today.
//
// A time with no day is today. A repeat with no day is first due on the
// first day it falls (on or after today); a day typed beside a repeat is
// where it starts. A repeat with no "at" takes the line's time, else
// `options.times`. Each part is read once: a second date stays in the
// title. A span the caller marks as ignored (QuickAddInput's ✕) is never
// read, so its words stay in the title.
import { dayFirst, localToPlainDate, type PlainDate } from '@/lib/plain-date'
import { atLocal, nextOccurrence, wallClock, type Recurrence, type WeekdayCode } from '@/lib/recurrence'
import { parseRecurrencePhrase } from '@/lib/recurrence-phrase'

/** One kind of the app's own token: a symbol and the names it picks from. */
export type QuickAddToken = {
  /** What it sets, as the app names it (`'list'`, `'place'`). */
  key: string
  /** The character typed before it (`'#'`, `'@'`, `'/'`). */
  symbol: string
  /** The chip's label (`'List'`). Defaults to the key. */
  label?: string
  /** The names to pick from, best first: a few letters pick the first that fits. */
  names: string[]
}

/** Where in the line a part was read: `text.slice(start, end)`. */
export type QuickAddSpan = { start: number; end: number }

export type QuickAddOptions = {
  /** Today, `'YYYY-MM-DD'` in the app's zone (todayIn): where days count from. */
  today: PlainDate
  /** The IANA zone a repeat is read in. */
  timeZone: string
  /** The app's tokens. None: symbols stay in the title. */
  tokens?: QuickAddToken[]
  /** Spans never read (a chip's ✕): their words stay in the title. */
  ignore?: QuickAddSpan[]
  /** A repeat's times when neither it nor the line says one. Defaults to 09:00. */
  times?: string[]
  /** The day weeks start on, for a repeat (PhraseOptions' weekStart). */
  weekStart?: WeekdayCode
  /** Decides `3/4`'s order: month first in en-US, day first in en-GB. */
  locale?: string
}

export type QuickAddReadKind = 'date' | 'time' | 'recurrence' | 'token'

/** One part read from the line, for marking it: its kind, span and words. */
export type QuickAddRead = QuickAddSpan & {
  kind: QuickAddReadKind
  /** The words read, as typed. */
  text: string
  /** A token's key. */
  key?: string
}

export type QuickAddTokenRead = { key: string; symbol: string; label: string; name: string; span: QuickAddSpan; text: string }

export type QuickAddResult = {
  /** The line with what was read taken out, spaces tidied. */
  title: string
  /**
   * The day it's due. `span` is null when no day was typed and it comes
   * from the time (today) or the repeat (its first day).
   */
  date: { value: PlainDate; span: QuickAddSpan | null } | null
  /** `'HH:MM'`, typed on its own or as the repeat's first "at". */
  time: { value: string; span: QuickAddSpan } | null
  recurrence: { value: Recurrence; span: QuickAddSpan } | null
  /** One per token kind typed, in the line's order. */
  tokens: QuickAddTokenRead[]
  /** Every span read, in the line's order. */
  reads: QuickAddRead[]
}

const WEEKDAYS: [RegExp, number][] = [
  [/^mon(day)?$/, 1],
  [/^tue(s|sday)?$/, 2],
  [/^wed(s|nesday)?$/, 3],
  [/^thu(r|rs|rsday)?$/, 4],
  [/^fri(day)?$/, 5],
  [/^sat(urday)?$/, 6],
  [/^sun(day)?$/, 0],
]
const WEEKDAY = String.raw`(?:mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)`
const MONTH = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
// A word's edges: no letter or digit on either side.
const START = String.raw`(?<![\p{L}\p{N}])`
const END = String.raw`(?![\p{L}\p{N}])`
const REPEAT_START = new RegExp(String.raw`${START}(?:every!?|daily|weekly|monthly|yearly|annually|weekdays)${END}`, 'giu')
// How many words a repeat may run to, past its first.
const REPEAT_WORDS = 14

const pad = (value: number) => String(value).padStart(2, '0')

function addDays(day: PlainDate, count: number): PlainDate {
  const [year, month, date] = day.split('-').map(Number)
  return localToPlainDate(new Date(year, month - 1, date + count))
}

function weekdayOf(day: PlainDate): number {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date)).getUTCDay()
}

function realDay(year: number, month: number, day: number): PlainDate | null {
  const check = new Date(Date.UTC(year, month - 1, day))
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null
  return `${year}-${pad(month)}-${pad(day)}`
}

/** A month and day with no year: the next one on or after today (Feb 29: the next leap year's). */
function nextMonthDay(month: number, day: number, today: PlainDate): PlainDate | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const from = Number(today.slice(0, 4))
  for (let year = from; year < from + 8; year++) {
    const value = realDay(year, month, day)
    if (value && value >= today) return value
  }
  return null
}

const overlaps = (a: QuickAddSpan, b: QuickAddSpan) => a.start < b.end && b.start < a.end

/** The flattened name (no spaces, dashes or underscores, lower case) a token's letters are matched on. */
const flat = (value: string) => value.toLowerCase().replace(/[\s_-]+/g, '')

function pickName(names: string[], letters: string): string | null {
  const typed = flat(letters)
  if (!typed) return null
  return names.find((name) => flat(name).startsWith(typed)) ?? names.find((name) => flat(name).includes(typed)) ?? null
}

/**
 * Reads a quick-add line into its title, day, time, repeat and tokens.
 * Live as you type: call it on every change; a part it can't read is
 * left in the title, never refused.
 */
export function parseQuickAdd(text: string, options: QuickAddOptions): QuickAddResult {
  const taken: QuickAddSpan[] = [...(options.ignore ?? [])]
  const reads: QuickAddRead[] = []
  const free = (span: QuickAddSpan) => !taken.some((other) => overlaps(other, span))
  const take = (span: QuickAddSpan, kind: QuickAddReadKind, key?: string) => {
    taken.push(span)
    reads.push({ ...span, kind, text: text.slice(span.start, span.end), ...(key ? { key } : {}) })
  }

  // The first match of a pattern clear of everything taken, with `read`
  // saying whether it means something (a 3/45 isn't a day).
  function first<T>(pattern: RegExp, read: (match: RegExpExecArray) => T | null): { value: T; span: QuickAddSpan } | null {
    const expression = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)
    for (let match = expression.exec(text); match; match = expression.exec(text)) {
      if (match[0] === '') {
        expression.lastIndex++
        continue
      }
      const span = { start: match.index, end: match.index + match[0].length }
      if (!free(span)) continue
      const value = read(match)
      if (value !== null) return { value, span }
    }
    return null
  }

  // 1. The app's tokens: one per kind, the first that names something.
  const tokens: QuickAddTokenRead[] = []
  for (const token of options.tokens ?? []) {
    const symbol = token.symbol.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
    const found = first(new RegExp(String.raw`(?<![^\s(])${symbol}([\p{L}\p{N}_-]+)`, 'giu'), (match) =>
      pickName(token.names, match[1]),
    )
    if (!found) continue
    take(found.span, 'token', token.key)
    tokens.push({
      key: token.key,
      symbol: token.symbol,
      label: token.label ?? token.key,
      name: found.value,
      span: found.span,
      text: text.slice(found.span.start, found.span.end),
    })
  }
  tokens.sort((a, b) => a.span.start - b.span.start)

  // 2. The time and day on their own, read before the repeat is fixed so
  // the repeat can take them, but after it in the line's claim: a time
  // inside "every mon at 9am" belongs to the repeat.
  const repeatAt = findRepeat()
  const outside = (span: QuickAddSpan) => !repeatAt || !overlaps(span, repeatAt.span)

  const ownTime = first(
    new RegExp(
      String.raw`${START}(?:at\s+(noon|midnight)|(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)|(?:at\s+)?(\d{1,2}):(\d{2}))(?![\p{L}\p{N}])`,
      'giu',
    ),
    (match) => {
      if (!outside({ start: match.index, end: match.index + match[0].length })) return null
      if (match[1]) return match[1].toLowerCase() === 'noon' ? '12:00' : '00:00'
      if (match[4]) {
        const hour = Number(match[2])
        const minute = match[3] ? Number(match[3]) : 0
        if (hour < 1 || hour > 12 || minute > 59) return null
        return `${pad((hour % 12) + (match[4].toLowerCase().startsWith('p') ? 12 : 0))}:${pad(minute)}`
      }
      const hour = Number(match[5])
      const minute = Number(match[6])
      return hour > 23 || minute > 59 ? null : `${pad(hour)}:${pad(minute)}`
    },
  )
  if (ownTime) take(ownTime.span, 'time')

  const date = readDate()
  if (date) take(date.span, 'date')

  // 3. The repeat, with the day as its start and the line's time.
  let recurrence: QuickAddResult['recurrence'] = null
  let repeatTime: QuickAddResult['time'] = null
  if (repeatAt && free(repeatAt.span)) {
    const parsed = parseRecurrencePhrase(repeatAt.phrase, {
      today: options.today,
      timeZone: options.timeZone,
      times: ownTime ? [ownTime.value] : options.times,
      start: date?.value,
      weekStart: options.weekStart,
    })
    if (parsed.ok) {
      recurrence = { value: parsed.value, span: repeatAt.span }
      take(repeatAt.span, 'recurrence')
      if (!ownTime && /(?<![\p{L}\p{N}])at(?![\p{L}\p{N}])/u.test(repeatAt.phrase)) {
        repeatTime = { value: parsed.value.times[0], span: repeatAt.span }
      }
    }
  }

  reads.sort((a, b) => a.start - b.start)
  let title = ''
  let at = 0
  for (const read of reads) {
    title += `${text.slice(at, read.start)} `
    at = read.end
  }
  title = (title + text.slice(at)).replace(/\s+/g, ' ').trim()

  const finalTime = ownTime ?? repeatTime
  let due: QuickAddResult['date'] = date ? { value: date.value, span: date.span } : null
  if (!due && recurrence) due = { value: firstDay(recurrence.value), span: null }
  if (!due && finalTime) due = { value: options.today, span: null }

  return { title, date: due, time: finalTime, recurrence, tokens, reads }

  /** The longest repeat phrase from its first word that parseRecurrencePhrase reads. */
  function findRepeat(): { phrase: string; span: QuickAddSpan } | null {
    REPEAT_START.lastIndex = 0
    for (let match = REPEAT_START.exec(text); match; match = REPEAT_START.exec(text)) {
      const start = match.index
      if (!free({ start, end: start + match[0].length })) continue
      // The words after it, each ending where its spaces stop.
      const ends: number[] = [start + match[0].length]
      const words = /\S+/g
      words.lastIndex = ends[0]
      for (let word = words.exec(text); word && ends.length <= REPEAT_WORDS; word = words.exec(text)) {
        const span = { start: word.index, end: word.index + word[0].length }
        if (!free(span)) break
        ends.push(span.end)
      }
      for (let n = ends.length - 1; n >= 0; n--) {
        // A trailing comma is the line's, not the phrase's.
        const end = ends[n] - (/[,;]$/.test(text.slice(start, ends[n])) ? 1 : 0)
        const phrase = text.slice(start, end)
        const parsed = parseRecurrencePhrase(phrase, {
          today: options.today,
          timeZone: options.timeZone,
          weekStart: options.weekStart,
        })
        if (parsed.ok) return { phrase, span: { start, end } }
      }
    }
    return null
  }

  function readDate(): { value: PlainDate; span: QuickAddSpan } | null {
    const today = options.today
    const ON = String.raw`(?:on\s+)?`
    const candidates: { value: PlainDate; span: QuickAddSpan }[] = []
    const consider = (found: { value: PlainDate; span: QuickAddSpan } | null) => {
      if (found && outside(found.span)) candidates.push(found)
    }
    const guard = (match: RegExpExecArray) => outside({ start: match.index, end: match.index + match[0].length })
    consider(
      first(new RegExp(String.raw`${START}(today|tonight|tomorrow|tmrw)${END}`, 'giu'), (match) =>
        guard(match) ? (/^t(omorrow|mrw)$/i.test(match[1]) ? addDays(today, 1) : today) : null,
      ),
    )
    consider(
      first(new RegExp(String.raw`${START}${ON}(?:(next|this)\s+)?(${WEEKDAY})${END}`, 'giu'), (match) => {
        if (!guard(match)) return null
        const weekday = WEEKDAYS.find(([pattern]) => pattern.test(match[2].toLowerCase()))![1]
        const ahead = (weekday - weekdayOf(today) + 7) % 7 || 7
        return addDays(today, ahead)
      }),
    )
    consider(
      first(new RegExp(String.raw`${START}in\s+(\d{1,3}|a|an|one)\s+(days?|weeks?)${END}`, 'giu'), (match) => {
        if (!guard(match)) return null
        const count = /^\d/.test(match[1]) ? Number(match[1]) : 1
        return addDays(today, count * (/^w/i.test(match[2]) ? 7 : 1))
      }),
    )
    consider(
      first(
        new RegExp(
          String.raw`${START}${ON}(?:(${MONTH})\.?\s+(\d{1,2})(?:st|nd|rd|th)?|(\d{1,2})(?:st|nd|rd|th)?\s+(${MONTH}))${END}`,
          'giu',
        ),
        (match) => {
          if (!guard(match)) return null
          const month = MONTHS.indexOf((match[1] ?? match[4]).slice(0, 3).toLowerCase()) + 1
          return nextMonthDay(month, Number(match[2] ?? match[3]), today)
        },
      ),
    )
    consider(
      first(new RegExp(String.raw`${START}${ON}(\d{1,2})/(\d{1,2})(?:/(\d{2}|\d{4}))?${END}`, 'giu'), (match) => {
        if (!guard(match)) return null
        const [a, b] = [Number(match[1]), Number(match[2])]
        const [month, day] = dayFirst(options.locale) ? [b, a] : [a, b]
        if (match[3]) {
          const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3])
          return realDay(year, month, day)
        }
        return nextMonthDay(month, day, today)
      }),
    )
    // The first in the line wins; the rest stay in the title.
    candidates.sort((a, b) => a.span.start - b.span.start)
    return candidates[0] ?? null
  }

  function firstDay(value: Recurrence): PlainDate {
    const before = new Date(atLocal(value.start, '00:00', value.timeZone).getTime() - 1)
    const next = nextOccurrence(value, before)
    return next ? wallClock(next, value.timeZone).day : value.start
  }
}
