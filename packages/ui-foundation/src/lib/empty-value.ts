// What counts as an empty value on a record, and the dash it reads as
// (EmptyText, components/app/empty-value.tsx).
import type { ReactNode } from 'react'

/** The default empty text: an em dash, spoken as "Not set". */
export const EMPTY_DASH = '—'

/**
 * Whether a value counts as empty: `null`, `undefined`, `false`, `''` and
 * an empty array, so `{tags.map(...)}` or `{email}` can be passed as is.
 */
export function isEmptyValue(value: ReactNode) {
  return (
    value === null ||
    value === undefined ||
    value === false ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  )
}
