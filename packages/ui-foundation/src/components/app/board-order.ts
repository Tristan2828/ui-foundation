// Board's order, as pure functions (board.tsx uses them; tests/board.test.tsx
// checks them without a browser). A zone is a column, or a group of one: its
// cards are every item in it, in `items`' order, of which the board shows a
// first page.
export type BoardId = string | number

/** Where a card now sits in its zone: the card it is before, and the one after it (null at the end, the start). */
export type BoardNeighbours = { beforeId: BoardId | null; afterId: BoardId | null }

const same = (a: BoardId | null, b: BoardId | null) => (a === null || b === null ? a === b : String(a) === String(b))

/**
 * A drop at `index` (0 to the cards shown) in a zone whose cards are `ids`
 * (all of them, not only those shown: after the last shown card the card
 * lands before the first hidden one). `dragged` is the card dropped. Null
 * when the drop leaves the card between the neighbours it has now.
 */
export function dropPlace(ids: readonly BoardId[], index: number, dragged: BoardId): BoardNeighbours | null {
  const at = Math.max(0, Math.min(index, ids.length))
  const afterId = at > 0 ? ids[at - 1] : null
  const beforeId = at < ids.length ? ids[at] : null
  if (same(afterId, dragged) || same(beforeId, dragged)) return null
  return { beforeId, afterId }
}

/** The end of a zone, for a card that isn't in it yet (or is, and leaves its place for the end). */
export function endPlace(ids: readonly BoardId[], card: BoardId): BoardNeighbours {
  const rest = ids.filter((id) => !same(id, card))
  return { beforeId: null, afterId: rest.length > 0 ? rest[rest.length - 1] : null }
}

/** The card's neighbours in its zone now. */
export function neighboursOf(ids: readonly BoardId[], card: BoardId): BoardNeighbours | null {
  const at = ids.findIndex((id) => same(id, card))
  if (at < 0) return null
  return { beforeId: at + 1 < ids.length ? ids[at + 1] : null, afterId: at > 0 ? ids[at - 1] : null }
}

export type BoardOrderKind = 'up' | 'down' | 'top'

/**
 * Where the menu's Order items put a card within its zone: up (before the
 * card above it), down (after the card below it), to the top (before the
 * zone's first card). Undefined where one can't apply: the first card can't
 * go up or to the top, the last can't go down.
 */
export function orderTargets(ids: readonly BoardId[], card: BoardId): Record<BoardOrderKind, BoardNeighbours | undefined> {
  const at = ids.findIndex((id) => same(id, card))
  if (at < 0) return { up: undefined, down: undefined, top: undefined }
  return {
    up: at > 0 ? { beforeId: ids[at - 1], afterId: at > 1 ? ids[at - 2] : null } : undefined,
    down: at < ids.length - 1 ? { beforeId: at + 2 < ids.length ? ids[at + 2] : null, afterId: ids[at + 1] } : undefined,
    top: at > 0 ? { beforeId: ids[0], afterId: null } : undefined,
  }
}

/** The card's place (1 to n) in its zone once it sits between `place`'s neighbours. */
export function placeNumber(ids: readonly BoardId[], card: BoardId, place: BoardNeighbours): { k: number; n: number } {
  const rest = ids.filter((id) => !same(id, card))
  const before = place.beforeId === null ? -1 : rest.findIndex((id) => same(id, place.beforeId))
  const k = (before < 0 ? rest.length : before) + 1
  return { k, n: rest.length + 1 }
}

/** The cards a zone shows: its first `pageSize` times the pages opened, or all of them. */
export function shownCount(total: number, pageSize: number | undefined, pages: number): number {
  return pageSize === undefined ? total : Math.min(total, pageSize * pages)
}

/** "Show N More": the smaller of a page and what's left. 0 when nothing is left. */
export function moreCount(total: number, pageSize: number | undefined, pages: number): number {
  if (pageSize === undefined) return 0
  return Math.min(pageSize, total - shownCount(total, pageSize, pages))
}
