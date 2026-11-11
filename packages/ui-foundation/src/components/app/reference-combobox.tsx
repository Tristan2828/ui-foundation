// Another record, picked from a list searched as you type: the one control
// for a single reference, on a form and edited in place (`inPlace.reference`
// draws it). The package knows no endpoint: `search` is the app's (its
// gateway's search by name), called with what's typed (`''` when the
// list opens). Names come from the searches and from the saved record's
// `label`, so a pick the current search no longer returns still shows its
// name.
//
// `onCreate` (4.88, the form standard's F14): when what's typed matches no
// record's name, Create "<typed>" is the list's last item. Picking it
// calls the app's `onCreate(name)`, which opens its small create form (a
// FormDialog) with the name filled in and resolves with the new record
// once it's saved: that record is then picked. While that form is open,
// an edit in place holding this control stays open (`data-edit-hold`).
import { useEffect, useRef, useState } from 'react'
import { namesRecord } from '@/lib/names-record'
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox'

/** A record found by search: its id and its name. */
export type ReferenceRecord<Id> = { id: Id; label: string }

export type ReferenceComboboxProps<Id extends string | number> = {
  /** The box's id, for the field's `<FieldLabel htmlFor>`. */
  id?: string
  /** The picked record's id, or `null`. */
  value: Id | null
  onValueChange: (value: Id | null) => void
  /** Finds records by what's typed. Rejects to show nothing found. */
  search: (text: string) => Promise<readonly ReferenceRecord<Id>[]>
  /** The picked record's name (the app's lookup by id), shown in the box. */
  label?: string
  /** No "Not set" item: a record must be picked. */
  required?: boolean
  /** The "Not set" item's words, for an optional reference. */
  emptyLabel?: string
  placeholder?: string
  /** What the list says when nothing matches. Defaults to "No matches." */
  emptyText?: string
  /**
   * Offers Create "<typed>" when what's typed matches no record's name.
   * Opens the app's create form with the name; resolves with the saved
   * record (then picked), or `null` when the form was cancelled.
   */
  onCreate?: (name: string) => Promise<ReferenceRecord<Id> | null>
  readOnly?: boolean
  /** Open the list on mount (editing in place, where it opens with the field). */
  defaultOpen?: boolean
  invalid?: boolean
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
}

/** A select's and a combobox's items are strings: a record's id, or this for "Not set". */
const NONE = '__none__'
/** The Create "<typed>" item. */
const CREATE = '__create__'

// How long typing pauses before the search runs.
const SEARCH_DELAY_MS = 200

export function ReferenceCombobox<Id extends string | number>({
  id,
  value,
  onValueChange,
  search,
  label,
  required = false,
  emptyLabel = 'Not set',
  placeholder = 'Search',
  emptyText = 'No matches.',
  onCreate,
  readOnly = false,
  defaultOpen = false,
  invalid = false,
  ...aria
}: ReferenceComboboxProps<Id>) {
  const [text, setText] = useState('')
  const [found, setFound] = useState<readonly ReferenceRecord<Id>[]>([])
  const [creating, setCreating] = useState(false)
  const [names] = useState(() => new Map<string, ReferenceRecord<Id>>())
  if (value != null && label !== undefined && !names.has(String(value))) names.set(String(value), { id: value, label })
  for (const record of found) names.set(String(record.id), record)
  // The search is the app's, often a new function each render: the
  // latest is called, and only what's typed starts a search.
  const latestSearch = useRef(search)
  useEffect(() => {
    latestSearch.current = search
  })
  useEffect(() => {
    let live = true
    const timer = setTimeout(
      () => {
        latestSearch.current(text).then(
          (records) => {
            if (live) setFound(records)
          },
          () => {
            if (live) setFound([])
          },
        )
      },
      text === '' ? 0 : SEARCH_DELAY_MS,
    )
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [text])
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const typed = text.trim()
  const offerCreate = Boolean(onCreate) && typed !== '' && !namesRecord(found, typed)
  const picked = value == null ? null : String(value)
  const items = [...(required ? [] : [NONE]), ...found.map((record) => String(record.id)), ...(offerCreate ? [CREATE] : [])]
  const nameOf = (key: string) => (key === NONE || key === CREATE ? '' : (names.get(key)?.label ?? ''))

  const create = (name: string) => {
    if (!onCreate) return
    setCreating(true)
    onCreate(name).then(
      (record) => {
        if (mounted.current) setCreating(false)
        if (!record) return
        names.set(String(record.id), record)
        onValueChange(record.id)
      },
      () => {
        if (mounted.current) setCreating(false)
      },
    )
  }

  return (
    <Combobox<string>
      items={items}
      value={picked}
      onValueChange={(key) => {
        if (key == null) return
        if (key === CREATE) {
          create(typed)
          return
        }
        onValueChange(key === NONE ? null : (names.get(key)?.id ?? null))
      }}
      // The box showing the pick's own name is no search: the list then
      // offers everything, not only the one already picked.
      onInputValueChange={(next) => setText(picked !== null && next === nameOf(picked) ? '' : next)}
      itemToStringLabel={nameOf}
      filter={null}
      readOnly={readOnly || creating}
      defaultOpen={defaultOpen}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-busy={creating || undefined}
        // An edit in place holding this stays open while the app's create form is.
        data-edit-hold={creating ? '' : undefined}
        {...aria}
      />
      <ComboboxContent>
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {items.map((key) => (
            <ComboboxItem key={key} value={key} data-create={key === CREATE ? '' : undefined}>
              {key === NONE ? emptyLabel : key === CREATE ? `Create "${typed}"` : nameOf(key)}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
