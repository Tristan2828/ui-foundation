// A table's column widths, kept in the Markdown as one comment after the
// table, naming its columns (the developer's choice, 2026-11-09):
//
//   | Item | Room | Cost |
//   | ---- | ---- | ---: |
//   | Paint | Hall | $42 |
//
//   <!-- table widths: Item=140, Cost=72 -->
//
// GFM has nowhere to put a width, and the table has to stay a table to
// everything else that reads it. A comment hides itself on GitHub and in
// other renderers, and a chat or the connector can read or change it.
// By name, so a column moved outside the editor keeps its width: a
// column named nowhere is automatic (fit to its words), a name no column
// has is ignored. A blank or repeated header can't be named, and is its
// place instead (`#3=72`). A header that isn't plain words is quoted, as
// JSON (`"Cost, each"=72`).
//
// It's the one piece of HTML the rich-text editor writes, and neither
// renderer shows it: `remarkTableWidths` takes it off the tree and puts
// each width on its column's cells. A comment that isn't this one, or
// isn't straight after a table, is any other raw HTML: shown as its
// characters, never lost.
//
// Widths are pixels. In the editor they sit on the cells (ProseMirror's
// `colwidth`), so a column moved, added or deleted there, and a row added
// or sorted there, keeps them right; the comment is written from the
// cells on each save. Styled in styles/index.css ("Tables in written
// text"): a phone keeps fitting columns to their words.

export const MIN_COLUMN_WIDTH = 56
export const MAX_COLUMN_WIDTH = 1200

/** The sizes a dragged edge catches on, within `COLUMN_CATCH` pixels. */
export const COLUMN_SIZES = [
  { label: 'S', width: 96 },
  { label: 'M', width: 160 },
  { label: 'L', width: 256 },
  { label: 'XL', width: 384 },
] as const

export const COLUMN_CATCH = 10

/** A width within the limits, whole pixels. */
export function clampColumnWidth(width: number): number {
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(width)))
}

/** A dragged width: within the limits, and on a size when it's that close to one. */
export function catchColumnWidth(width: number): { width: number; size: string | null } {
  const clamped = clampColumnWidth(width)
  const size = COLUMN_SIZES.find((one) => Math.abs(one.width - clamped) <= COLUMN_CATCH)
  return size ? { width: size.width, size: size.label } : { width: clamped, size: null }
}

type Entry = { name: string; width: number } | { position: number; width: number }

const COMMENT = /^<!--\s*table widths:\s*(.*?)\s*-->\s*$/s
// One `key=width`: a quoted name, a place (`#3`), or bare words.
const ENTRY = /\s*(?:("(?:[^"\\]|\\.)*")|#(\d+)|([^,="]+?))\s*=\s*(\d+)\s*(,|$)/y

/** The entries of a widths comment, or null when it isn't one. */
export function parseTableWidths(comment: string): Entry[] | null {
  const body = COMMENT.exec(comment.trim())?.[1]
  if (!body) return null
  const entries: Entry[] = []
  ENTRY.lastIndex = 0
  for (;;) {
    const at = ENTRY.lastIndex
    const found = ENTRY.exec(body)
    if (!found) return null
    const [, quoted, position, bare, width, separator] = found
    let name = bare
    if (quoted !== undefined) {
      try {
        name = JSON.parse(quoted) as string
      } catch {
        return null
      }
    }
    if (position !== undefined) entries.push({ position: Number(position), width: Number(width) })
    else entries.push({ name: cleanHeader(name), width: Number(width) })
    if (!separator) break
    // A `,` with nothing after it isn't one of ours.
    if (ENTRY.lastIndex === at || ENTRY.lastIndex >= body.length) return null
  }
  return entries
}

const cleanHeader = (text: string) => text.replace(/\s+/g, ' ').trim()

