// A plain date, no time: when something was finished, a due day. The value
// is the wire's own `'YYYY-MM-DD'` (OpenAPI `format: date`), or `''` for
// not set, and it's read as a calendar day, never an instant: nothing here
// goes through the browser's time zone, so Sep 2 is Sep 2 everywhere.
//
// Typed (the default, 4.88's F12): a box that reads "3/14", "Mar 14",
// "2026-03-14" or "today" (`parsePlainDate`), with the package's Calendar
// on its button. Something it can't read says "Try a date like 3/14 or
// Mar 14" under the box once it's left, and gives `''`, so a form never
// keeps the day it had before. `typing={false}` is the button alone,
// opening the calendar in a Popover. One control for the form (a
// react-hook-form `Controller`) and for editing in place (`inPlace.date`).
// `clearable` adds Clear to the calendar for an optional field. Either way
// the control carries `data-kind="date"`, so two dates keep sharing a row
// on a phone without their Field saying `kind="date"`.
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { CalendarIcon } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  formatPlainDate,
  localToPlainDate,
  parsePlainDate,
  plainDateExamples,
  plainDateToLocal,
  unreadableDateMessage,
  type PlainDate,
} from '@/lib/plain-date'

export type DateFieldProps = {
  /** The box's id (the button's with `typing={false}`), for the field's `<FieldLabel htmlFor>`. */
  id?: string
  /** `'YYYY-MM-DD'`, or `''` for not set. */
  value: PlainDate
  /**
   * Called with the day as `'YYYY-MM-DD'`, or `''` when cleared or when
   * what's typed can't be read.
   */
  onChange: (value: PlainDate) => void
  /**
   * A box to type the day in, with the calendar on its button (the
   * default). `false`: the button alone, opening the calendar.
   */
  typing?: boolean
  /**
   * A day picked in the calendar, when that should do more than a typed
   * one does (editing in place saves it at once). Defaults to `onChange`.
   */
  onPick?: (value: PlainDate) => void
  /**
   * Told when what's typed can't be read (with its message), and `null`
   * once it can: editing in place gives it to `onProblem`, so the field
   * won't save a day nobody meant.
   */
  onProblem?: (message: string | null) => void
  /** The empty box's words. Defaults to "3/14 or Mar 14" typed (the locale's order), "Pick a date" on the button. */
  placeholder?: string
  /** Offer Clear in the calendar, for an optional field. */
  clearable?: boolean
  /** The value was refused: `aria-invalid` on the box (or button). */
  invalid?: boolean
  /** Saving: the day shows but can't change. */
  readOnly?: boolean
  /** Open the calendar on mount (the button's way of editing in place). */
  defaultOpen?: boolean
  /** Passed to the Popover; `false` when editing in place, as for a Select. */
  modal?: boolean
  /** Told when the calendar opens or closes. */
  onOpenChange?: (open: boolean) => void
  /** How the day is shown. Defaults to `{ dateStyle: 'medium' }`. */
  format?: Intl.DateTimeFormatOptions
  locale?: string
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
}

export function DateField({ typing = true, onProblem, ...props }: DateFieldProps) {
  return typing ? <TypedDate {...props} onProblem={onProblem} /> : <DateButton {...props} />
}

type ModeProps = Omit<DateFieldProps, 'typing'>

