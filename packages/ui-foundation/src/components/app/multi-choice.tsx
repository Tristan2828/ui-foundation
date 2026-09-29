// A multi-choice picker: selected options as removable chips, the rest in a
// filterable dropdown. The one control for every "multi choice" field
// (docs/entities/_template.md) — on a form (Widget Tags) and as a table
// filter — so entities reuse it rather than re-assembling the combobox
// primitive each time. Built on shadcn's Combobox `multiple` mode, following
// its own ComboboxMultiple example.
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
    <Combobox multiple autoHighlight items={options} value={value} onValueChange={(next) => onValueChange(next as T[])}>
      <ComboboxChips ref={anchor} className={className}>
        <ComboboxValue>
          {(selected: T[]) => (
            <React.Fragment>
              {selected.map((option) => (
                <ComboboxChip key={option}>{option}</ComboboxChip>
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
              {option}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
