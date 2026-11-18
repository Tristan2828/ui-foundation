// How something repeats (#326): a reminder's or a task's schedule. The
// value is the contract's `Recurrence` (`lib/recurrence.ts`), or `null`
// for none.
//
// Three parts, one under the other:
// - **Presets**, a row of toggle buttons: Daily, Weekdays, Weekly on Thu,
//   Monthly on the 12th, Monthly on the 2nd Thu, Yearly on Nov 12 (each
//   from the start day) and Custom. The one the value is stays pressed;
//   Custom is pressed for anything else, and moves to the phrase box.
// - **The phrase box**, read as you type (`parseRecurrencePhrase`): "every
//   2nd tue at 9am", "every! 3 days", "every jan 1 until mar 1". What it
//   can't read is said under it, and the field gives `null`, so a form
//   never keeps the rule it had before (DateField does the same).
// - **The preview**: the rule's label ("Every 2nd Tue at 9:00 AM") and its
//   next five occurrences, in the rule's zone, or why it can't be read.
//
// Two options an app's own records may want (4.114):
// - `times={false}`, for a record whose times are fields of its own (a
//   calendar's events): the preview lists dates only ("Tue, Dec 8", from
//   today on), the label and the box say no times, and typing "at 9am" is
//   refused. The value still carries `times` (the value's, `defaultTimes`
//   or 09:00), as the contract needs one.
// - `weekStart`, the day the app's weeks start on: `'SU'` adds `WKST=SU`
//   to every weekly rule the presets and the box build, so "every other
//   week on sun, wed" counts its weeks Sunday to Saturday. A rule whose
//   week start differs, where it matters, says so ("weeks start mon").
//
// One control for the form (a react-hook-form `Controller`) and for
// editing in place (`inPlace.recurrence`: Enter in the box or leaving the
// field saves). The box is the field's labelled control (`id`); the
// presets name themselves "Presets".
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { RepeatIcon } from 'lucide-react'
import { cn } from 'cn'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { formatOccurrence, formatRecurrence, todayIn } from '@/lib/recurrence-format'
import { ordinalWord, parseRecurrencePhrase, recurrencePhrase } from '@/lib/recurrence-phrase'
import {
  atLocal,
  nextOccurrences,
  normalizeRecurrence,
  recurrenceProblem,
  wallClock,
  WEEKDAY_CODES,
  type Recurrence,
  type WeekdayCode,
} from '@/lib/recurrence'

export type RecurrenceFieldProps = {
  /** The phrase box's id, for the field's `<FieldLabel htmlFor>`. */
  id?: string
  /** The repeat, or `null` for none. */
  value: Recurrence | null
  /** Called with each readable repeat, or `null` when the box is emptied or can't be read. */
  onChange: (value: Recurrence | null) => void
  /** The IANA zone a new repeat is read in. Defaults to the value's, else the browser's. */
  timeZone?: string
  /** The times a new repeat starts with when the phrase has none. Defaults to the value's, else 09:00. */
  defaultTimes?: string[]
  /** Today, `'YYYY-MM-DD'`: where a phrase's days count from. Defaults to today in the zone. */
  today?: string
  /** What "now" is for the preview's next occurrences. Defaults to the clock. */
  now?: Date
  /** How many next occurrences the preview lists. Defaults to 5; 0 hides the list. */
  previewCount?: number
  /** Show the preset buttons (the default). */
  presets?: boolean
  /**
   * Show times of day (the default). False, for a record whose times are
   * its own fields: the preview lists dates only, from today on, the label
   * and the box leave the times out, and "at …" in the box is refused.
   */
  times?: boolean
  /**
   * The day the app's weeks start on (`'MO'` to `'SU'`; Monday when left
   * out). Not Monday: every weekly rule the presets and the box build gets
   * it as WKST (`'SU'` adds `WKST=SU`), which moves an every-N-weeks rule's
   * weeks.
   */
  weekStart?: WeekdayCode
  locale?: string
  /** The value was refused: `aria-invalid` on the box. */
  invalid?: boolean
  readOnly?: boolean
  /**
   * Told when the phrase can't be read (with why), and `null` once it can:
   * editing in place gives it to `onProblem`, so the field won't save.
   */
  onProblem?: (message: string | null) => void
  /** Called when the box is left, for a form's `onBlur`. */
  onBlur?: () => void
  className?: string
  'aria-label'?: string
  'aria-describedby'?: string
}

