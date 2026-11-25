// A few choices, then the month calendar, opened from any trigger: a
// "move to" picker in DateField's look. The app gives its rows (a label,
// its value muted on the right, disabled or not) and the day the thing
// sits on; a row runs its own `onSelect` and a day picked in the calendar
// runs `onPick`, and either closes the popup.
//
// It is a dialog, never a menu: a calendar's grid can't sit inside a
// `role="menu"`, whose children are menu items. So the rows are buttons
// in a named group and the keyboard is DateField's: Tab goes through the
// rows, then the calendar (its month buttons, then its day, where the
// arrows move), Escape closes and focus goes back to the trigger. It
// opens on the first row that can be pressed, or on the calendar's day
// when there is none.
//
// DateField's own popup is built from the same parts: its quick picks are
// `DateChoiceRows`, and its calendar is `DateChoiceCalendar`.
import { useId, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { localToPlainDate, plainDateToLocal, type PlainDate } from '@/lib/plain-date'
import type { WeekdayCode } from '@/lib/recurrence'

export type DateChoice = {
  /** Its words, on the left: "Morning", "Tomorrow". Title Case. */
  label: string
  /** What it means, muted on the right: a start time, a day ("Thu, Nov 26"). */
  value?: string
  /** Shown, greyed and not pressable: a block that has ended. */
  disabled?: boolean
  /** Pressed: the popup closes, then this runs. */
  onSelect: () => void
}

export type DateChoicesProps = {
  /**
   * The button that opens it, as a Base UI `render` element (`<Button
   * size="icon-sm" variant="ghost" aria-label="Move Water the plants" />`),
   * with `children` inside it.
   */
  trigger: ReactElement
  children?: ReactNode
  /** The popup's name, read when it opens: "Move Water the plants". */
  label: string
  /** The rows' heading, shown over them and naming their group: "Move to". */
  choicesLabel?: string
  choices?: readonly DateChoice[]
  /** The day it's on now, `'YYYY-MM-DD'`: marked in the calendar, whose month opens on it. */
  value?: PlainDate
  /**
   * Today as the app counts it (a day that rolls over at 4 AM, say), ringed
   * in the calendar. Defaults to the browser's today.
   */
  today?: PlainDate
  /** A day picked in the calendar, `'YYYY-MM-DD'`. The popup closes first. */
  onPick: (day: PlainDate) => void
  /** The day the calendar's weeks start on (`'MO'` to `'SU'`; Monday when left out). */
  weekStart?: WeekdayCode
  /** Where it lines up with the trigger. Defaults to `'end'`, as a row's ⋯ menu does. */
  align?: 'start' | 'center' | 'end'
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

export function DateChoices({
  trigger,
  children,
  label,
  choicesLabel,
  choices = [],
  value,
  today,
  onPick,
  weekStart,
  align = 'end',
  open: givenOpen,
  onOpenChange,
  className,
}: DateChoicesProps) {
  const [ownOpen, setOwnOpen] = useState(false)
  const open = givenOpen ?? ownOpen
  const popup = useRef<HTMLDivElement>(null)
  const changeOpen = (next: boolean) => {
    setOwnOpen(next)
    onOpenChange?.(next)
  }
  // Closed first, then the app's own work: a row that moves the thing away
  // (and unmounts the trigger) leaves nothing open behind it.
  const close = (then: () => void) => {
    changeOpen(false)
    then()
  }
  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger render={trigger}>{children}</PopoverTrigger>
      <PopoverContent
        ref={popup}
        align={align}
        className={cn('w-auto p-0', className)}
        data-slot="date-choices"
        aria-label={label}
        initialFocus={() =>
          popup.current?.querySelector<HTMLElement>('[data-slot="date-choice"]:not(:disabled)') ??
          popup.current?.querySelector<HTMLElement>('button[data-day][tabindex="0"]') ??
          true
        }
      >
        <DateChoiceRows label={choicesLabel} choices={choices.map((choice) => ({ ...choice, onSelect: () => close(choice.onSelect) }))} />
        <DateChoiceCalendar value={value} today={today} weekStart={weekStart} onPick={(day) => close(() => onPick(day))} />
      </PopoverContent>
    </Popover>
  )
}

/**
 * The rows over a date popup's calendar, DateField's quick picks among
 * them: ghost buttons in a named group, each its label on the left and its
 * value muted on the right, named for both ("Tomorrow, Thu, Nov 26").
 */
export function DateChoiceRows({
  label,
  showLabel = true,
  choices,
  slot = 'date-choices-rows',
}: {
  label?: string
  /** The heading over the rows; `false` names the group without showing it (Quick Picks). */
  showLabel?: boolean
  choices: readonly DateChoice[]
  slot?: string
}) {
  const headingId = useId()
  if (choices.length === 0) return null
  const shown = label && showLabel
  return (
    <div
      role="group"
      aria-label={shown ? undefined : label}
      aria-labelledby={shown ? headingId : undefined}
      data-slot={slot}
      className="flex flex-col gap-0.5 border-b border-border p-2"
    >
      {shown && (
        <div id={headingId} className="px-3 py-1 text-xs font-medium text-muted-foreground">
          {label}
        </div>
      )}
      {choices.map((choice) => (
        <Button
          key={choice.label}
          type="button"
          variant="ghost"
          size="sm"
          data-slot="date-choice"
          disabled={choice.disabled}
          className="w-full justify-between gap-4 font-normal"
          // Its words first, so speech input finds it by what it shows.
          aria-label={choice.value ? `${choice.label}, ${choice.value}` : choice.label}
          onClick={choice.onSelect}
        >
          <span>{choice.label}</span>
          {choice.value && <span className="text-muted-foreground tabular-nums">{choice.value}</span>}
        </Button>
      ))}
    </div>
  )
}

// Calendar's `weekStartsOn` by code. Left out, it's Calendar's own default (Monday).
const WEEK_STARTS_ON = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 } as const satisfies Record<WeekdayCode, number>

/** A date popup's month: the day it's on marked, today ringed, a pick given as `'YYYY-MM-DD'`. */
export function DateChoiceCalendar({
  value,
  today,
  weekStart,
  onPick,
}: {
  value?: PlainDate
  today?: PlainDate
  weekStart?: WeekdayCode
  onPick: (day: PlainDate) => void
}) {
  const selected = value ? plainDateToLocal(value) : undefined
  return (
    <Calendar
      mode="single"
      // Picking the chosen day again keeps it (and closes), never unsets it: Clear does that.
      required
      selected={selected}
      defaultMonth={selected}
      today={today ? plainDateToLocal(today) : undefined}
      weekStartsOn={weekStart && WEEK_STARTS_ON[weekStart]}
      onSelect={(date: Date) => onPick(localToPlainDate(date))}
    />
  )
}
