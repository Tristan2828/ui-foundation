// One of a fixed list on a form (4.85, the form standard's F11), drawn the
// way the value is drawn everywhere else: `render` (a status's badge in
// its tone) on the trigger and on every item, as `inPlace.select`'s
// `render` does in place, so a status reads the same in the box, in its
// list, on the row and on the record. The options are `inPlace.select`'s
// (`{ value, label }`), so one list and one `render` serve both.
//
// Not `required`: the list starts with "Not set", which gives `null`.
// Base UI's Select shows its raw value unless told otherwise; this maps
// each option to its index, so any string or number works as a value and
// the trigger always shows the option's words or its `render`.
import type { ReactNode } from 'react'
import { cn } from 'cn'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const NONE = '__none__'

export type OptionSelectOption<T> = { value: T; label: string }

export type OptionSelectProps<T extends string | number> = {
  id?: string
  /** Every option, in the order the list shows them. */
  options: readonly OptionSelectOption<T>[]
  value: T | null
  onValueChange: (value: T | null) => void
  /** How an option reads on the trigger and in the list (a badge). Defaults to its label. */
  render?: (value: T, label: string) => ReactNode
  /** No "Not set" option: one of the list must be picked. */
  required?: boolean
  /** The "Not set" option's words. */
  emptyLabel?: string
  /** The trigger's words while nothing is picked (a required one). */
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  modal?: boolean
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
}

export function OptionSelect<T extends string | number>({
  id,
  options,
  value,
  onValueChange,
  render,
  required = false,
  emptyLabel = 'Not set',
  placeholder = 'Pick one',
  invalid = false,
  disabled,
  defaultOpen,
  onOpenChange,
  modal,
  className,
  ...aria
}: OptionSelectProps<T>) {
  const shown = (option: OptionSelectOption<T>) => (render ? render(option.value, option.label) : option.label)
  const at = value == null ? -1 : options.findIndex((option) => option.value === value)
  const key = at === -1 ? (required ? null : NONE) : String(at)
  return (
    <Select
      value={key}
      onValueChange={(next) => {
        if (next === null) return
        onValueChange(next === NONE ? null : (options[Number(next)]?.value ?? null))
      }}
      disabled={disabled}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      modal={modal}
    >
      <SelectTrigger id={id} aria-invalid={invalid || undefined} className={cn('w-full', className)} {...aria}>
        <SelectValue placeholder={placeholder}>
          {(picked: string | null) => {
            if (picked === null) return placeholder
            if (picked === NONE) return <span className="text-muted-foreground">{emptyLabel}</span>
            const option = options[Number(picked)]
            return option ? shown(option) : placeholder
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {!required && <SelectItem value={NONE}>{emptyLabel}</SelectItem>}
        {options.map((option, index) => (
          <SelectItem key={String(option.value)} value={String(index)}>
            {shown(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
