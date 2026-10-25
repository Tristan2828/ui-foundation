// One control per widget field, shared by the form (widget-form.tsx,
// through react-hook-form's Controller) and editing in place on the view
// (widget-view.tsx, through editInPlace). The same labels, choices and
// pickers in both places, never a second set. Each takes a value and
// reports changes; the form or the view decides when it saves.
//
// `readOnly` is editing in place's "saving" state: the value stays on
// screen, unchangeable, until the server answers.
import { useState, type ComponentProps, type ReactNode } from 'react'
import { MultiReference, RichTextEditor } from '@tristan2828/ui-foundation'
import { Checkbox } from '@tristan2828/ui-foundation/ui/checkbox'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@tristan2828/ui-foundation/ui/combobox'
import { Field } from '@tristan2828/ui-foundation/ui/field'
import { Input } from '@tristan2828/ui-foundation/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@tristan2828/ui-foundation/ui/select'
import type { components } from '@/api/schema'
import { useWidgetCategoriesByIdsQuery, useWidgetCategoriesQuery, widgetCategoryNames } from './use-widget-categories'
import { DESCRIPTION_MAX_LENGTH, WIDGET_STATUS_LABELS, WIDGET_STATUSES } from './widget-schema'

type WidgetStatus = components['schemas']['WidgetStatus']

export type WidgetFieldProps<T> = {
  id: string
  value: T
  onChange: (value: T) => void
  invalid?: boolean
  readOnly?: boolean
  /** Without a visible <FieldLabel> (in place, the view's own label names it). */
  'aria-label'?: string
  'aria-describedby'?: string
}

export function WidgetNameInput({ value, onChange, invalid, ...props }: WidgetFieldProps<string>) {
  return <Input {...props} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={invalid} />
}

export function WidgetPriceInput({ value, onChange, invalid, ...props }: WidgetFieldProps<string>) {
  return (
    <Input
      {...props}
      inputMode="decimal"
      placeholder="19.99"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-invalid={invalid}
    />
  )
}

