// How a widget's values look, shared by the table's cells
// (widgets-columns.tsx) and the view's rows (widget-view.tsx), so a value
// reads the same on both screens. Lookups and formatters only; the markup
// stays with each screen. Not in widgets-columns.tsx: that file exports a
// function, and these would make it a mixed module for fast refresh.
import type { StatusKind } from '@tristan2828/ui-foundation'
import type { components } from '@/api/schema'

type WidgetStatus = components['schemas']['WidgetStatus']
type WidgetChecklistState = components['schemas']['WidgetChecklistState']

// A status: its kind (the record standard's six, 4.98: icon, colour and
// word, StatusMark). Sort each value by what it *means*: a draft hasn't
// started (planned), an active one is in use, an archived one stopped
// without anything being wrong (ended, a muted grey, never red). The word
// stays the status's own (WIDGET_STATUS_LABELS). See
// docs/foundation/design-language.md "Status marks".
export const STATUS_KIND: Record<WidgetStatus, StatusKind> = {
  draft: 'planned',
  active: 'active',
  archived: 'ended',
}

// Computed field (the server works it out): an enum → tone-mapped badge
// like Status. Only `complete` earns a tone; an empty or unfinished list
// isn't a problem.
export const CHECKLIST_STATE_BADGE_VARIANT: Record<WidgetChecklistState, 'outline' | 'outline-success' | 'secondary'> = {
  none: 'secondary',
  open: 'outline',
  complete: 'outline-success',
}

export const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

export const priceFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
})

// Sub-records summarised as a count (`1/2 done`), in the table and above
// the items on the view.
export function checklistDoneCount(items: components['schemas']['Widget']['checklist']): string {
  return `${items.filter((item) => item.done).length}/${items.length} done`
}
