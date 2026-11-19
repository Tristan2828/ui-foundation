// A multi-choice picker: selected options as removable chips, the rest in a
// filterable dropdown. The one control for every "multi choice" field
// (conventions/docs/entity-plan-template.md) — on a form (Widget Tags) and as a table
// filter — so entities reuse it rather than re-assembling the combobox
// primitive each time. Built on shadcn's Combobox `multiple` mode, following
// its own ComboboxMultiple example.
//
// Values are the wire's enum strings; `getLabel` names them when those
// aren't fit to show (`quick_win` → "Quick win"). Chips, options and the
// typed-text match all use the label, and the value is what's emitted.
//
// A toolbar filter's summary ("Status: Active +1", `label`) keeps the
// control one line high however narrow it is (4.109): it truncates, and
// the text box beside it takes no room until it's focused.
//
// An option can carry a status kind or an icon (4.130), as OptionSelect's
// and ChoiceButtons' do, drawn by the same OptionIcon: pass the options as
// `{ value, label, kind?, icon? }` (OptionSelectOption) in place of bare
// values. The icon goes before the words on the option in the list, on its
// chip and on the summary's first pick. Decorative: the words say it.
import * as React from 'react'
import { cn } from 'cn'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox'
import { OptionIcon } from './option-icon'
import type { OptionSelectOption } from './option-select'

/** An option with its words and, optionally, its icon: OptionSelect's option, the same shape. */
export type MultiChoiceOption<T extends string> = OptionSelectOption<T>

export type MultiChoiceProps<T extends string> = {
  /**
   * Every allowed option, in display order: bare values, or (4.130)
   * OptionSelect's `{ value, label, kind?, icon? }`, whose `label` names it
   * and whose `kind` or `icon` is drawn before the words, as OptionSelect
   * draws it.
   */
  options: readonly T[] | readonly MultiChoiceOption<T>[]
  value: T[]
  onValueChange: (value: T[]) => void
  /**
   * The text shown for an option: on its chip, in the dropdown, and what
   * typing matches against. Defaults to the value itself, or to the
   * option's `label` when options are objects.
   */
  getLabel?: (value: T) => string
  /** Id for the text input, so a <FieldLabel htmlFor> labels it. */
  id?: string
  placeholder?: string
  /**
   * A toolbar filter that names itself (the list page standard, L4): with
   * picks it shows "<label>: <first> +N" in place of a chip per pick, so
   * it stays one line; with none, the `placeholder` ("Any status"). Picks
   * come off in the list, or with Backspace. Leave it out on a form, where
   * every pick is its own chip.
   */
  label?: string
  /** For use without a visible label (e.g. a table toolbar filter). */
  'aria-label'?: string
  'aria-invalid'?: boolean
  className?: string
}

export function MultiChoice<T extends string>({
  options,
  value,
  onValueChange,
  getLabel,
  id,
  placeholder,
  label,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  className,
}: MultiChoiceProps<T>) {
  const anchor = useComboboxAnchor()
  // Bare values or option objects: the values are what the combobox holds,
  // the objects (by value) give the words and the icon.
  const { values, byValue } = React.useMemo(() => {
    const byValue = new Map<T, MultiChoiceOption<T>>()
    const values = options.map((option) => {
      if (typeof option === 'string') return option
      byValue.set(option.value, option)
      return option.value
    })
    return { values, byValue }
  }, [options])
  const labelOf = (option: T) => (getLabel ? getLabel(option) : (byValue.get(option)?.label ?? String(option)))
  const iconOf = (option: T, slot: string) => {
    const found = byValue.get(option)
    return found ? <OptionIcon kind={found.kind} icon={found.icon} slot={slot} /> : null
  }
  const hasIcon = (option: T) => {
    const found = byValue.get(option)
    return Boolean(found && (found.kind || found.icon))
  }
  const summarised = label !== undefined && value.length > 0

  return (
    <Combobox
      multiple
      autoHighlight
      items={values}
      value={value}
      onValueChange={(next, details) => {
        // Base UI empties the value on Escape while the list is closed, so
        // a second Escape after a pick wiped every chip (issue #123). Escape
        // never removes picks here: a chip's remove button, Backspace or
        // unpicking in the list does. Let the key go on, so a dialog or an
        // edit in place gets its own Escape.
        if (details.reason === 'escape-key') {
          details.cancel()
          details.allowPropagation()
          return
        }
        onValueChange(next as T[])
      }}
      itemToStringLabel={labelOf}
    >
      {/* With a summary (4.109): one line at the control's own height. The
          row doesn't wrap, the summary truncates with an ellipsis, and the
          text box takes no room until it's focused, so "Status: Active +1"
          in a narrow filter stays as tall as the inputs beside it. */}
      <ComboboxChips ref={anchor} className={cn(summarised && 'flex-nowrap', className)}>
        <ComboboxValue>
          {(selected: T[]) => (
            <React.Fragment>
              {label !== undefined && selected.length > 0 ? (
                hasIcon(selected[0] as T) ? (
                  // With an icon: "Status: <icon> Active +1", the label and
                  // the icon kept whole and the rest truncating, on one line.
                  <span
                    data-slot="multi-choice-summary"
                    className="flex min-w-0 items-center gap-1.5 pl-1 type-body text-foreground"
                  >
                    <span className="shrink-0">{label}:</span>
                    {iconOf(selected[0] as T, 'multi-choice-icon')}
                    <span className="min-w-0 truncate">
                      {labelOf(selected[0] as T)}
                      {selected.length > 1 && <span className="text-muted-foreground"> +{selected.length - 1}</span>}
                    </span>
                  </span>
                ) : (
                  <span data-slot="multi-choice-summary" className="min-w-0 truncate pl-1 type-body text-foreground">
                    {label}: {labelOf(selected[0] as T)}
                    {selected.length > 1 && <span className="text-muted-foreground"> +{selected.length - 1}</span>}
                  </span>
                )
              ) : null}
              {(label === undefined ? selected : []).map((option) => (
                // `removeLabel`, so the chip's remove button is named
                // "Remove <label>" with an icon beside the words (combobox.tsx).
                <ComboboxChip key={option} removeLabel={labelOf(option)}>
                  {iconOf(option, 'multi-choice-icon')}
                  {labelOf(option)}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                id={id}
                aria-label={ariaLabel}
                aria-invalid={ariaInvalid}
                placeholder={selected.length === 0 ? placeholder : undefined}
                className={summarised ? 'min-w-0 focus:min-w-16' : undefined}
              />
            </React.Fragment>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>No options found.</ComboboxEmpty>
        <ComboboxList>
          {(option: T) => (
            <ComboboxItem key={option} value={option}>
              {iconOf(option, 'multi-choice-icon')}
              {labelOf(option)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
