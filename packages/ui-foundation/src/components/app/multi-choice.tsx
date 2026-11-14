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

export function MultiChoice<T extends string>({
  options,
  value,
  onValueChange,
  getLabel = String,
  id,
  placeholder,
  label,
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
}) {
  const anchor = useComboboxAnchor()
  const summarised = label !== undefined && value.length > 0

  return (
    <Combobox
      multiple
      autoHighlight
      items={options}
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
      itemToStringLabel={getLabel}
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
                <span data-slot="multi-choice-summary" className="min-w-0 truncate pl-1 type-body text-foreground">
                  {label}: {getLabel(selected[0] as T)}
                  {selected.length > 1 && <span className="text-muted-foreground"> +{selected.length - 1}</span>}
                </span>
              ) : null}
              {(label === undefined ? selected : []).map((option) => (
                // A plain string child, so the chip's remove button is named
                // "Remove <label>" (combobox.tsx).
                <ComboboxChip key={option}>{getLabel(option)}</ComboboxChip>
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
              {getLabel(option)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