type PresetId = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'nth' | 'yearly' | 'custom'
type Preset = { id: PresetId; label: string; rule: string | null }

function weekdayOf(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
}

function dayName(day: number, locale: string | undefined) {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(Date.UTC(2024, 0, 1 + day))
}

/** The presets for a start day: each a rule built from that day; a weekly one with the app's week start. */
function presetsFor(start: string, locale: string | undefined, weekStart: WeekdayCode): Preset[] {
  const wkst = weekStart === 'MO' ? '' : `;WKST=${weekStart}`
  const [year, month, date] = start.split('-').map(Number)
  const weekday = weekdayOf(start)
  const lastOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  // The 2nd Thu; the last one when it's the month's last (a 5th, or a 4th with no 5th).
  const nth = date + 7 > lastOfMonth ? -1 : Math.ceil(date / 7)
  const code = WEEKDAY_CODES[weekday]
  const yearDay = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    Date.UTC(2024, month - 1, date),
  )
  return [
    { id: 'daily', label: 'Daily', rule: 'FREQ=DAILY' },
    { id: 'weekdays', label: 'Weekdays', rule: `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR${wkst}` },
    { id: 'weekly', label: `Weekly on ${dayName(weekday, locale)}`, rule: `FREQ=WEEKLY;BYDAY=${code}${wkst}` },
    { id: 'monthly', label: `Monthly on the ${ordinalWord(date)}`, rule: `FREQ=MONTHLY;BYMONTHDAY=${date}` },
    {
      id: 'nth',
      label: `Monthly on the ${nth === -1 ? 'last' : ordinalWord(nth)} ${dayName(weekday, locale)}`,
      rule: `FREQ=MONTHLY;BYDAY=${nth}${code}`,
    },
    { id: 'yearly', label: `Yearly on ${yearDay}`, rule: `FREQ=YEARLY;BYMONTH=${month};BYMONTHDAY=${date}` },
    { id: 'custom', label: 'Custom', rule: null },
  ]
}

function browserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

const same = (a: Recurrence | null, b: Recurrence | null) => JSON.stringify(a) === JSON.stringify(b)
// Every preset repeats each week or less often, where WKST changes nothing:
// a stored weekly rule with or without one is still its preset.
const sameDays = (a: string, b: string) => a.replace(/;WKST=[A-Z]{2}/, '') === b.replace(/;WKST=[A-Z]{2}/, '')

/** The next `count` days the value falls on, from today (in its zone) on: a date-only preview. */
function nextDays(value: Recurrence, today: string, count: number): Date[] {
  const days: Date[] = []
  const seen = new Set<string>()
  const from = new Date(atLocal(today, '00:00', value.timeZone).getTime() - 1)
  // Each day once, however many times it has: ask for enough to fill the list.
  for (const moment of nextOccurrences(value, from, count * value.times.length)) {
    const day = wallClock(moment, value.timeZone).day
    if (seen.has(day)) continue
    seen.add(day)
    days.push(moment)
    if (days.length === count) break
  }
  return days
}

