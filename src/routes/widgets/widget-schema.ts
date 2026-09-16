// Form-side validation, mirroring the WidgetCreate/WidgetUpdate schemas in
// openapi.yaml (frozen — see AGENTS.md "NEVER hand-write an API type").
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

export const WIDGET_STATUSES = ['draft', 'active', 'archived'] as const satisfies readonly WidgetStatus[]

const PRICE_PATTERN = /^\d+\.\d{2}$/

export const widgetFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name must be 200 characters or fewer'),
  categoryId: z.number({ required_error: 'Category is required' }),
  status: z.enum(WIDGET_STATUSES),
  availableFrom: z.date({ required_error: 'Available-from date is required' }),
  // The input stays a plain string; '' means "no assignee" and is mapped to
  // null at submit time (formValuesToWidgetInput), not encoded in the schema
  // itself, so the empty string is always valid here.
  assigneeEmail: z.union([z.literal(''), z.string().trim().email('Enter a valid email address')]),
  price: z
    .string()
    .trim()
    .regex(PRICE_PATTERN, 'Enter a price with exactly two decimal places, e.g. 19.99'),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(2000, 'Description must be 2000 characters or fewer'),
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
  }
}

export function formValuesToWidgetCreate(values: WidgetFormValues): WidgetCreate {
  return formValuesToWidgetInput(values)
}

export function formValuesToWidgetUpdate(values: WidgetFormValues): WidgetUpdate {
  return formValuesToWidgetInput(values)
}
