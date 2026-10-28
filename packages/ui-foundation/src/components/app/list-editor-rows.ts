// Which of ListEditor's items are open, when its items show as summary
// lines (`summary`, #222). One item is open at a time, held by its stable
// id (useFieldArray's `field.id`), so it stays open while rows move and
// closes when it's removed. An item that was just added or duplicated
// opens, and one with a validation error is open whatever else is.

/**
 * The open item once the list's ids have changed: the item that just
 * appeared, when an add or a duplicate asked for it (`opening`), else the
 * one that was open, if it's still there. A list replaced whole (a form's
 * `reset`) gives every item a new id, and nothing asked, so nothing opens.
 */
export function followOpenItem({
  before,
  after,
  open,
  opening,
}: {
  before: readonly string[]
  after: readonly string[]
  open: string | null
  opening: boolean
}): string | null {
  if (opening) {
    const added = after.find((id) => !before.includes(id))
    if (added !== undefined) return added
  }
  return open !== null && after.includes(open) ? open : null
}

/** Whether an item shows its fields: it's the open one, or it has an error to show. */
export function isItemOpen({ id, open, invalid }: { id: string; open: string | null; invalid: boolean }): boolean {
  return invalid || id === open
}
