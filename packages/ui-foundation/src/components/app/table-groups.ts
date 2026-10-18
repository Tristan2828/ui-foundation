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
