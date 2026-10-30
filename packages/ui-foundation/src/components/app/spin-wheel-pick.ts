// SpinWheel's chance: which item a value in [0, 1) lands on, each item's
// share being its weight over the sum of weights.

export interface SpinWheelItem {
  id: string | number
  label: string
  /** > 0, default 1: the slice's size and its chance (weight over the sum). */
  weight?: number
  /** A tinted slice: a flagged record, a favourite. */
  emphasis?: boolean
}

/** An item's weight: its own when > 0 and finite, else 1. */
export const spinWheelWeight = (item: SpinWheelItem): number =>
  item.weight !== undefined && Number.isFinite(item.weight) && item.weight > 0 ? item.weight : 1

/**
 * The index of the item a value in [0, 1) lands on: each item's share of
 * [0, 1) is its weight over the sum, in order. -1 for no items.
 */
export function pickSpinWheelIndex(items: readonly SpinWheelItem[], value: number): number {
  if (items.length === 0) return -1
  const total = items.reduce((sum, item) => sum + spinWheelWeight(item), 0)
  const target = Math.min(Math.max(value, 0), 1) * total
  let reached = 0
  for (let index = 0; index < items.length; index++) {
    reached += spinWheelWeight(items[index])
    if (target < reached) return index
  }
  return items.length - 1
}

