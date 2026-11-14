// A list's date filter (4.110): FilterDate's value, as one string, so it
// lives in the URL like any single-value filter (useTableUrlState) and a
// saved view can set it (`filters: { due: 'before-today' }`). It's either
// a preset, read against today when the list loads, or a range of plain
// days, either end open:
//
//   before-today         every day before today
//   today                today alone
//   from-today           today and every day after
//   2026-11-01..2026-11-30   both days included
//   2026-11-01..         from that day on
//   ..2026-11-30         up to that day
//
// '' is no filter. resolveDateFilter turns a value into the inclusive days
// the query sends; dateFilterText into the words its chip and control show.
import { formatPlainDate, localToPlainDate, plainDateToLocal, type PlainDate } from './plain-date'

/** A relative date filter, read against today each time the list loads. */
export type DateFilterPreset = 'before-today' | 'today' | 'from-today'

/** Every preset, in the order FilterDate lists them. */
export const DATE_FILTER_PRESETS: readonly DateFilterPreset[] = ['before-today', 'today', 'from-today']

/** Each preset's words, in the control and its chip ("Due: Before today"). */
export const DATE_FILTER_PRESET_LABELS: Record<DateFilterPreset, string> = {
  'before-today': 'Before today',
  today: 'Today',
  'from-today': 'From today',
}

/** The days a date filter keeps, both ends included; an end left out is open. */
export type DateFilterBounds = { from?: PlainDate; to?: PlainDate }

/** What a date filter's value says: a preset, or a range of days. */
export type DateFilter = { preset: DateFilterPreset } | { range: DateFilterBounds }

const RANGE_SEPARATOR = '..'
const isDay = (value: string) => value === '' || formatPlainDate(value) !== ''
const isPreset = (value: string): value is DateFilterPreset => (DATE_FILTER_PRESETS as readonly string[]).includes(value)

/** Reads a date filter's value: a preset, a range, or null for '' and anything it can't read. */
export function parseDateFilter(value: string): DateFilter | null {
  if (isPreset(value)) return { preset: value }
  const at = value.indexOf(RANGE_SEPARATOR)
  if (at === -1) return null
  const from = value.slice(0, at)
  const to = value.slice(at + RANGE_SEPARATOR.length)
  if (!isDay(from) || !isDay(to) || (from === '' && to === '')) return null
  return { range: { ...(from ? { from } : {}), ...(to ? { to } : {}) } }
}

/** A range's value: `'2026-11-01..2026-11-30'`, either end left out when open, '' when both are. */
export function dateRangeValue({ from = '', to = '' }: DateFilterBounds): string {
  return from || to ? `${from}${RANGE_SEPARATOR}${to}` : ''
}

const shift = (day: PlainDate, days: number) => {
  const local = plainDateToLocal(day)!
  local.setDate(local.getDate() + days)
  return localToPlainDate(local)
}

/**
 * The days a date filter keeps, for the query: inclusive plain days, an
 * end left out when open. `before-today` is `{ to: yesterday }`,
 * `from-today` `{ from: today }`. Null for '' or a value it can't read:
 * no filter. `today` is the browser's own unless given.
 */
export function resolveDateFilter(value: string, today: PlainDate = localToPlainDate(new Date())): DateFilterBounds | null {
  const filter = parseDateFilter(value)
  if (!filter) return null
  if ('range' in filter) return filter.range
  if (filter.preset === 'before-today') return { to: shift(today, -1) }
  if (filter.preset === 'today') return { from: today, to: today }
  return { from: today }
}

/** Whether a plain day is one the filter keeps (a mock or a list filtered in the browser). */
export function dateFilterKeeps(value: string, day: PlainDate, today?: PlainDate): boolean {
  const bounds = resolveDateFilter(value, today)
  if (!bounds) return true
  if (!day) return false
  return (bounds.from === undefined || day >= bounds.from) && (bounds.to === undefined || day <= bounds.to)
}

/**
 * The words for a date filter's value: "Before today", "Nov 1 – Nov 30, 2026",
 * "From Nov 1, 2026", "Until Nov 30, 2026", or '' for none.
 */
export function dateFilterText(
  value: string,
  format: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  locale?: string,
): string {
  const filter = parseDateFilter(value)
  if (!filter) return ''
  if ('preset' in filter) return DATE_FILTER_PRESET_LABELS[filter.preset]
  const { from, to } = filter.range
  const day = (each: PlainDate) => formatPlainDate(each, format, locale)
  if (from && to) return `${day(from)} – ${day(to)}`
  return from ? `From ${day(from)}` : `Until ${day(to!)}`
}
