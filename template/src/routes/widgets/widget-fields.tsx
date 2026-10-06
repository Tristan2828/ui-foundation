// One control per widget field, shared by the form (widget-form.tsx,
// through react-hook-form's Controller) and editing in place on the view
// (widget-view.tsx, through editInPlace). The same labels, choices and
// pickers in both places, never a second set. Each takes a value and
// reports changes; the form or the view decides when it saves.
//
// `readOnly` is editing in place's "saving" state: the value stays on
// screen, unchangeable, until the server answers.
import { useState } from 'react'
import { MultiReference, RichTextEditor } from '@tristan2828/ui-foundation'
import { Input } from '@tristan2828/ui-foundation/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@tristan2828/ui-foundation/ui/select'
import type { components } from '@/api/schema'
import { useWidgetCategoriesByIdsQuery, useWidgetCategoriesQuery, widgetCategoryNames } from './use-widget-categories'
import { DESCRIPTION_MAX_LENGTH, WIDGET_STATUSES } from './widget-schema'

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
        <SelectValue placeholder="Select a status" />
      </SelectTrigger>
      <SelectContent>
        {WIDGET_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {status}
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
      placeholder="Search categories"
      emptyText="No categories found."
      aria-label={ariaLabel}
      aria-invalid={invalid}
      aria-describedby={ariaDescribedBy}
      readOnly={readOnly}
    />
  )
}
