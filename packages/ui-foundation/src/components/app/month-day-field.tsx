// A month and day with no year: something that comes round every year (a
// season's start, a yearly deadline). The value is `'MM-DD'`, or `''` for
// not set (`lib/month-day.ts`).
//
// A button showing the day ("Mar 14"), opening a picker in a Popover like
// DateField's: twelve months, then the chosen month's days. A calendar
// grid would need a year (its weekdays and leading blanks are a year's),
// so the days are 1 to the month's last in rows of seven, February
// running to the 29th. Only real days are offered, so the field can't
// make February 30; a stored value that isn't one (`'02-30'`, old text)
// shows as written, nothing selected. The arrow keys move through either
// grid (Home and End to its ends), Page Up and Page Down change the month,
// and every button is 36px or larger for a finger.
//
// One control for the form (a react-hook-form `Controller`) and for
// editing in place (`inPlace.monthDay`: picking a day saves, and the
// picker opens with the field). `clearable` adds Clear for an optional field.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { daysInMonth, formatMonthDay, monthDayParts, monthName, toMonthDay, type MonthDay } from '@/lib/month-day'

export type MonthDayFieldProps = {
  /** The trigger button's id, for the field's `<FieldLabel htmlFor>`. */
  id?: string
  /** `'MM-DD'`, or `''` for not set. */
  value: MonthDay
  /** Called with the picked day as `'MM-DD'`, or `''` when cleared. */
  onChange: (value: MonthDay) => void
  /** What the button says with no day set. Defaults to "Pick a day". */
  placeholder?: string
  /** Offer Clear in the picker, for an optional field. */
  clearable?: boolean
  /** The value was refused: `aria-invalid` on the button. */
  invalid?: boolean
  /** Saving: the button shows the day but won't open. */
  readOnly?: boolean
  /** Open on mount: editing in place, where the picker opens with the field. */
  defaultOpen?: boolean
  /** Passed to the Popover; `false` when editing in place, as for a Select. */
  modal?: boolean
  /** Told when the picker opens or closes; editing in place gives up on a close with nothing picked. */
  onOpenChange?: (open: boolean) => void
  /** How the day reads on the button. Defaults to `{ month: 'short', day: 'numeric' }` ("Mar 14"). */
  format?: Pick<Intl.DateTimeFormatOptions, 'month' | 'day'>
  locale?: string
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
}

const MONTH_COLUMNS = 3
const DAY_COLUMNS = 7

// Where an arrow key moves in a grid of `count` cells, `columns` wide, or
// null for a key the grid doesn't use. Left and Right run on across rows.
function moveInGrid(key: string, at: number, count: number, columns: number): number | null {
  const next =
    key === 'ArrowLeft'
      ? at - 1
      : key === 'ArrowRight'
        ? at + 1
        : key === 'ArrowUp'
          ? at - columns
          : key === 'ArrowDown'
            ? at + columns
            : key === 'Home'
              ? 0
              : key === 'End'
                ? count - 1
                : null
  if (next === null) return null
  return Math.min(Math.max(next, 0), count - 1)
}

// The month after (or before) one, round the year.
const nextMonth = (month: number, by: 1 | -1) => ((month - 1 + by + 12) % 12) + 1

