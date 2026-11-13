// A small choice as a row of buttons (4.88, the form standard's F10): two
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
//
// Never cut off (4.97): in a box narrower than the row (a field sharing a
// form's row, a dialog's column, a narrow panel) the buttons wrap onto a
// second line, each keeping its whole border, instead of spilling past the
// box's edge. The first line stays joined; a wrapped line starts a new row
// of joined buttons a little below it.
//
// The picked one in the theme colour (4.105): a primary-tinted fill, a
// primary border and its word in `text-primary-text`, so a pick reads at a
// glance, not only as a grey tint.
//
// An option can carry an icon, or a status kind (4.105): `kind` draws the
// kind's icon in its colour (StatusMark's, lib/status-kinds.ts), so a
// status choice on a form looks like the status on the record. The word
// keeps the button's own colour; the kind's icon colour stays, picked or
// not.
import type { ReactNode } from 'react'
import { cn } from 'cn'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { STATUS_KIND_ICONS, STATUS_KIND_TONES, type StatusKind } from '@/lib/status-kinds'
import type { IconComponent } from './icon-component'

export type ChoiceButtonsOption<T> = {
  value: T
  label: string
  /** A status kind (4.105): its icon, in its colour, before the word, as StatusMark draws it. */
  kind?: StatusKind
  /** An icon before the word; with `kind`, in place of the kind's. Uncoloured without a `kind`. */
  icon?: IconComponent
}

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
        'max-w-full min-w-0 flex-wrap gap-y-1 rounded-md pl-px aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...aria}
    >
      {options.map((option, index) => (
        <ToggleGroupItem
          key={String(option.value)}
          value={String(index)}
          className={cn(
            // Every button has its left border (`!`: the joined group drops it
            // after the first) and overlaps the one before by it, so a button
            // that wraps to a new line starts with an edge; `pl-px` on the
            // group keeps that edge inside the box.
            '-ml-px border-l! h-(--control-height,--spacing(8)) max-w-full px-3 font-normal text-muted-foreground',
            // Picked: the theme colour. On top of the ones before and
            // after it (`z-1`), so its whole border shows where they overlap.
            'aria-pressed:z-1 aria-pressed:border-primary aria-pressed:bg-primary/12 aria-pressed:font-medium aria-pressed:text-primary-text hover:aria-pressed:bg-primary/16 hover:aria-pressed:text-primary-text',
            invalid && 'border-destructive',
          )}
        >
          <OptionIcon option={option} />
          {render ? render(option.value, option.label) : option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

function OptionIcon<T>({ option }: { option: ChoiceButtonsOption<T> }) {
  const Icon = option.icon ?? (option.kind ? STATUS_KIND_ICONS[option.kind] : undefined)
  if (!Icon) return null
  return (
    <Icon
      aria-hidden="true"
      data-slot="choice-buttons-icon"
      data-kind={option.kind}
      className={cn('size-3.5 shrink-0', option.kind && STATUS_KIND_TONES[option.kind])}
    />
  )
}
