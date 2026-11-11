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
// - Until that search answers, the list still holds the last one's
//   results, its first still highlighted. `searching` says so: Enter
//   waits rather than picking from the old list (where it could even
//   remove a pick: the highlighted item may be one already picked).
// - `onCreate` (4.86, F14): Create "<typed>" as the list's last item when
//   what's typed names no option; the app's create form resolves with the
//   new record, which joins the picks (its name kept here until the app's
//   lookup has it).
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
import { namesRecord } from '@/lib/names-record'
import type { ReferenceRecord } from './reference-combobox'

/** Shown on a chip whose name hasn't loaded yet, instead of a bare id. */
const PENDING_LABEL = '…'
/** The Create "<typed>" item. */
const CREATE = '__create__'

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
  searching = false,
  onCreate,
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
  /**
   * The options don't answer what's typed yet: the app's search for it is
   * in flight and the list still shows the last one's results (TanStack
   * Query with `placeholderData: (previous) => previous`:
   * `isPlaceholderData`). Enter does nothing until it answers; a click
   * still picks. The list is `aria-busy` meanwhile.
   */
  searching?: boolean
  /**
   * Offers Create "<typed>" when what's typed names no option: the app
   * opens its small create form with the name and resolves with the saved
   * record (added to the picks), or `null` when it was cancelled.
   */
  onCreate?: (name: string) => Promise<ReferenceRecord<Id> | null>
  className?: string
}) {
  const anchor = useComboboxAnchor()
  const [typed, setTyped] = React.useState('')
  const [created] = React.useState(() => new Map<Id, string>())
  const [creating, setCreating] = React.useState(false)
  const label = (option: Id) => getLabel(option) ?? created.get(option) ?? PENDING_LABEL
  const name = typed.trim()
  const offerCreate = Boolean(onCreate) && name !== '' && !searching && !namesRecord(options, name)
  const items: Id[] = [...options.map((option) => option.id), ...(offerCreate ? [CREATE as Id] : [])]
  const latest = React.useRef(value)
  React.useEffect(() => {
    latest.current = value
  })
  const create = () => {
    if (!onCreate) return
    setCreating(true)
    onCreate(name).then(
      (record) => {
        setCreating(false)
        if (!record) return
        created.set(record.id, record.label)
        if (!latest.current.includes(record.id)) onValueChange([...latest.current, record.id])
      },
      () => setCreating(false),
    )
  }

  return (
    <Combobox
      multiple
      autoHighlight
      // Ids, not {id,label} objects: Base UI compares items to the value
      // with Object.is, so the items must have the value's own shape.
      items={items}
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
        const picks = next as Id[]
        if (picks.includes(CREATE as Id)) {
          create()
          return
        }
        onValueChange(picks)
      }}
      onInputValueChange={(text) => {
        setTyped(text)
        onSearchChange(text)
      }}
      itemToStringLabel={label}
      filter={null}
      readOnly={readOnly || creating}
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
                onKeyDown={(event) => {
                  if (searching && event.key === 'Enter') {
                    event.preventDefault()
                    event.preventBaseUIHandler()
                  }
                }}
                aria-label={ariaLabel}
                aria-invalid={ariaInvalid}
                aria-describedby={ariaDescribedBy}
                aria-busy={creating || undefined}
                // An edit in place holding this stays open while the app's create form is.
                data-edit-hold={creating ? '' : undefined}
                placeholder={selected.length === 0 ? placeholder : undefined}
              />
            </React.Fragment>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList aria-busy={searching || undefined}>
          {(option: Id) => (
            <ComboboxItem key={option} value={option} data-create={option === CREATE ? '' : undefined}>
              {option === CREATE ? `Create "${name}"` : label(option)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