function TypedDate({
  id,
  value,
  onChange,
  onPick,
  onProblem,
  placeholder,
  clearable = false,
  invalid = false,
  readOnly = false,
  defaultOpen = false,
  modal,
  onOpenChange,
  format,
  locale,
  className,
  'aria-describedby': describedBy,
  ...aria
}: ModeProps) {
  const messageId = useId()
  const [open, setOpen] = useState(defaultOpen && !readOnly)
  const box = useRef<HTMLInputElement>(null)
  const group = useRef<HTMLDivElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const shown = (day: PlainDate) => formatPlainDate(day, format, locale)
  const [text, setText] = useState(() => shown(value))
  // What's typed can't be read: its message, shown once the box is left (or on Enter).
  const [problem, setProblem] = useState<string | null>(null)
  const [told, setTold] = useState(false)
  // The value this box last gave. Any other came from outside (the record
  // saved elsewhere, a reset form) and replaces what's typed.
  const [given, setGiven] = useState(value)
  if (value !== given) {
    setGiven(value)
    setText(shown(value))
    setProblem(null)
    setTold(false)
  }

  const report = (next: string | null) => {
    if (next !== problem) onProblem?.(next)
    setProblem(next)
  }
  const give = (day: PlainDate) => {
    setGiven(day)
    if (day !== value) onChange(day)
  }
  const type = (typed: string) => {
    setText(typed)
    setTold(false)
    const day = parsePlainDate(typed, { locale })
    if (day === null) {
      report(unreadableDateMessage(locale))
      give('')
    } else {
      report(null)
      give(day)
    }
  }
  // Leaving the box (or Enter): a day it read reads back the way it's shown.
  const settle = () => {
    if (problem) setTold(true)
    else setText(shown(given))
  }
  const changeOpen = (next: boolean) => {
    if (next && readOnly) return
    setOpen(next)
    onOpenChange?.(next)
  }
  const pick = (day: PlainDate) => {
    setGiven(day)
    setText(shown(day))
    report(null)
    setTold(false)
    changeOpen(false)
    ;(onPick ?? onChange)(day)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') settle()
    // Alt+Down opens the calendar, as it opens a select's list.
    if (event.key === 'ArrowDown' && event.altKey) {
      event.preventDefault()
      changeOpen(true)
    }
  }
  const selected = plainDateToLocal(given)
  const showProblem = told && problem !== null
  return (
    <div data-slot="date-field" data-kind="date" className={cn('flex w-full min-w-0 flex-col gap-1.5', className)}>
      <InputGroup ref={group}>
        <InputGroupInput
          ref={box}
          id={id}
          value={text}
          onChange={(event) => type(event.target.value)}
          onBlur={settle}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? plainDateExamples(locale)}
          readOnly={readOnly}
          autoComplete="off"
          aria-invalid={invalid || showProblem || undefined}
          aria-describedby={[showProblem ? messageId : null, describedBy].filter(Boolean).join(' ') || undefined}
          {...aria}
        />
        <InputGroupAddon align="inline-end">
          <Popover open={open} onOpenChange={changeOpen} modal={modal}>
            <PopoverTrigger
              render={
                <InputGroupButton type="button" size="icon-xs" variant="ghost" disabled={readOnly} aria-label="Open Calendar" />
              }
            >
              <CalendarIcon aria-hidden="true" />
            </PopoverTrigger>
            <PopoverContent
              ref={popup}
              anchor={group}
              align="start"
              className="w-auto p-0"
              data-slot="date-field-calendar"
              // The day the keyboard starts from (the chosen one, else today).
              initialFocus={() => popup.current?.querySelector<HTMLElement>('button[data-day][tabindex="0"]') ?? true}
              // Back to the box, where typing goes on.
              finalFocus={box}
            >
              <Calendar
                mode="single"
                // Picking the chosen day again keeps it (and closes), never unsets it: Clear does that.
                required
                selected={selected}
                defaultMonth={selected}
                onSelect={(date: Date) => pick(localToPlainDate(date))}
              />
              {clearable && given && (
                <div className="border-t border-border p-2">
                  <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => pick('')}>
                    Clear
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </InputGroupAddon>
      </InputGroup>
      {showProblem && (
        <p id={messageId} data-slot="date-field-problem" className="type-caption text-destructive-text">
          {problem}
        </p>
      )}
    </div>
  )
}

function DateButton({
  id,
  value,
  onChange,
  onPick,
  placeholder = 'Pick a date',
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
}: ModeProps) {
  const [open, setOpen] = useState(defaultOpen && !readOnly)
  const popup = useRef<HTMLDivElement>(null)
  const selected = plainDateToLocal(value)
  const shown = formatPlainDate(value, format, locale)

  const changeOpen = (next: boolean) => {
    if (next && readOnly) return
    setOpen(next)
    onOpenChange?.(next)
  }
  const pick = (next: PlainDate) => {
    ;(onPick ?? onChange)(next)
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
            data-kind="date"
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
        data-slot="date-field-calendar"
        // The day the keyboard starts from (the chosen one, else today):
        // the one day react-day-picker makes tabbable. The popup would
        // otherwise take focus itself, past the Calendar's autoFocus.
        initialFocus={() => popup.current?.querySelector<HTMLElement>('button[data-day][tabindex="0"]') ?? true}
      >
        <Calendar
          mode="single"
          // Picking the chosen day again keeps it (and closes), never unsets it: Clear does that.
          required
          selected={selected}
          defaultMonth={selected}
          onSelect={(date: Date) => pick(localToPlainDate(date))}
        />
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
