// The controls behind the `inPlace` presets that hold state or lay out
// several parts (edit-in-place-presets.tsx), kept in a file of their own
// so the presets' file exports no components.
import type { ReactNode } from 'react'
import { FieldError } from '@/components/ui/field'
import type { EditControlProps, EditKind } from './edit-in-place'
import type { InPlacePart, InPlaceReferenceConfig } from './edit-in-place-presets'
import { ReferenceCombobox } from './reference-combobox'

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

function controlAria(props: Pick<EditControlProps<unknown>, 'label' | 'describedBy' | 'invalid'>) {
  return {
    'aria-label': props.label,
    'aria-describedby': props.describedBy,
    'aria-invalid': props.invalid || undefined,
  }
}

type ReferencePickerProps<Id extends string | number> = {
  props: EditControlProps<Id | null>
  alone: boolean
  config: InPlaceReferenceConfig<Id>
}

// The reference's combobox (ReferenceCombobox, the form's): alone, its
// list opens with the field and a pick (or a record created from it) saves.
export function ReferencePicker<Id extends string | number>({ props, alone, config }: ReferencePickerProps<Id>) {
  return (
    <ReferenceCombobox
      id={props.id}
      value={props.value}
      onValueChange={(id) => (alone ? props.commit(id) : props.onChange(id))}
      search={config.search}
      label={config.label}
      required={config.required}
      emptyLabel={config.emptyLabel}
      placeholder={config.placeholder}
      emptyText={config.emptyText}
      onCreate={config.onCreate}
      readOnly={props.disabled}
      defaultOpen={alone}
      {...controlAria(props)}
    />
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

