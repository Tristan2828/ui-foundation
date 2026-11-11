// Whether a typed name is already one of the records (a reference picker's
// Create "<typed>" is offered only when it isn't).

/** Whether `name` is one of the records' names, ignoring case and spaces at the ends. */
export function namesRecord(records: readonly { label: string }[], name: string): boolean {
  const wanted = name.trim().toLowerCase()
  return records.some((record) => record.label.trim().toLowerCase() === wanted)
}
