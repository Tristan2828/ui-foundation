// Form-side validation, mirroring the WidgetCreate/WidgetUpdate schemas in
// openapi.yaml (see AGENTS.md "NEVER hand-write an API type").
// This schema does not replace those generated types; it validates the
// form's own shapes (a Date for the picker, a nullable string for the email
// input) and the conversion functions below translate between this and the
// wire shape the gateway expects.
import { z } from 'zod'
import type { components } from '@/api/schema'

type Widget = components['schemas']['Widget']
type WidgetCreate = components['schemas']['WidgetCreate']
type WidgetUpdate = components['schemas']['WidgetUpdate']
type WidgetStatus = components['schemas']['WidgetStatus']
type WidgetTag = components['schemas']['WidgetTag']
type WidgetChecklistState = components['schemas']['WidgetChecklistState']

export const WIDGET_STATUSES = ['draft', 'active', 'archived'] as const satisfies readonly WidgetStatus[]
// What each status shows as, everywhere: the form's select (options and
// trigger), the toolbar filter, the column's badge and the view's. The wire
// value is an identifier, never display text. A Record, so tsc fails when
// openapi.yaml gains a value without a label.
export const WIDGET_STATUS_LABELS: Record<WidgetStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
}
// Multi-choice options, in display order. `satisfies` makes tsc fail if
// this ever lists a value openapi.yaml's WidgetTag enum doesn't have.
export const WIDGET_TAGS = ['fragile', 'bulky', 'seasonal', 'featured'] as const satisfies readonly WidgetTag[]
// What each tag shows as: the wire value is an identifier (`quick_win`
// style), not display text. MultiChoice's `getLabel` and the table's badges
// both read this, so a tag reads the same everywhere. A Record, so tsc
// fails when openapi.yaml gains a value without a label.
export const WIDGET_TAG_LABELS: Record<WidgetTag, string> = {
  fragile: 'Fragile',
  bulky: 'Bulky',
  seasonal: 'Seasonal',
  featured: 'Featured',
}
// Computed, read-only: shown and filtered in the table, never on the form
// and never in widgetFormSchema (the server works it out). Labels typed as
// a Record so tsc fails when openapi.yaml gains a value.
export const CHECKLIST_STATE_LABELS: Record<WidgetChecklistState, string> = {
  none: 'No checklist',
  open: 'In progress',
  complete: 'Complete',
}
export const CHECKLIST_STATES = ['none', 'open', 'complete'] as const satisfies readonly WidgetChecklistState[]

const PRICE_PATTERN = /^\d+\.\d{2}$/

// zod 4 dropped `required_error`; an error function that only answers for a
// missing value keeps the default message for every other issue.
const requiredError = (message: string) => (issue: { input: unknown }) =>
  issue.input === undefined ? message : undefined

// The description's limit, shared by the schema and the editor's count.
export const DESCRIPTION_MAX_LENGTH = 2000

export const widgetFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name must be 200 characters or fewer'),
  categoryId: z.number({ error: requiredError('Category is required') }),
  status: z.enum(WIDGET_STATUSES),
  availableFrom: z.date({ error: requiredError('Available-from date is required') }),
  // The input stays a plain string; '' means "no assignee" and is mapped to
  // null at submit time (formValuesToWidgetInput), not encoded in the schema
  // itself, so the empty string is always valid here.
  assigneeEmail: z.union([z.literal(''), z.string().trim().pipe(z.email('Enter a valid email address'))]),
  price: z
    .string()
    .trim()
    .regex(PRICE_PATTERN, 'Enter a price with exactly two decimal places, e.g. 19.99'),
  // Markdown: checked, never trimmed. A trim would rewrite what nobody
  // touched (a leading indent is a code block, and the text's own ending
  // goes), and the rich-text editor saves only what was typed.
  description: z
    .string()
    .max(DESCRIPTION_MAX_LENGTH, `Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer`)
    .refine((value) => value.trim() !== '', 'Description is required'),
  // Multi choice: any number of options, none required, no repeats (the
  // combobox can't produce a repeat, but the wire contract forbids one).
  tags: z
    .array(z.enum(WIDGET_TAGS))
    .refine((tags) => new Set(tags).size === tags.length, 'Each tag can only be chosen once'),
  // Yes/no: always true or false, never unset, so there is no "not set"
  // value to map (unlike an optional single choice).
  inStock: z.boolean(),
  // Multi reference: ids of other records, any number, no repeats. Whether
  // each id exists is the server's call (a 422 bound to this field).
  extraCategoryIds: z
    .array(z.number())
    .refine((ids) => new Set(ids).size === ids.length, 'Each category can only be chosen once'),
  // Sub-records: an ordered list, saved whole with the widget. Each item's
  // own rules mirror openapi.yaml's ChecklistItem.
  checklist: z
    .array(
      z.object({
        text: z
          .string()
          .trim()
          .min(1, 'Write something or remove the item')
          .max(300, 'An item must be 300 characters or fewer'),
        done: z.boolean(),
      }),
    )
    .max(50, 'A checklist can have at most 50 items'),
})

export type WidgetFormValues = z.infer<typeof widgetFormSchema>

export const WIDGET_FORM_DEFAULTS: WidgetFormValues = {
  name: '',
  categoryId: undefined as unknown as number,
  status: 'draft',
  availableFrom: undefined as unknown as Date,
  assigneeEmail: '',
  price: '',
  description: '',
  tags: [],
  // The same default the API applies when a create leaves inStock out.
  inStock: true,
  extraCategoryIds: [],
  checklist: [],
}

// Widget.availableFrom is a full datetime (openapi.yaml: format date-time).
// The form only collects a calendar day, so the picked day is serialized at
// UTC midnight rather than the browser's local midnight — deterministic
// across timezones, and avoids the picked day silently shifting by one
// depending on where the app runs.
export function dateToAvailableFrom(date: Date): string {
  const utcMidnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return new Date(utcMidnight).toISOString()
}

// Inverse of the above: parse the wire datetime back into the UTC calendar
// day the picker should show, not the local day the ISO instant falls on.
export function availableFromToDate(value: string): Date {
  const parsed = new Date(value)
  return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
}

export function widgetToFormValues(widget: Widget): WidgetFormValues {
  return {
    name: widget.name,
    categoryId: widget.categoryId,
    status: widget.status ?? 'draft',
    availableFrom: availableFromToDate(widget.availableFrom),
    assigneeEmail: widget.assigneeEmail ?? '',
    price: widget.price,
    description: widget.description,
    tags: widget.tags,
    inStock: widget.inStock,
    extraCategoryIds: widget.extraCategoryIds,
    checklist: widget.checklist,
  }
}

function formValuesToWidgetInput(values: WidgetFormValues): WidgetCreate {
  return {
    name: values.name,
    categoryId: values.categoryId,
    status: values.status,
    availableFrom: dateToAvailableFrom(values.availableFrom),
    assigneeEmail: values.assigneeEmail === '' ? null : values.assigneeEmail,
    price: values.price,
    description: values.description,
    tags: values.tags,
    inStock: values.inStock,
    extraCategoryIds: values.extraCategoryIds,
    checklist: values.checklist,
  }
}

export function formValuesToWidgetCreate(values: WidgetFormValues): WidgetCreate {
  return formValuesToWidgetInput(values)
}

export function formValuesToWidgetUpdate(values: WidgetFormValues): WidgetUpdate {
  return formValuesToWidgetInput(values)
}
