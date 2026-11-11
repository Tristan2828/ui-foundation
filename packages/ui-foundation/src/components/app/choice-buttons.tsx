// A small choice as a row of buttons (4.86, the form standard's F10): two
// to four short options, every one in view and one click away, instead of
// a select. Five or more, or long words, keep a select (OptionSelect).
//
// Base UI's toggle group, single: the buttons are joined, the picked one
// pressed (`aria-pressed`), the arrow keys move along them. The options
// are OptionSelect's and `inPlace.select`'s (`{ value, label }`), so one
// list serves the form, the select and editing in place
// (`inPlace.choice`, or `inPlace.select({ look: 'buttons' })`).
//
// Pressing the picked one again keeps it: a choice is changed, never
// emptied, by its buttons. `clearable` lets the picked one be pressed off
// (an optional field), giving `null`.
import type { ReactNode } from 'react'
import { cn } from 'cn'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export type ChoiceButtonsOption<T> = { value: T; label: string }

export type ChoiceButtonsProps<T extends string | number> = {
  /** The group's id. Name it with `aria-labelledby` (the FieldLabel's id) or `aria-label`. */
  id?: string
  /** Two to four short options, in the order they read. */
  options: readonly ChoiceButtonsOption<T>[]
  /** The picked one, or `null` for none. */
  value: T | null
  onValueChange: (value: T | null) => void
  /** How an option reads on its button. Defaults to its label. */
  render?: (value: T, label: string) => ReactNode
  /** Pressing the picked one again unpicks it (`null`): an optional field. */
  clearable?: boolean
  invalid?: boolean
  disabled?: boolean
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
}

export function ChoiceButtons<T extends string | number>({
  id,
  options,
  value,
  onValueChange,
  render,
  clearable = false,
  invalid = false,
  disabled = false,
  className,
  ...aria
}: ChoiceButtonsProps<T>) {
  const at = value == null ? -1 : options.findIndex((option) => option.value === value)
  return (
    <ToggleGroup
      id={id}
      data-slot="choice-buttons"
      variant="outline"
      spacing={0}
      value={at === -1 ? [] : [String(at)]}
      onValueChange={(next: string[]) => {
        const key = next[0]
        if (key === undefined) {
          if (clearable) onValueChange(null)
          return
        }
        const option = options[Number(key)]
        if (option && option.value !== value) onValueChange(option.value)
      }}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      className={cn(
        'max-w-full flex-wrap rounded-md aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...aria}
    >
      {options.map((option, index) => (
        <ToggleGroupItem
          key={String(option.value)}
          value={String(index)}
          className={cn(
            'h-(--control-height,--spacing(8)) px-3 font-normal text-muted-foreground aria-pressed:font-medium aria-pressed:text-foreground',
            invalid && 'border-destructive',
          )}
        >
          {render ? render(option.value, option.label) : option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
