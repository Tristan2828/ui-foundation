// A list's date filter (4.110), for FilterBar: a select that names itself
// like FilterSelect ("Any due date" while off, "Due: Before today" on),
// with the relative presets (lib/date-filter.ts) and Between dates, which
// shows a From and a To day beside it. Its value is one string, so it's a
// single-value filter in useTableUrlState and a saved view can set it
// (`filters: { due: 'before-today' }`); the query reads it with
// resolveDateFilter, and its chip's words are dateFilterText.
import { useState } from 'react'
import { cn } from 'cn'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DATE_FILTER_PRESETS,
  DATE_FILTER_PRESET_LABELS,
  dateFilterText,
  dateRangeValue,
  parseDateFilter,
  type DateFilterPreset,
} from '@/lib/date-filter'
import { DateField } from './date-field'

export type FilterDateProps = {
  /** What it filters ("Due"): the prefix of the value it shows ("Due: Before today"). */
  label: string
  /** The filter's value (lib/date-filter.ts): a preset, a range (`'2026-11-01..2026-11-30'`), or '' for any. */
  value: string
  onValueChange: (value: string) => void
  /** The presets it offers, in order: every one (Before today, Today, From today) unless set. */
  presets?: readonly DateFilterPreset[]
  /** Offer Between dates, a From and a To day: true unless set. */
  range?: boolean
  /** What it says while off: "Any <label in lower case> date" unless set ("Any due date"). */
  anyLabel?: string
  /** How a range's days are shown. Defaults to `{ dateStyle: 'medium' }`. */
  format?: Intl.DateTimeFormatOptions
  locale?: string
  className?: string
}

// Base UI's Select needs a value for "any" that isn't empty.
const ANY = '__any__'
const RANGE = '__range__'

/**
 * A date filter that names itself: "Any due date" while off, "Due: Before
 * today" with a preset, "Due: Nov 1 – Nov 30, 2026" with a range, whose
 * From and To days show beside it.
 */
export function FilterDate({
  label,
  value,
  onValueChange,
  presets = DATE_FILTER_PRESETS,
  range = true,
  anyLabel,
  format,
  locale,
  className,
}: FilterDateProps) {
  const filter = parseDateFilter(value)
  // Between dates picked, before either day is: the days show, the value stays ''.
  const [ranging, setRanging] = useState(false)
  const bounds = filter && 'range' in filter ? filter.range : null
  const showRange = range && (bounds !== null || (ranging && filter === null))
  const any = anyLabel ?? `Any ${label.toLowerCase()} date`
  const picked = filter && 'preset' in filter ? filter.preset : showRange ? RANGE : ANY
  const shown = filter ? `${label}: ${dateFilterText(value, format, locale)}` : showRange ? `${label}: Between dates` : any

  const pick = (next: string) => {
    if (next === RANGE) {
      setRanging(true)
      if (!bounds) onValueChange('')
      return
    }
    setRanging(false)
    onValueChange(next === ANY ? '' : next)
  }
  const setEnd = (end: 'from' | 'to', day: string) => {
    onValueChange(dateRangeValue({ ...bounds, [end]: day || undefined }))
  }

  return (
    <div data-slot="filter-date" className={cn('flex flex-wrap items-center gap-2', className)}>
      <Select value={picked} onValueChange={(next) => pick(next === null ? ANY : String(next))}>
        {/* Named by the text it shows, as FilterSelect is, so voice control can say it. */}
        <SelectTrigger aria-label={shown} data-slot="filter-date-select" data-active={filter ? true : undefined}>
          <SelectValue>{() => shown}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{any}</SelectItem>
          {presets.map((preset) => (
            <SelectItem key={preset} value={preset}>
              {DATE_FILTER_PRESET_LABELS[preset]}
            </SelectItem>
          ))}
          {range && (
            <>
              <SelectSeparator />
              <SelectItem value={RANGE}>Between dates</SelectItem>
            </>
          )}
        </SelectContent>
      </Select>
      {showRange && (
        <div data-slot="filter-date-range" className="flex flex-wrap items-center gap-2">
          <DateField
            value={bounds?.from ?? ''}
            onChange={(day) => setEnd('from', day)}
            aria-label={`${label} From`}
            placeholder="From"
            format={format}
            locale={locale}
            className="w-40"
          />
          <DateField
            value={bounds?.to ?? ''}
            onChange={(day) => setEnd('to', day)}
            aria-label={`${label} To`}
            placeholder="To"
            format={format}
            locale={locale}
            className="w-40"
          />
        </div>
      )}
    </div>
  )
}
