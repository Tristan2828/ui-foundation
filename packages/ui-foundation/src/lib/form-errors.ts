/**
 * How many problems react-hook-form's `formState.errors` hold: one per
 * field, one per list's own (`root`), however deep (4.85, EntityForm's
 * "N to fix").
 */
export function countFormErrors(errors: unknown): number {
  if (!errors || typeof errors !== 'object') return 0
  const entry = errors as Record<string, unknown>
  if (typeof entry.type === 'string' || typeof entry.message === 'string') return 1
  let count = 0
  for (const [key, value] of Object.entries(entry)) {
    if (key === 'ref') continue
    count += countFormErrors(value)
  }
  return count
}
