// The controls behind the `inPlace` presets that hold state or lay out
// several parts (edit-in-place-presets.tsx), kept in a file of their own
// so the presets' file exports no components.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox'
import { FieldError } from '@/components/ui/field'
import type { EditControlProps, EditKind } from './edit-in-place'
import type { InPlacePart, InPlaceRecord, InPlaceReferenceConfig } from './edit-in-place-presets'

export type Checked<TValue> = { ok: true; value: TValue } | { ok: false; message: string }

// How a value becomes what its control holds (the draft), how a draft is
// checked back into a value, how a value reads, and the control. `alone`
// is the control as a field of its own (a list opens with it, a pick
// saves); without it, one part of several (`inPlace.fields`).
export type Kind<TValue, TDraft> = {
  editKind: EditKind
  toDraft: (value: TValue) => TDraft
  check: (draft: TDraft) => Checked<TValue>
  show: (value: TValue) => ReactNode
  control: (props: EditControlProps<TDraft>, alone: boolean) => ReactNode
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a part's kind, whatever its value
export type AnyKind = Kind<any, any>

/** A select's and a combobox's items are strings: the option's position, or this for "Not set". */
export const NONE = 'none'

function controlAria(props: Pick<EditControlProps<unknown>, 'label' | 'describedBy' | 'invalid'>) {
  return {
    'aria-label': props.label,
    'aria-describedby': props.describedBy,
    'aria-invalid': props.invalid || undefined,
  }
}

// How long typing pauses before the search runs.
const SEARCH_DELAY_MS = 200

type ReferencePickerProps<Id extends string | number> = {
  props: EditControlProps<Id | null>
  alone: boolean
  config: InPlaceReferenceConfig<Id>
}

// The reference's combobox: what's typed searches (through the app's
// `search`), a pick is the record's id. Names come from the searches and
// from the saved record's `label`, so a pick the current search no longer
// returns still shows its name.
export function ReferencePicker<Id extends string | number>({ props, alone, config }: ReferencePickerProps<Id>) {
  const [text, setText] = useState('')
  const [found, setFound] = useState<readonly InPlaceRecord<Id>[]>([])
  const [names] = useState(() => new Map<string, InPlaceRecord<Id>>())
  if (props.value != null && config.label !== undefined && !names.has(String(props.value)))
    names.set(String(props.value), { id: props.value, label: config.label })
  for (const record of found) names.set(String(record.id), record)
  // The search is the app's, often a new function each render: the
  // latest is called, and only what's typed starts a search.
  const search = useRef(config.search)
  useEffect(() => {
    search.current = config.search
  })
  useEffect(() => {
    let live = true
    const timer = setTimeout(
      () => {
        search.current(text).then(
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

  const picked = props.value == null ? null : String(props.value)
  const items = [...(config.required ? [] : [NONE]), ...found.map((record) => String(record.id))]
  const emptyLabel = config.emptyLabel ?? 'Not set'
  const nameOf = (key: string) => (key === NONE ? '' : (names.get(key)?.label ?? ''))
  return (
    <Combobox<string>
      items={items}
      value={picked}
      onValueChange={(key) => {
        if (key == null) return
        const id = key === NONE ? null : (names.get(key)?.id ?? null)
        if (alone) props.commit(id)
        else props.onChange(id)
      }}
      // The box showing the pick's own name is no search: the list then
      // offers everything, not only the one already picked.
      onInputValueChange={(typed) => setText(picked !== null && typed === nameOf(picked) ? '' : typed)}
      itemToStringLabel={nameOf}
      filter={null}
      readOnly={props.disabled}
      defaultOpen={alone}
    >
      <ComboboxInput id={props.id} placeholder={config.placeholder ?? 'Search'} {...controlAria(props)} />
      <ComboboxContent>
        <ComboboxEmpty>{config.emptyText ?? 'No matches.'}</ComboboxEmpty>
        <ComboboxList>
          {items.map((key) => (
            <ComboboxItem key={key} value={key}>
              {key === NONE ? emptyLabel : nameOf(key)}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

type PartsProps = {
  props: EditControlProps<Record<string, unknown>>
  keys: readonly string[]
  parts: Record<string, InPlacePart>
  kinds: Record<string, AnyKind>
}

// The parts side by side (stacked when the field is narrow), each with its
// own label over its control and its own refusal under it. A refusal
// about none of them (the rule across them) is the field's, under them all.
export function Parts({ props, keys, parts, kinds }: PartsProps) {
  const errors = props.errors
  return (
    <span className="flex flex-wrap items-start gap-3">
      {keys.map((key) => {
        const part = parts[key]!
        const partId = `${props.id}-${key}`
        const errorId = `${partId}-error`
        const error = errors?.[key]
        return (
          <span key={key} data-part={key} className="flex min-w-40 flex-1 flex-col gap-1">
            <span aria-hidden="true" className="type-caption text-muted-foreground">
              {part.label}
            </span>
            {kinds[key]!.control(
              {
                ...props,
                // The first part takes the field's id, so its label points at it.
                id: key === keys[0] ? props.id : partId,
                label: part.label,
                value: props.value[key],
                onChange: (next: unknown) => props.onChange({ ...props.value, [key]: next }),
                invalid: Boolean(error) || (props.invalid && !errors),
                describedBy: error ? `${errorId} ${props.describedBy}` : props.describedBy,
                errors: undefined,
              },
              false,
            )}
            {error && (
              <FieldError id={errorId} className="type-caption">
                {error}
              </FieldError>
            )}
          </span>
        )
      })}
    </span>
  )
}