/** Each column's width, in order: null is automatic. */
export function resolveTableWidths(entries: readonly Entry[], headers: readonly string[]): (number | null)[] {
  const names = headers.map(cleanHeader)
  const widths: (number | null)[] = headers.map(() => null)
  const used = new Set<number>()
  for (const entry of entries) {
    const index =
      'position' in entry
        ? entry.position - 1
        : names.findIndex((name, column) => name === entry.name && name !== '' && !used.has(column))
    if (index < 0 || index >= headers.length) continue
    used.add(index)
    widths[index] = clampColumnWidth(entry.width)
  }
  return widths
}

// A name that can sit bare in the comment. `--` could end the comment, and
// `#3` would read as a place.
const isBare = (name: string) => /^[^,="\\<>\r\n]+$/.test(name) && !name.includes('--') && !/^#\d+$/.test(name)

// Quoted as JSON, with what could end the comment as an escape.
const quoted = (name: string) => JSON.stringify(name).replace(/-/g, '\\u002d').replace(/>/g, '\\u003e')

/** The comment for these columns' widths, or null when they're all automatic. */
export function formatTableWidths(headers: readonly string[], widths: readonly (number | null | undefined)[]): string | null {
  const names = headers.map(cleanHeader)
  const entries: string[] = []
  names.forEach((name, column) => {
    const width = widths[column]
    if (width === null || width === undefined) return
    const nameable = name !== '' && names.indexOf(name) === names.lastIndexOf(name)
    entries.push(`${nameable ? (isBare(name) ? name : quoted(name)) : `#${column + 1}`}=${width}`)
  })
  return entries.length ? `<!-- table widths: ${entries.join(', ')} -->` : null
}

// The little of the Markdown tree (mdast) read and changed here.
type MdNode = {
  type: string
  value?: string
  children?: MdNode[]
  data?: Record<string, unknown>
  [key: string]: unknown
}

// `==words==` and `=={green}words==`: text to a tree the highlights
// haven't been read from (the merge's), so a header's name is the same
// in every tree.
const HIGHLIGHT = /==(?:\{(?:amber|yellow|green|red)\})?(\S(?:.*?\S)?)==/g

function textOf(node: MdNode): string {
  if (typeof node.value === 'string') return node.value
  return (node.children ?? []).map(textOf).join('')
}

/** A table node's header texts, as a reader sees them. */
export function tableHeaders(table: MdNode): string[] {
  return (table.children?.[0]?.children ?? []).map((cell) => cleanHeader(textOf(cell).replace(HIGHLIGHT, '$1')))
}

/** The widths the block after a table gives it, or null when it gives none. */
export function widthsAfterTable(table: MdNode, next: MdNode | undefined): (number | null)[] | null {
  // The rich-text editor's commonmark preset wraps a block of HTML in a
  // paragraph before this reads it.
  const block = next?.type === 'paragraph' && next.children?.length === 1 ? next.children[0] : next
  if (block?.type !== 'html' || typeof block.value !== 'string') return null
  const entries = parseTableWidths(block.value)
  return entries && resolveTableWidths(entries, tableHeaders(table))
}

function putOnCells(table: MdNode, widths: readonly (number | null)[]) {
  for (const row of table.children ?? []) {
    ;(row.children ?? []).forEach((cell, column) => {
      const width = widths[column]
      if (width === null || width === undefined) return
      // The editor's parser reads `columnWidth`; the read view's HTML
      // takes `hProperties`.
      cell.columnWidth = width
      cell.data = { ...cell.data, hProperties: { dataColumnWidth: String(width), style: `--column-width: ${width}px` } }
    })
  }
}

function walk(parent: MdNode) {
  const children = parent.children
  if (!children) return
  for (let index = 0; index < children.length; index++) {
    const node = children[index]
    if (node.type !== 'table') {
      walk(node)
      continue
    }
    const widths = widthsAfterTable(node, children[index + 1])
    if (!widths) continue
    putOnCells(node, widths)
    children.splice(index + 1, 1)
  }
}

/** Takes each widths comment off the tree and puts its widths on its table's cells. */
export function remarkTableWidths() {
  return (tree: unknown) => walk(tree as MdNode)
}
