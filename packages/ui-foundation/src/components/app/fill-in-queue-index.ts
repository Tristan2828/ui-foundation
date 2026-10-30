// Which record FillInQueue shows, as its `items` change under it. The
// record is held by its key, not its place: saving one usually takes it out
// of `items` (it isn't missing anything now), and the list may arrive after
// the save resolves or before. Holding the key of the record to show next
// makes both orders land on the same one.

export type FillInKey = string | number

/**
 * The index to show: the held key's, while it's in the list; else the
 * place it was at (`lastIndex`), kept inside the list, which now holds the
 * record after it. -1 for an empty list.
 */
export function resolveFillInIndex(keys: readonly FillInKey[], key: FillInKey | null, lastIndex: number): number {
  if (keys.length === 0) return -1
  if (key !== null) {
    const found = keys.indexOf(key)
    if (found !== -1) return found
  }
  return Math.min(Math.max(lastIndex, 0), keys.length - 1)
}

/**
 * The key after `key`, wrapping to the first; `key` itself when it is the
 * only one. When `key` isn't in the list, the one now at `lastIndex`.
 * Null for an empty list.
 */
export function nextFillInKey(keys: readonly FillInKey[], key: FillInKey | null, lastIndex: number): FillInKey | null {
  if (keys.length === 0) return null
  const at = key === null ? -1 : keys.indexOf(key)
  if (at === -1) return keys[resolveFillInIndex(keys, null, lastIndex)]
  return keys[(at + 1) % keys.length]
}
