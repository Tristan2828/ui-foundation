// Which fields of a form share a row (4.85, the form standard's F1),
// worked out from their order, never listed by hand. A field says how
// much it holds (`Field size`); consecutive short ones share a row, up to
// three, each as wide as its size: s 1, m 1.4, l 2.6 parts of the row.
// A long box (`l`) takes one short partner at most (a series and its
// number), never another long one, so the row ends with the pair and the
// next short fields start their own (Started, Finished, Rating). `full`
// (a field with no size), a `solo` field and anything that isn't a Field
// take a row of their own.
//
// Below 48rem every field takes its own row, except two dates or two
// numbers next to each other in a row, which stay side by side
// (`phonePair`).

export type FieldSize = 's' | 'm' | 'l' | 'full'

export type FieldKind = 'date' | 'number'

export type FieldRowItem = {
  size: FieldSize
  solo?: boolean
  kind?: FieldKind | null
}

export type FieldRowPlace = {
  /** Its share of the row's width (after the gaps), or null for a row of its own. */
  share: number | null
  /** How many gaps its row has (fields in it, less one). */
  gaps: number
  /** Stays beside its partner on a phone: two dates or two numbers. */
  phonePair: boolean
}

const PARTS: Record<Exclude<FieldSize, 'full'>, number> = { s: 1, m: 1.4, l: 2.6 }

/** The most fields one row holds. */
export const FIELDS_PER_ROW = 3

export function fieldRows(items: readonly FieldRowItem[]): FieldRowPlace[] {
  const places: FieldRowPlace[] = items.map(() => ({ share: null, gaps: 0, phonePair: false }))
  let row: number[] = []

  const close = () => {
    if (row.length > 1) {
      const parts = row.map((at) => PARTS[items[at].size as Exclude<FieldSize, 'full'>])
      const total = parts.reduce((sum, part) => sum + part, 0)
      row.forEach((at, index) => {
        places[at] = { share: parts[index] / total, gaps: row.length - 1, phonePair: false }
      })
      for (let index = 0; index + 1 < row.length; index++) {
        const a = items[row[index]].kind
        const b = items[row[index + 1]].kind
        if (a && a === b && !places[row[index]].phonePair) {
          places[row[index]].phonePair = true
          places[row[index + 1]].phonePair = true
          index++
        }
      }
    }
    row = []
  }

  items.forEach((item, at) => {
    const shares = item.size !== 'full' && !item.solo
    if (!shares) {
      close()
      return
    }
    const hasLong = row.some((index) => items[index].size === 'l')
    const full = row.length >= (hasLong || item.size === 'l' ? 2 : FIELDS_PER_ROW)
    if (full || (item.size === 'l' && hasLong)) close()
    row.push(at)
  })
  close()
  return places
}
