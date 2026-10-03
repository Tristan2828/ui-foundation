// How a widget's values look, shared by the table's cells
// (widgets-columns.tsx) and the view's rows (widget-view.tsx), so a value
// reads the same on both screens. Lookups and formatters only; the markup
// stays with each screen. Not in widgets-columns.tsx: that file exports a
// function, and these would make it a mixed module for fast refresh.
import type { components } from '@/api/schema'

type WidgetStatus = components['schemas']['WidgetStatus']
type WidgetChecklistState = components['schemas']['WidgetChecklistState']

// Enum → tone-mapped badge: group the values by what they *mean* (good /
// neutral / bad) first, then pick one style for the whole column. The
// grouping is the real decision; the style is mostly consistency with the
// table's other columns. See docs/foundation/design-language.md.
//
// Only `active` earns a tone. `archived` is an end state, not a failure,
// so it stays neutral — a red badge would tell the reader something is
// wrong when nothing is.
export const STATUS_BADGE_VARIANT: Record<WidgetStatus, 'outline' | 'outline-success' | 'secondary'> = {
  draft: 'outline',
  active: 'outline-success',
  archived: 'secondary',
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
