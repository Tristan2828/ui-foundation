// A plain date, no time: when something was finished, a due day. The value
// is the wire's own `'YYYY-MM-DD'` (OpenAPI `format: date`), or `''` for
// not set, and it's read as a calendar day, never an instant: nothing here
// goes through the browser's time zone, so Sep 2 is Sep 2 everywhere.
//
// A button showing the day, opening the package's Calendar in a Popover.
// One control for the form (a react-hook-form `Controller`) and for
// editing in place (`editInPlace({ kind: 'choice' })`: picking a day saves,
// and the calendar opens with the field). `clearable` adds Clear for an
// optional field.
import { useRef, useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatPlainDate, localToPlainDate, plainDateToLocal, type PlainDate } from '@/lib/plain-date'

export type DateFieldProps = {
  /** The trigger button's id, for the field's `<FieldLabel htmlFor>`. */
  id?: string
  /** `'YYYY-MM-DD'`, or `''` for not set. */
  value: PlainDate
  /** Called with the picked day as `'YYYY-MM-DD'`, or `''` when cleared. */
  onChange: (value: PlainDate) => void
  /** What the button says with no day set. Defaults to "Pick a date". */
  placeholder?: string
  /** Offer Clear in the calendar, for an optional field. */
  clearable?: boolean
  /** The value was refused: `aria-invalid` on the button. */
  invalid?: boolean
  /** Saving: the button shows the day but won't open. */
  readOnly?: boolean
  /** Open on mount: editing in place, where the calendar opens with the field. */
  defaultOpen?: boolean
  /** Passed to the Popover; `false` when editing in place, as for a Select. */
  modal?: boolean
  /** Told when the calendar opens or closes; editing in place gives up on a close with nothing picked. */
  onOpenChange?: (open: boolean) => void
  /** How the day is shown on the button. Defaults to `{ dateStyle: 'medium' }`. */
  format?: Intl.DateTimeFormatOptions
  locale?: string
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
}

export function DateField({
  id,
  value,
  onChange,
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
}: DateFieldProps) {
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
