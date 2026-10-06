// A multi-reference picker: links to several records of another entity,
// shown as removable chips, with the rest found by typing. The one control
// for every "multi reference" field (conventions/docs/entity-plan-template.md),
// on a form (Widget Extra Categories) and as a table filter.
//
// MultiChoice's sibling, for values that are record ids rather than enum
// strings. Two differences follow from that:
// - A chip needs a *name* for an id the current search may not include
//   (editing a saved record, a filter from a shared link). The app fetches
//   names for exactly the picked ids (Widget: GET /categories?ids=...) and
//   passes `getLabel`; this component never guesses one.
// - Matching happens on the server: `onSearchChange` reports what was typed
//   and `options` is whatever the app's search query returned, so nothing
//   is filtered here (filter={null}).
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

/** Shown on a chip whose name hasn't loaded yet, instead of a bare id. */
const PENDING_LABEL = '…'

export function MultiReference<Id extends string | number>({
  options,
  value,
  onValueChange,
  getLabel,
  onSearchChange,
  id,
  placeholder,
  emptyText = 'No matches.',
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  readOnly = false,
  className,
}: {
  /** The records the current search returned, in display order. */
  options: readonly { id: Id; label: string }[]
  /** The picked ids. */
  value: Id[]
  onValueChange: (value: Id[]) => void
  /**
   * The name of any id: a picked one (from the app's lookup by ids) or an
   * option. `undefined` while it's still loading.
   */
  getLabel: (id: Id) => string | undefined
  /** Called with the typed text; the app feeds it to its search query. */
  onSearchChange: (search: string) => void
  /** Id for the text input, so a <FieldLabel htmlFor> labels it. */
  id?: string
  placeholder?: string
  /** Shown in the dropdown when the search matches nothing. */
  emptyText?: string
  /** For use without a visible label (e.g. a table toolbar filter). */
  'aria-label'?: string
  'aria-invalid'?: boolean
  /** The id of a line under the control (an error, a saving status). */
  'aria-describedby'?: string
  /** Shown, not changeable: editing in place, while the save is in flight. */
  readOnly?: boolean
  className?: string
}) {
  const anchor = useComboboxAnchor()
  const label = (option: Id) => getLabel(option) ?? PENDING_LABEL

  return (
    <Combobox
      multiple
      autoHighlight
      // Ids, not {id,label} objects: Base UI compares items to the value
      // with Object.is, so the items must have the value's own shape.
      items={options.map((option) => option.id)}
      value={value}
      onValueChange={(next) => onValueChange(next as Id[])}
      onInputValueChange={onSearchChange}
      itemToStringLabel={label}
      filter={null}
      readOnly={readOnly}
    >
      <ComboboxChips ref={anchor} className={className}>
        <ComboboxValue>
          {(selected: Id[]) => (
            <React.Fragment>
              {selected.map((option) => (
                // A plain string child, so the chip's remove button is named
                // "Remove <name>" (combobox.tsx).
                <ComboboxChip key={option}>{label(option)}</ComboboxChip>
              ))}
              <ComboboxChipsInput
                id={id}
                aria-label={ariaLabel}
                aria-invalid={ariaInvalid}
                aria-describedby={ariaDescribedBy}
                placeholder={selected.length === 0 ? placeholder : undefined}
              />
            </React.Fragment>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(option: Id) => (
            <ComboboxItem key={option} value={option}>
              {label(option)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
