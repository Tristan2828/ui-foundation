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
import * as React from 'react'
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

export function MultiChoice<T extends string>({
  options,
  value,
  onValueChange,
  getLabel = String,
  id,
  placeholder,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  className,
}: {
  /** Every allowed option, in display order. */
  options: readonly T[]
  value: T[]
  onValueChange: (value: T[]) => void
  /**
   * The text shown for an option: on its chip, in the dropdown, and what
   * typing matches against. Defaults to the value itself.
   */
  getLabel?: (value: T) => string
  /** Id for the text input, so a <FieldLabel htmlFor> labels it. */
  id?: string
  placeholder?: string
  /** For use without a visible label (e.g. a table toolbar filter). */
  'aria-label'?: string
  'aria-invalid'?: boolean
  className?: string
}) {
  const anchor = useComboboxAnchor()

  return (
    <Combobox
      multiple
      autoHighlight
      items={options}
      value={value}
      onValueChange={(next) => onValueChange(next as T[])}
      itemToStringLabel={getLabel}
    >
      <ComboboxChips ref={anchor} className={className}>
        <ComboboxValue>
          {(selected: T[]) => (
            <React.Fragment>
              {selected.map((option) => (
                // A plain string child, so the chip's remove button is named
                // "Remove <label>" (combobox.tsx).
                <ComboboxChip key={option}>{getLabel(option)}</ComboboxChip>
              ))}
              <ComboboxChipsInput
                id={id}
                aria-label={ariaLabel}
                aria-invalid={ariaInvalid}
                placeholder={selected.length === 0 ? placeholder : undefined}
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
              {getLabel(option)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
