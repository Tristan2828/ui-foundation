// The Columns menu's pick (DataTable `columnsMenu`), kept free of React so
// tests/ can unit-test it. It's stored on this device per list as JSON:
// every column's id in order, and the ones unticked:
//
//   {"order":["name","status","dose","since"],"hidden":["since"]}
//
// `order` is there for reordering, a later addition to the same value; for
// now it's written and kept, never applied. A column the list gained after
// the pick was stored isn't in `hidden`, so it shows.

// The id of the column DataTable adds for `rowActions`, pinned last: never
// in the Columns menu.
export const ROW_ACTIONS_COLUMN_ID = '__row-actions'

export type ColumnsPick = { order: string[]; hidden: string[] }

/** The stored pick, or null when there's none or it can't be read. */
export function parseColumnsPick(raw: string | null): ColumnsPick | null {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { order, hidden } = value as Record<string, unknown>
    const strings = (list: unknown) => (Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string') : null)
    const orderIds = strings(order)
    const hiddenIds = strings(hidden)
    return orderIds && hiddenIds ? { order: orderIds, hidden: hiddenIds } : null
  } catch {
    return null
  }
}

/** The ids to show under `pick`: every column of `ids` it doesn't hide, in `ids`' order, `fixed` always. */
export function visibleFromPick(ids: readonly string[], pick: ColumnsPick, fixed: readonly string[]): string[] {
  const hidden = new Set(pick.hidden)
  return ids.filter((id) => fixed.includes(id) || !hidden.has(id))
}

/**
 * The pick after `id` is ticked (`shown`) or unticked, starting from what
 * shows now (`visible`): every column in `ids` is in `order`, the ones not
 * showing in `hidden`.
 */
export function togglePick(
  ids: readonly string[],
  visible: readonly string[],
  id: string,
  shown: boolean,
  previous: ColumnsPick | null,
): ColumnsPick {
  const next = new Set(visible)
  if (shown) next.add(id)
  else next.delete(id)
  // Keep an order already stored (reordering, later), with new columns after.
  const order = previous ? [...previous.order.filter((each) => ids.includes(each)), ...ids.filter((each) => !previous.order.includes(each))] : [...ids]
  return { order, hidden: ids.filter((each) => !next.has(each)) }
}
