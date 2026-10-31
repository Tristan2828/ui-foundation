// DataTable's grouped rows (`groupBy`), kept free of React so tests/ can
// unit-test it. Rows stay in the order the server sent them; a new group
// starts wherever the key changes, so a key that comes back later (the
// server sorted by something else) gets a second heading rather than rows
// moved out of order. Groups come from the rows alone, so a group with no
// rows on this page never exists.

/** The group a row belongs to: `key` tells groups apart, `label` is the heading. */
export type RowGroup = { key: string; label: string }

export type GroupRun<T> = RowGroup & { rows: T[] }

export function groupRuns<T>(rows: readonly T[], groupOf: (row: T) => RowGroup): GroupRun<T>[] {
  const runs: GroupRun<T>[] = []
  for (const row of rows) {
    const { key, label } = groupOf(row)
    const last = runs.at(-1)
    if (last && last.key === key) last.rows.push(row)
    else runs.push({ key, label, rows: [row] })
  }
  return runs
}

/**
 * Rows grouped by a choice field's value (DataTable's `groupings`): one
 * group per option, in the options' order, then any value the options
 * don't name (in the order first met), then the rows with none under
 * `emptyLabel`. A multi-value field (an array) puts the row under each of
 * its values. Rows keep the server's order inside a group, and a group
 * with no rows on this page never exists.
 */
export function groupByValues<T>(
  rows: readonly T[],
  valueOf: (row: T) => string | readonly string[] | null | undefined,
  options: readonly { value: string; label: string }[],
  emptyLabel: string,
): GroupRun<T>[] {
  const byKey = new Map<string, T[]>()
  const unknown: string[] = []
  const known = new Set(options.map((option) => option.value))
  // The empty group's key can't collide with a value: values are non-empty.
  const EMPTY = ''
  for (const row of rows) {
    const raw = valueOf(row)
    const values = [...new Set((typeof raw === 'string' ? [raw] : (raw ?? [])).filter((value) => value !== ''))]
    for (const value of values.length > 0 ? values : [EMPTY]) {
      if (value !== EMPTY && !known.has(value) && !byKey.has(value)) unknown.push(value)
      const group = byKey.get(value)
      if (group) group.push(row)
      else byKey.set(value, [row])
    }
  }
  const run = (key: string, label: string): GroupRun<T>[] => {
    const groupRows = byKey.get(key)
    return groupRows ? [{ key, label, rows: groupRows }] : []
  }
  return [
    ...options.flatMap((option) => run(option.value, option.label)),
    ...unknown.flatMap((value) => run(value, value)),
    ...run(EMPTY, emptyLabel),
  ]
}