export function MonthDayField({
  id,
  value,
  onChange,
  placeholder = 'Pick a day',
  clearable = false,
  invalid = false,
  readOnly = false,
  defaultOpen = false,
  modal,
  onOpenChange,
  format,
  locale,
  className,
  ...aria
}: MonthDayFieldProps) {
  const [open, setOpen] = useState(defaultOpen && !readOnly)
  const popup = useRef<HTMLDivElement>(null)
  const selected = monthDayParts(value)
  // A value that isn't a day of the year reads as written, so nothing typed before is hidden.
  const shown = formatMonthDay(value, format, locale) || value

  const changeOpen = (next: boolean) => {
    if (next && readOnly) return
    setOpen(next)
    onOpenChange?.(next)
  }
  const pick = (next: MonthDay) => {
    onChange(next)
    changeOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={changeOpen} modal={modal}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-invalid={invalid || undefined}
            aria-readonly={readOnly || undefined}
            className={cn('w-full justify-start font-normal', !shown && 'text-muted-foreground', className)}
            {...aria}
          />
        }
      >
        <CalendarIcon aria-hidden="true" className="size-4" />
        {shown || placeholder}
      </PopoverTrigger>
      <PopoverContent
        ref={popup}
        className="w-auto p-0"
        data-slot="month-day-field-picker"
        aria-label="Month and day"
        // The button the keyboard starts from (the chosen day, else this
        // month): the one the grid makes tabbable. The popup would
        // otherwise take focus itself.
        initialFocus={() => popup.current?.querySelector<HTMLElement>('[data-cell][tabindex="0"]') ?? true}
      >
        {open && (
          <Picker
            selected={selected}
            locale={locale}
            onPick={(month, day) => pick(toMonthDay(month, day))}
          />
        )}
        {clearable && value && (
          <div className="border-t border-border p-2">
            <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => pick('')}>
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

type PickerProps = {
  selected: { month: number; day: number } | null
  locale?: string
  onPick: (month: number, day: number) => void
}

// The two steps: a month (when nothing is chosen yet, or from the day
// step's month button), then its days. It opens on the chosen day's month,
// else on the months with this one to start from.
function Picker({ selected, locale, onPick }: PickerProps) {
  const today = new Date()
  const [step, setStep] = useState<'month' | 'day'>(selected ? 'day' : 'month')
  const [month, setMonth] = useState(selected?.month ?? today.getMonth() + 1)
  // The cell the keyboard is on in the grid shown: a month (1–12) or a day.
  const [active, setActive] = useState(selected ? selected.day : today.getMonth() + 1)
  const grid = useRef<HTMLDivElement>(null)
  // Focus follows `active` once the grid is drawn (a step or a month
  // changed, an arrow key), never on a click elsewhere in the popup. On
  // opening, the popup's own initial focus puts it there.
  const focusWanted = useRef(false)
  const monthsLabel = useId()

  useEffect(() => {
    if (!focusWanted.current) return
    focusWanted.current = false
    grid.current?.querySelector<HTMLElement>(`[data-cell="${active}"]`)?.focus()
  })

  const days = daysInMonth(month)
  const showMonth = (next: number, day: number) => {
    setMonth(next)
    setActive(Math.min(day, daysInMonth(next)))
    focusWanted.current = true
  }

  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (step === 'day' && (event.key === 'PageUp' || event.key === 'PageDown')) {
      event.preventDefault()
      showMonth(nextMonth(month, event.key === 'PageUp' ? -1 : 1), active)
      return
    }
    const [count, columns] = step === 'month' ? [12, MONTH_COLUMNS] : [days, DAY_COLUMNS]
    const at = moveInGrid(event.key, active - 1, count, columns)
    if (at === null) return
    event.preventDefault()
    if (at + 1 === active) return
    setActive(at + 1)
    focusWanted.current = true
  }

  const name = monthName(month, 'long', locale)

  if (step === 'month') {
    return (
      <div className="p-3">
        <p className="mb-2 px-1 text-sm font-medium" id={monthsLabel}>
          Month
        </p>
        <div
          ref={grid}
          role="group"
          aria-labelledby={monthsLabel}
          className="grid grid-cols-3 gap-1"
          onKeyDown={onGridKeyDown}
        >
          {Array.from({ length: 12 }, (_, index) => {
            const each = index + 1
            const chosen = selected?.month === each
            return (
              <Button
                key={each}
                type="button"
                variant={chosen ? 'default' : 'ghost'}
                className="h-10 w-20 font-normal"
                data-cell={each}
                tabIndex={each === active ? 0 : -1}
                aria-pressed={chosen}
                onClick={() => {
                  setStep('day')
                  showMonth(each, selected?.month === each ? selected.day : 1)
                }}
              >
                {/* "Jan" on the button, "January" to a screen reader, so its name holds no abbreviation. */}
                <span aria-hidden="true">{monthName(each, 'short', locale)}</span>
                <span className="sr-only">{monthName(each, 'long', locale)}</span>
              </Button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Previous month"
          onClick={() => showMonth(nextMonth(month, -1), active)}
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="font-medium"
          aria-label={`${name}, pick another month`}
          onClick={() => {
            setStep('month')
            setActive(month)
            focusWanted.current = true
          }}
        >
          {name}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Next month"
          onClick={() => showMonth(nextMonth(month, 1), active)}
        >
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </div>
      <div
        ref={grid}
        role="group"
        aria-label={name}
        className="grid grid-cols-7 gap-1"
        onKeyDown={onGridKeyDown}
      >
        {Array.from({ length: days }, (_, index) => {
          const day = index + 1
          const chosen = selected?.month === month && selected.day === day
          return (
            <Button
              key={day}
              type="button"
              variant={chosen ? 'default' : 'ghost'}
              size="icon"
              className="font-normal tabular-nums"
              data-cell={day}
              tabIndex={day === active ? 0 : -1}
              aria-label={formatMonthDay(toMonthDay(month, day), { month: 'long', day: 'numeric' }, locale)}
              aria-pressed={chosen}
              onClick={() => onPick(month, day)}
            >
              {day}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
