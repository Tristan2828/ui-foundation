// What a GFM table holds beyond its cells, read from the Markdown it
// already has, so nothing new is written into the text (the developer's
// choice A, 2026-11-04):
//
// - A column's alignment: GFM's own (`:---:`, `---:`).
// - A cell's colour: its whole text in one highlight, `=={green}$4.99==`
//   (src/lib/markdown-highlight.ts), paints the cell in that wash. Text
//   only partly highlighted is just highlighted words. An empty cell has
//   no colour (a highlight needs words).
// - A header column: when the first cells of the body rows are all bold
//   (those with words; at least one has), the first column is drawn as
//   row headers.
//
// The rule is the same for <Markdown> (rehypeTables, on the HTML tree)
// and the rich-text editor (its table decorations, rich-text-table.ts):
// both turn a cell into runs of text with their highlight and bold, and
// ask the functions here.
import { isHighlightColor, type HighlightColor } from './markdown-highlight'

/** A run of a cell's text, with the highlight and bold it's in. */
export type CellRun = { text: string; color: HighlightColor | null; bold: boolean }

/** The cell's colour: every run with words in it highlighted, all in one colour. */
export function cellColor(runs: readonly CellRun[]): HighlightColor | null {
  const worded = runs.filter((run) => run.text.trim() !== '')
  if (worded.length === 0) return null
  const color = worded[0].color
  return color && worded.every((run) => run.color === color) ? color : null
}

/** Whether a cell's words are all bold (and it has some). */
export function cellBold(runs: readonly CellRun[]): boolean {
  const worded = runs.filter((run) => run.text.trim() !== '')
  return worded.length > 0 && worded.every((run) => run.bold)
}

/** Whether a table's first column is row headers: its body rows' first cells with words, all bold. */
export function isHeaderColumn(firstCells: readonly (readonly CellRun[])[]): boolean {
  const worded = firstCells.filter((runs) => runs.some((run) => run.text.trim() !== ''))
  return worded.length > 0 && worded.every(cellBold)
}

// The little of the HTML tree (hast) read and changed here.
type HastNode = {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

// A cell's runs, from its HTML: a <mark data-color> is a highlight
// (remarkHighlights writes one), <strong> is bold.
function runsOf(node: HastNode, color: HighlightColor | null = null, bold = false): CellRun[] {
  if (node.type === 'text') return [{ text: node.value ?? '', color, bold }]
  let inner = color
  if (node.tagName === 'mark') {
    const value = node.properties?.dataColor
    inner = isHighlightColor(value) ? value : 'amber'
  }
  const strong = bold || node.tagName === 'strong'
  return (node.children ?? []).flatMap((child) => runsOf(child, inner, strong))
}

const elements = (node: HastNode | undefined, tagName: string) =>
  (node?.children ?? []).filter((child) => child.type === 'element' && child.tagName === tagName)

function eachTable(node: HastNode, visit: (table: HastNode) => void) {
  if (node.type === 'element' && node.tagName === 'table') visit(node)
  for (const child of node.children ?? []) eachTable(child, visit)
}

/**
 * For <Markdown>: marks each table's coloured cells (`data-color`), and
 * makes a header column's first cells row headers (`<th scope="row">`).
 */
export function rehypeTables() {
  return (tree: HastNode) => {
    eachTable(tree, (table) => {
      const rows = [...elements(table, 'thead'), ...elements(table, 'tbody')].flatMap((section) => elements(section, 'tr'))
      const body = elements(elements(table, 'tbody')[0], 'tr')
      for (const row of rows) {
        for (const cell of row.children ?? []) {
          if (cell.type !== 'element') continue
          const color = cellColor(runsOf(cell))
          if (color) cell.properties = { ...cell.properties, dataColor: color }
        }
      }
      const firsts = body.map((row) => (row.children ?? []).find((cell) => cell.type === 'element'))
      if (!isHeaderColumn(firsts.map((cell) => (cell ? runsOf(cell) : [])))) return
      table.properties = { ...table.properties, dataHeaderColumn: '' }
      for (const cell of firsts) {
        if (!cell) continue
        cell.tagName = 'th'
        cell.properties = { ...cell.properties, scope: 'row' }
      }
    })
  }
}

/** Sorts cell texts as a person would: numbers by value ($4.99 before $12), then words, empty last. */
export function compareCells(a: string, b: string): number {
  const x = numberIn(a)
  const y = numberIn(b)
  if (x !== null && y !== null && x !== y) return x - y
  const left = a.trim()
  const right = b.trim()
  if (!left && right) return 1
  if (left && !right) return -1
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
}

// The first number in a cell's text: "$1,299.50" is 1299.5, "-3 kg" is -3.
function numberIn(text: string): number | null {
  const found = text.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
  return found ? Number(found[0]) : null
}