export function RecurrenceField({
  id,
  value,
  onChange,
  timeZone,
  defaultTimes,
  today,
  now,
  previewCount = 5,
  presets = true,
  times = true,
  weekStart = 'MO',
  locale,
  invalid = false,
  readOnly = false,
  onProblem,
  onBlur,
  className,
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
}: RecurrenceFieldProps) {
  const zone = value?.timeZone ?? timeZone ?? browserZone()
  const day = today ?? todayIn(zone, now)
  const ownId = useId()
  const boxId = id ?? `${ownId}-phrase`
  const messageId = `${ownId}-message`
  const previewId = `${ownId}-preview`
  const box = useRef<HTMLInputElement>(null)

  // The box's text, and the value it last read (or was given). A new value
  // from outside (a preset, the form's reset) is written back as its phrase.
  const phraseOf = (recurrence: Recurrence) => recurrencePhrase(recurrence, day, { times, weekStart }) ?? ''
  const [text, setText] = useState(() => (value ? phraseOf(value) : ''))
  const [problem, setProblem] = useState<string | null>(null)
  const [known, setKnown] = useState<Recurrence | null>(value)
  if (!same(known, value)) {
    setKnown(value)
    if (value !== null || problem === null) {
      setText(value ? phraseOf(value) : '')
      setProblem(null)
    }
  }

  const emit = (next: Recurrence | null, why: string | null) => {
    setKnown(next)
    setProblem(why)
    onProblem?.(why)
    onChange(next)
  }

  const read = (phrase: string) => {
    setText(phrase)
    if (phrase.trim() === '') {
      emit(null, null)
      return
    }
    const result = parseRecurrencePhrase(phrase, {
      today: day,
      timeZone: zone,
      times: value?.times ?? defaultTimes,
      start: value?.start,
      weekStart,
      readTimes: times,
    })
    if (result.ok) emit(result.value, null)
    else emit(null, result.error)
  }

  const start = value?.start ?? day
  const options = presetsFor(start, locale, weekStart)
  const pressed: PresetId | null = value
    ? (options.find((option) => option.rule !== null && sameDays(option.rule, value.rule))?.id ?? 'custom')
    : null

  const pick = (preset: Preset) => {
    if (preset.rule === null) {
      box.current?.focus()
      return
    }
    const next = normalizeRecurrence({
      rule: preset.rule,
      start,
      times: value?.times ?? defaultTimes ?? ['09:00'],
      timeZone: zone,
      fromCompletion: false,
    })
    setText(phraseOf(next))
    emit(next, null)
  }

  // A press on a preset is its own: Enter there mustn't also reach editing
  // in place's Enter-saves (it would save the draft from before the press).
  const keepEnter = (event: KeyboardEvent) => {
    if (event.key === 'Enter') event.stopPropagation()
  }

  const stored = value ? recurrenceProblem(value) : null
  const shownProblem = problem ?? stored
  const upcoming =
    value && !shownProblem && previewCount > 0
      ? times
        ? nextOccurrences(value, now ?? new Date(), previewCount)
        : nextDays(value, day, previewCount)
      : []

  return (
    <div data-slot="recurrence-field" className={cn('flex min-w-0 flex-col gap-2', className)}>
      {presets && (
        <ToggleGroup
          data-slot="recurrence-presets"
          variant="outline"
          spacing={1}
          aria-label="Presets"
          value={pressed ? [pressed] : []}
          onValueChange={(next: string[]) => {
            const chosen = options.find((option) => option.id === (next[0] ?? pressed))
            if (chosen) pick(chosen)
          }}
          onKeyDown={keepEnter}
          disabled={readOnly}
          className="max-w-full flex-wrap"
        >
          {options.map((option) => (
            <ToggleGroupItem
              key={option.id}
              value={option.id}
              className="h-(--control-height,--spacing(8)) px-3 font-normal text-muted-foreground aria-pressed:font-medium aria-pressed:text-foreground"
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      <div className="relative">
        <RepeatIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={box}
          id={boxId}
          value={text}
          onChange={(event) => read(event.target.value)}
          onBlur={onBlur}
          readOnly={readOnly}
          placeholder={times ? 'every 2nd tue at 9am' : 'every 2nd tue'}
          autoComplete="off"
          spellCheck={false}
          className="pl-8"
          aria-label={ariaLabel}
          aria-invalid={invalid || !!shownProblem || undefined}
          aria-describedby={[shownProblem ? messageId : previewId, describedBy].filter(Boolean).join(' ') || undefined}
        />
      </div>
      <div data-slot="recurrence-preview" aria-live="polite" className="text-sm">
        {shownProblem ? (
          <p id={messageId} className="text-destructive-text">
            {shownProblem}
          </p>
        ) : value ? (
          <div id={previewId}>
            <p className="font-medium text-foreground">{formatRecurrence(value, { locale, times, weekStart })}</p>
            {previewCount > 0 && (
              <>
                {upcoming.length ? (
                  <ol aria-label="Next" className="mt-1 flex flex-col gap-0.5 text-muted-foreground tabular-nums">
                    {upcoming.map((moment) => (
                      <li key={moment.getTime()}>{formatOccurrence(moment, value.timeZone, { locale, now, time: times })}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-1 text-muted-foreground">No more to come.</p>
                )}
              </>
            )}
          </div>
        ) : (
          <p id={previewId} className="text-muted-foreground">
            Doesn’t repeat. Pick a preset or type how it repeats.
          </p>
        )}
      </div>
    </div>
  )
}