// Single choice. In place, its list opens with the field (`defaultOpen`),
// a pick saves, closing it with no pick gives up (`onOpenChange`), and it
// isn't modal: the rest of the page stays usable, and a click elsewhere
// just closes it.
export function WidgetStatusSelect({
  id,
  value,
  onChange,
  invalid,
  readOnly,
  defaultOpen,
  onOpenChange,
  modal,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: WidgetFieldProps<WidgetStatus> & { defaultOpen?: boolean; onOpenChange?: (open: boolean) => void; modal?: boolean }) {
  return (
    <Select
      value={value}
      onValueChange={(status) => status && onChange(status)}
      disabled={readOnly}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      modal={modal}
    >
      <SelectTrigger id={id} aria-invalid={invalid} aria-label={ariaLabel} aria-describedby={ariaDescribedBy}>
        {/* Base UI's trigger shows the raw value unless told otherwise. */}
        <SelectValue placeholder="Select a status">
          {(status: WidgetStatus | null) => (status ? WIDGET_STATUS_LABELS[status] : 'Select a status')}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {WIDGET_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {WIDGET_STATUS_LABELS[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// Long text written as Markdown: edited as formatted text (the package's
// RichTextEditor), saved as Markdown with untouched blocks as written.
// Uncontrolled: it opens with `value` and reports every edit. A
// placeholder while it's empty, and a count as it nears the schema's
// limit (the schema still refuses a save over it).
export function WidgetDescriptionEditor({
  value,
  onChange,
  invalid,
  readOnly,
  onProblem,
  autoFocus,
  ...props
}: WidgetFieldProps<string> & {
  onProblem?: (message: string | null) => void
  autoFocus?: boolean
  'aria-labelledby'?: string
}) {
  return (
    <RichTextEditor
      {...props}
      defaultValue={value}
      onChange={onChange}
      onProblem={onProblem}
      readOnly={readOnly}
      autoFocus={autoFocus}
      placeholder="Describe the widget"
      maxLength={DESCRIPTION_MAX_LENGTH}
      aria-invalid={invalid}
    />
  )
}

// A checklist item's own fields, one row of the list: its done box and its
// text, named by position ("Item 2 text"), which is also how the list's
// buttons name it. The form registers the text (`textProps` is
// `register(...)`) and binds its error (`error`); in place, `textProps`
// carries the draft's value and its change, and the view shows the error.
export function WidgetChecklistItemFields({
  index,
  done,
  onDoneChange,
  invalid,
  readOnly,
  textProps,
  error,
}: {
  index: number
  done: boolean
  onDoneChange: (done: boolean) => void
  invalid?: boolean
  readOnly?: boolean
  textProps: ComponentProps<'input'>
  error?: ReactNode
}) {
  return (
    <>
      <Checkbox
        className="mt-2.5"
        checked={done}
        disabled={readOnly}
        onCheckedChange={onDoneChange}
        aria-label={`Item ${index + 1} done`}
      />
      <Field data-invalid={invalid} className="min-w-0 flex-1">
        <Input aria-label={`Item ${index + 1} text`} aria-invalid={invalid} readOnly={readOnly} {...textProps} />
        {error}
      </Field>
    </>
  )
}

// Multi reference: its own search for the dropdown, and a lookup by id for
// the picked chips' names (a picked category may not be in the search).
export function WidgetExtraCategoriesPicker({
  id,
  value,
  onChange,
  invalid,
  readOnly,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: WidgetFieldProps<number[]>) {
  const [search, setSearch] = useState('')
  const optionsQuery = useWidgetCategoriesQuery(search)
  const pickedQuery = useWidgetCategoriesByIdsQuery(value)
  const names = widgetCategoryNames(optionsQuery.data, pickedQuery.data)
  return (
    <MultiReference
      id={id}
      options={(optionsQuery.data ?? []).map((category) => ({ id: category.id, label: category.name }))}
      value={value}
      onValueChange={onChange}
      getLabel={(categoryId) => names.get(categoryId)}
      onSearchChange={setSearch}
      // Still showing the last search's results: Enter waits for these.
      searching={optionsQuery.isPlaceholderData}
      placeholder="Search categories"
      emptyText="No categories found."
      aria-label={ariaLabel}
      aria-invalid={invalid}
      aria-describedby={ariaDescribedBy}
      readOnly={readOnly}
    />
  )
}

// A single reference, picked from a searchable list: the form's Category
// combobox (widget-form.tsx explains each prop), with a lookup by id for the
// picked category's name, so a pick the current search doesn't return
// still shows its name. Each instance has its own search, so a list of
// items can hold one per row.
export function WidgetCategoryCombobox({
  id,
  value,
  onChange,
  invalid,
  readOnly,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: Omit<WidgetFieldProps<number | null>, 'onChange'> & { onChange: (categoryId: number) => void }) {
  const [search, setSearch] = useState('')
  const optionsQuery = useWidgetCategoriesQuery(search)
  const pickedQuery = useWidgetCategoriesByIdsQuery(value == null ? [] : [value])
  const names = widgetCategoryNames(optionsQuery.data, pickedQuery.data)
  return (
    <Combobox
      items={(optionsQuery.data ?? []).map((category) => category.id)}
      value={value ?? null}
      onValueChange={(picked) => picked != null && onChange(picked)}
      // The box showing the pick's own name is no search: opening the list
      // then offers every category, not only the one already picked.
      onInputValueChange={(text) => setSearch(value != null && text === names.get(value) ? '' : text)}
      itemToStringLabel={(categoryId: number) => names.get(categoryId) ?? ''}
      filter={null}
      readOnly={readOnly}
    >
      <ComboboxInput
        id={id}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        aria-describedby={ariaDescribedBy}
        placeholder="Search categories"
      />
      <ComboboxContent>
        <ComboboxEmpty>No categories found.</ComboboxEmpty>
        <ComboboxList>
          {(optionsQuery.data ?? []).map((category) => (
            <ComboboxItem key={category.id} value={category.id}>
              {category.name}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

// A pairing's own fields, one row of the list: a sub-record item with a
// reference field. Its category (WidgetCategoryCombobox) and its note,
// each named by position ("Pairing 2 category"). One element, so the row
// fills ListEditor's: side by side from `sm`, stacked on a phone. The form
// binds each field and its error; in place, the view shows the error
// under the row.
export function WidgetPairingItemFields({
  id,
  index,
  value,
  onCategoryChange,
  categoryInvalid,
  categoryError,
  noteProps,
  noteInvalid,
  noteError,
  readOnly,
  describedBy,
}: {
  /** The category picker's id; the note's is `${id}-note`. */
  id: string
  index: number
  value: { categoryId: number | null | undefined }
  onCategoryChange: (categoryId: number) => void
  categoryInvalid?: boolean
  categoryError?: ReactNode
  noteProps: ComponentProps<'input'>
  noteInvalid?: boolean
  noteError?: ReactNode
  readOnly?: boolean
  describedBy?: string
}) {
  return (
    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
      <Field data-invalid={categoryInvalid} className="min-w-0">
        <WidgetCategoryCombobox
          id={id}
          value={value.categoryId ?? null}
          onChange={onCategoryChange}
          invalid={categoryInvalid}
          readOnly={readOnly}
          aria-label={`Pairing ${index + 1} category`}
          aria-describedby={describedBy}
        />
        {categoryError}
      </Field>
      <Field data-invalid={noteInvalid} className="min-w-0">
        <Input
          id={`${id}-note`}
          placeholder="Note (optional)"
          aria-label={`Pairing ${index + 1} note`}
          aria-invalid={noteInvalid}
          aria-describedby={describedBy}
          readOnly={readOnly}
          {...noteProps}
        />
        {noteError}
      </Field>
    </div>
  )
}
