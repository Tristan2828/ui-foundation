// What the rich-text editor can do to a table: rows and columns added,
// deleted and moved, a column's alignment, the rows sorted by a column,
// cells coloured, a header column, the whole table deleted, and its keys.
// Plain ProseMirror commands over prosemirror-tables and Milkdown's gfm
// schema, so each is one undo step.
//
// Sorting rewrites the rows' order: what the editor shows is what it
// saves, so a sort is an edit like any other (Ctrl+Z puts them back).
// Colours and the header column are stored as Markdown already writes
// them (src/lib/markdown-table.ts): a coloured cell is its whole text in
// one highlight, a header column is its first cells in bold. The table's
// decorations (tableLook) draw them.
//
// What GFM can't store, the editor doesn't offer: a table always keeps its
// header row and at least one row under it, and at least one column, so
// those deletes are off where they'd break that (the header row can't be
// deleted or have a row put above it). Alignment is per column, as the
// Markdown writes it (`:---:`).
//
// A column's width is on its cells (`colwidth`), kept in the Markdown as a
// comment after the table (src/lib/markdown-table-widths.ts). Moves and
// sorts carry it with the cells, and prosemirror-tables' fixTables gives a
// new row's cells their column's width. One drag is one undo step: while
// it runs the width is a decoration only (previewColumnWidth).
//
// Keys (handleTableKey), on top of Milkdown's Tab/Shift+Tab between cells:
// Tab in the last cell adds a row; Enter goes to the cell below, and out
// of the table from its last row; Shift+Enter does nothing (a line break
// can't be stored inside a cell).
import { closeHistory } from '@milkdown/kit/prose/history'
import { Fragment, type Node as ProseNode } from '@milkdown/kit/prose/model'
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { isHighlightColor, type HighlightColor } from '@/lib/markdown-highlight'
import { cellColor, compareCells, isHeaderColumn, type CellRun } from '@/lib/markdown-table'
import {
  addColumnAfter,
  addColumnBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
  isInTable,
  selectedRect,
  TableMap,
} from '@milkdown/kit/prose/tables'

type Dispatch = (tr: Transaction) => void

export type TableAction =
  | 'rowAbove'
  | 'rowBelow'
  | 'columnLeft'
  | 'columnRight'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'deleteRow'
  | 'deleteColumn'
  | 'deleteTable'
  | 'moveRowUp'
  | 'moveRowDown'
  | 'moveColumnLeft'
  | 'moveColumnRight'
  | 'sortAscending'
  | 'sortDescending'
  | 'headerColumn'

export type ColumnAlignment = 'left' | 'center' | 'right'

/** A column being dragged to a width: the table's position, the column and the width so far. */
export type ColumnDrag = { tablePos: number; column: number; width: number }

const ALIGN: Partial<Record<TableAction, ColumnAlignment>> = {
  alignLeft: 'left',
  alignCenter: 'center',
  alignRight: 'right',
}

/** The caret's column's alignment, as the header cell has it (GFM's default is left). */
export function columnAlignment(state: EditorState): ColumnAlignment {
  if (!isInTable(state)) return 'left'
  const { map, table, left } = selectedRect(state)
  const value = table.nodeAt(map.map[left])?.attrs.alignment as ColumnAlignment | null | undefined
  return value ?? 'left'
}

/** Whether an action can apply where the caret is. */
export function tableActionEnabled(state: EditorState, action: TableAction): boolean {
  if (!isInTable(state)) return false
  const { map, top, bottom, left, right } = selectedRect(state)
  switch (action) {
    case 'rowAbove':
      return top > 0
    case 'deleteRow':
      // Not the header row, and never every row under it.
      return top > 0 && bottom - top < map.height - 1
    case 'deleteColumn':
      return right - left < map.width
    case 'moveRowUp':
      return top > 1
    case 'moveRowDown':
      return top > 0 && bottom < map.height
    case 'moveColumnLeft':
      return left > 0
    case 'moveColumnRight':
      return right < map.width
    case 'sortAscending':
    case 'sortDescending':
      return map.height > 2
    case 'headerColumn':
      return map.height > 1
    default:
      return true
  }
}

/** Runs an action where the caret is. False when it can't apply there. */
export function runTableAction(state: EditorState, dispatch: Dispatch, action: TableAction): boolean {
  if (!tableActionEnabled(state, action)) return false
  const alignment = ALIGN[action]
  if (alignment) return alignColumn(state, dispatch, alignment)
  switch (action) {
    case 'rowAbove':
      return addRow(state, dispatch, 'above')
    case 'rowBelow':
      return addRow(state, dispatch, 'below')
    case 'columnLeft':
      return addColumn(state, dispatch, 'left')
    case 'columnRight':
      return addColumn(state, dispatch, 'right')
    case 'deleteRow':
      return deleteRow(state, dispatch)
    case 'deleteColumn':
      return deleteColumn(state, dispatch)
    case 'deleteTable':
      return deleteTable(state, dispatch)
    case 'moveRowUp':
    case 'moveRowDown':
      return moveRow(state, dispatch, action === 'moveRowUp' ? -1 : 1)
    case 'moveColumnLeft':
    case 'moveColumnRight':
      return moveColumn(state, dispatch, action === 'moveColumnLeft' ? -1 : 1)
    case 'sortAscending':
    case 'sortDescending':
      return sortRows(state, dispatch, action === 'sortAscending' ? 1 : -1)
    case 'headerColumn':
      return toggleHeaderColumn(state, dispatch)
    default:
      return false
  }
}

// The table rebuilt from its rows, in place of the old one, and the caret
// into the cell at `row`, `column` of the new one. Its own undo step,
// never merged with the edit before it (two sorts in a row undo one at a time).
function replaceRows(state: EditorState, dispatch: Dispatch, rows: ProseNode[], row: number, column: number): boolean {
  const { table, tableStart } = selectedRect(state)
  const next = table.copy(Fragment.from(rows))
  const tr = state.tr.replaceWith(tableStart - 1, tableStart - 1 + table.nodeSize, next)
  const map = TableMap.get(next)
  tr.setSelection(TextSelection.near(tr.doc.resolve(tableStart + map.map[row * map.width + column] + 1)))
  dispatch(closeHistory(tr.scrollIntoView()))
  return true
}

const rowsOf = (table: ProseNode) => {
  const rows: ProseNode[] = []
  table.forEach((row) => rows.push(row))
  return rows
}

// The caret's row swapped with the one above or below (never the header
// row: GFM's first row is always the header).
function moveRow(state: EditorState, dispatch: Dispatch, by: -1 | 1): boolean {
  const { table, top, left } = selectedRect(state)
  const rows = rowsOf(table)
  const to = top + by
  ;[rows[top], rows[to]] = [rows[to], rows[top]]
  return replaceRows(state, dispatch, rows, to, left)
}

// The caret's column swapped with the one left or right of it, in every
// row; each cell keeps its alignment, so the column's moves with it.
function moveColumn(state: EditorState, dispatch: Dispatch, by: -1 | 1): boolean {
  const { table, top, left } = selectedRect(state)
  const to = left + by
  const rows = rowsOf(table).map((row) => {
    const cells: ProseNode[] = []
    row.forEach((cell) => cells.push(cell))
    ;[cells[left], cells[to]] = [cells[to], cells[left]]
    return row.copy(Fragment.from(cells))
  })
  return replaceRows(state, dispatch, rows, top, to)
}

// The body rows in the order of the caret's column (numbers by value,
// then words, empty cells last), the header row kept first. Rows that
// tie keep their order. The caret goes to the column's header.
function sortRows(state: EditorState, dispatch: Dispatch, direction: 1 | -1): boolean {
  const { table, left } = selectedRect(state)
  const [header, ...body] = rowsOf(table)
  const text = (row: ProseNode) => row.child(left).textContent
  const sorted = body
    .map((row, index) => ({ row, index }))
    .sort((a, b) => compareCells(text(a.row), text(b.row)) * direction || a.index - b.index)
    .map(({ row }) => row)
  return replaceRows(state, dispatch, [header, ...sorted], 0, left)
}

// A cell's text as runs, with their highlight and bold (markdown-table.ts).
function runsOf(cell: ProseNode): CellRun[] {
  const runs: CellRun[] = []
  cell.descendants((node) => {
    if (!node.isText) return true
    const highlight = node.marks.find((mark) => mark.type.name === 'highlight')
    const color = highlight ? (isHighlightColor(highlight.attrs.color) ? highlight.attrs.color : 'amber') : null
    runs.push({ text: node.text ?? '', color, bold: node.marks.some((mark) => mark.type.name === 'strong') })
    return false
  })
  return runs
}

// Each body row's first cell, and where it starts in the document.
function firstCells(table: ProseNode, tableStart: number): { cell: ProseNode; pos: number }[] {
  const cells: { cell: ProseNode; pos: number }[] = []
  table.forEach((row, offset, index) => {
    if (index > 0 && row.firstChild) cells.push({ cell: row.firstChild, pos: tableStart + offset + 1 })
  })
  return cells
}

/** Whether the caret's table has a header column (its first cells bold). */
export function headerColumnOn(state: EditorState): boolean {
  if (!isInTable(state)) return false
  const { table, tableStart } = selectedRect(state)
  return isHeaderColumn(firstCells(table, tableStart).map(({ cell }) => runsOf(cell)))
}

// The header column on (each body row's first cell bolded) or off (unbolded).
function toggleHeaderColumn(state: EditorState, dispatch: Dispatch): boolean {
  const { table, tableStart } = selectedRect(state)
  const strong = state.schema.marks.strong
  const on = headerColumnOn(state)
  const tr = state.tr
  for (const { cell, pos } of firstCells(table, tableStart)) {
    const from = pos + 1
    const to = pos + cell.nodeSize - 1
    if (on) tr.removeMark(from, to, strong)
    else if (cell.textContent.trim()) tr.addMark(from, to, strong.create())
  }
  if (tr.docChanged) dispatch(closeHistory(tr))
  return true
}

/** What a colour is put on: the caret's cell, its whole row, or its column's body cells. */
export type TableColorScope = 'cell' | 'row' | 'column'

/** Whether a colour can go on that scope where the caret is (never the header row's cells). */
export function tableColorEnabled(state: EditorState, scope: TableColorScope): boolean {
  if (!isInTable(state)) return false
  const { map, top } = selectedRect(state)
  return scope === 'column' ? map.height > 1 : top > 0
}

/** The cell colour where the caret is, or null (none, or the header row). */
export function cellColorAt(state: EditorState): HighlightColor | null {
  if (!isInTable(state)) return null
  const { table, map, left, top } = selectedRect(state)
  const cell = table.nodeAt(map.map[top * map.width + left])
  return cell ? cellColor(runsOf(cell)) : null
}

/**
 * Colours cells: each one's whole text put in that highlight (`null`
 * takes the highlight off). An empty cell stays as it is: a highlight
 * needs words.
 */
export function colorTableCells(state: EditorState, dispatch: Dispatch, scope: TableColorScope, color: HighlightColor | null): boolean {
  if (!tableColorEnabled(state, scope)) return false
  const { map, table, tableStart, top, bottom, left, right } = selectedRect(state)
  const highlight = state.schema.marks.highlight
  const rows = scope === 'column' ? [1, map.height] : [top, bottom]
  const columns = scope === 'row' ? [0, map.width] : [left, right]
  const tr = state.tr
  for (let row = rows[0]; row < rows[1]; row++) {
    for (let column = columns[0]; column < columns[1]; column++) {
      const offset = map.map[row * map.width + column]
      const cell = table.nodeAt(offset)!
      const from = tableStart + offset + 1
      const to = tableStart + offset + cell.nodeSize - 1
      tr.removeMark(from, to, highlight)
      if (color && cell.textContent.trim()) tr.addMark(from, to, highlight.create({ color }))
    }
  }
  if (tr.docChanged) dispatch(closeHistory(tr))
  return true
}

// The decorations that draw what the Markdown keeps: a coloured cell's
// wash (`data-color`), a header column's first cells (`data-row-header`)
// and a column's width (`data-column-width`, or the width it's being
// dragged to), styled in styles/index.css ("Tables in written text").
function tableDecorations(doc: ProseNode, drag: ColumnDrag | null): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'table') return node.isBlock && !node.isTextblock
    const tableStart = pos + 1
    node.forEach((row, rowOffset) => {
      row.forEach((cell, cellOffset, column) => {
        const color = cellColor(runsOf(cell))
        const at = tableStart + rowOffset + 1 + cellOffset
        if (color) decorations.push(Decoration.node(at, at + cell.nodeSize, { 'data-color': color }))
        const width = drag && drag.tablePos === pos && drag.column === column ? drag.width : widthOf(cell)
        if (width !== null) {
          decorations.push(Decoration.node(at, at + cell.nodeSize, { 'data-column-width': String(width), style: `--column-width: ${width}px` }))
        }
      })
    })
    const firsts = firstCells(node, tableStart)
    if (isHeaderColumn(firsts.map(({ cell }) => runsOf(cell))))
      for (const { cell, pos: at } of firsts) decorations.push(Decoration.node(at, at + cell.nodeSize, { 'data-row-header': '' }))
    return false
  })
  return DecorationSet.create(doc, decorations)
}

type TableLookState = { set: DecorationSet; drag: ColumnDrag | null }

const tableLookKey = new PluginKey<TableLookState>('tableLook')

/** The plugin that draws cell colours, a header column and column widths (tableDecorations). */
export function tableLook(): Plugin {
  return new Plugin<TableLookState>({
    key: tableLookKey,
    state: {
      init: (_config, state) => ({ set: tableDecorations(state.doc, null), drag: null }),
      apply: (tr, previous) => {
        const meta = tr.getMeta(tableLookKey) as ColumnDrag | null | undefined
        if (meta === undefined && !tr.docChanged) return previous
        // A change to the text ends a drag's preview (its table may have moved).
        const drag = meta === undefined ? null : meta
        return { set: tableDecorations(tr.doc, drag), drag }
      },
    },
    props: { decorations: (state) => tableLookKey.getState(state)?.set },
  })
}

/** Shows a column at a width while it's dragged, changing nothing; `null` ends it. */
export function previewColumnWidth(state: EditorState, dispatch: Dispatch, drag: ColumnDrag | null) {
  dispatch(state.tr.setMeta(tableLookKey, drag).setMeta('addToHistory', false))
}

/** A column's width (`null`: automatic), set on its cells. One undo step. */
export function setColumnWidth(state: EditorState, dispatch: Dispatch, tablePos: number, column: number, width: number | null): boolean {
  const table = state.doc.nodeAt(tablePos)
  if (table?.type.name !== 'table') return false
  const map = TableMap.get(table)
  if (column >= map.width) return false
  const tr = state.tr
  writeColumnWidth(tr, table, tablePos, map, column, width)
  if (tr.docChanged) dispatch(closeHistory(tr))
  else previewColumnWidth(state, dispatch, null)
  return true
}

/** Every column back to automatic. One undo step. */
export function fitAllColumns(state: EditorState, dispatch: Dispatch, tablePos: number): boolean {
  const table = state.doc.nodeAt(tablePos)
  if (table?.type.name !== 'table') return false
  const map = TableMap.get(table)
  const tr = state.tr
  for (let column = 0; column < map.width; column++) writeColumnWidth(tr, table, tablePos, map, column, null)
  if (tr.docChanged) dispatch(closeHistory(tr))
  return true
}

function writeColumnWidth(tr: Transaction, table: ProseNode, tablePos: number, map: TableMap, column: number, width: number | null) {
  const colwidth = width === null ? null : [width]
  for (let row = 0; row < map.height; row++) {
    const at = map.map[row * map.width + column]
    const cell = table.nodeAt(at)!
    if (widthOf(cell) !== width) tr.setNodeMarkup(tablePos + 1 + at, undefined, { ...cell.attrs, colwidth })
  }
}

const widthOf = (cell: ProseNode | null | undefined): number | null => (cell?.attrs.colwidth as number[] | null | undefined)?.[0] ?? null

/** The caret's column's width, or null when it's automatic. */
export function columnWidthAt(state: EditorState): number | null {
  if (!isInTable(state)) return null
  const { map, table, left } = selectedRect(state)
  return widthOf(table.nodeAt(map.map[left]))
}

/** Whether the caret's table has a column with a width set. */
export function tableHasWidths(state: EditorState): boolean {
  if (!isInTable(state)) return false
  const header = selectedRect(state).table.firstChild
  let found = false
  header?.forEach((cell) => {
    if (widthOf(cell) !== null) found = true
  })
  return found
}

/** A table node's header texts and their widths, for its comment. */
export function tableWidthsOf(table: ProseNode): { headers: string[]; widths: (number | null)[] } {
  const headers: string[] = []
  const widths: (number | null)[] = []
  table.firstChild?.forEach((cell) => {
    headers.push(cell.textContent)
    widths.push(widthOf(cell))
  })
  return { headers, widths }
}


// A row of empty cells, each aligned as its column is, above or below the
// caret's rows (or at the end: `'end'`), and the caret into it in the
// same column (the first, at the end).
function addRow(state: EditorState, dispatch: Dispatch, where: 'above' | 'below' | 'end'): boolean {
  const { map, table, tableStart, top, bottom, left } = selectedRect(state)
  const index = where === 'above' ? top : where === 'below' ? bottom : map.height
  if (index === 0) return false
  const { schema } = state
  const cells = Array.from({ length: map.width }, (_value, column) =>
    schema.nodes.table_cell.createAndFill({ alignment: table.nodeAt(map.map[column])?.attrs.alignment ?? null })!,
  )
  let pos = tableStart
  for (let row = 0; row < index; row++) pos += table.child(row).nodeSize
  const tr = state.tr.insert(pos, schema.nodes.table_row.create(null, cells))
  const updated = tr.doc.nodeAt(tableStart - 1)!
  const column = where === 'end' ? 0 : left
  tr.setSelection(TextSelection.near(tr.doc.resolve(tableStart + TableMap.get(updated).map[index * map.width + column] + 1)))
  dispatch(tr.scrollIntoView())
  return true
}

// A column of empty cells left or right of the caret's columns, unaligned
// (prosemirror-tables makes its cells with the schema's default, left,
// which would write `:---` for a column nobody aligned). The caret stays.
function addColumn(state: EditorState, dispatch: Dispatch, side: 'left' | 'right'): boolean {
  const { tableStart, left, right } = selectedRect(state)
  let added: Transaction | null = null
  const add = side === 'left' ? addColumnBefore : addColumnAfter
  if (!add(state, (tr) => (added = tr))) return false
  const tr = added as unknown as Transaction
  const table = tr.doc.nodeAt(tableStart - 1)!
  const map = TableMap.get(table)
  const column = side === 'left' ? left : right
  for (let row = 0; row < map.height; row++) {
    const pos = map.map[row * map.width + column]
    const cell = table.nodeAt(pos)!
    tr.setNodeMarkup(tableStart + pos, undefined, { ...cell.attrs, alignment: null })
  }
  dispatch(tr)
  return true
}

// Every cell in the caret's columns aligned; left is GFM's default, so it
// clears the alignment rather than writing `:---`.
function alignColumn(state: EditorState, dispatch: Dispatch, alignment: ColumnAlignment): boolean {
  const { map, table, tableStart, left, right } = selectedRect(state)
  const tr = state.tr
  const value = alignment === 'left' ? null : alignment
  for (let row = 0; row < map.height; row++) {
    for (let column = left; column < right; column++) {
      const pos = map.map[row * map.width + column]
      const cell = table.nodeAt(pos) as ProseNode
      if (cell.attrs.alignment !== value) tr.setNodeMarkup(tableStart + pos, undefined, { ...cell.attrs, alignment: value })
    }
  }
  if (tr.docChanged) dispatch(tr)
  return true
}

// The caret's cell: its row and column, and the table's size.
function cellAt(state: EditorState) {
  const rect = selectedRect(state)
  return { ...rect, row: rect.top, column: rect.left }
}

// The caret out of the table: to the start of the block after it, or a
// new line there when nothing follows.
function exitTable(state: EditorState, dispatch: Dispatch): boolean {
  const { tableStart, table } = selectedRect(state)
  const after = tableStart - 1 + table.nodeSize
  const tr = state.tr
  const next = tr.doc.resolve(after).nodeAfter
  if (!next || !next.isTextblock) tr.insert(after, state.schema.nodes.paragraph.create())
  tr.setSelection(TextSelection.near(tr.doc.resolve(after + 1), 1))
  dispatch(tr.scrollIntoView())
  return true
}

/**
 * The editor's table keys, before Milkdown's own (which go to the next
 * cell on Tab, and out of the table on any Enter). True when it handled
 * the key.
 */
export function handleTableKey(state: EditorState, dispatch: Dispatch, event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey || !isInTable(state) || !state.selection.empty) return false
  const { map, row, column } = cellAt(state)
  const lastRow = row === map.height - 1
  if (event.key === 'Tab' && !event.shiftKey && lastRow && column === map.width - 1) return addRow(state, dispatch, 'end')
  if (event.key !== 'Enter') return false
  if (event.shiftKey) return true
  if (lastRow) return exitTable(state, dispatch)
  const { tableStart } = selectedRect(state)
  const below = map.map[(row + 1) * map.width + column]
  dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(tableStart + below + 1))).scrollIntoView())
  return true
}

/** A row added at the table's end, the caret into its first cell (the "Add a row" bar). */
export function addRowAtEnd(state: EditorState, dispatch: Dispatch): boolean {
  return isInTable(state) && addRow(state, dispatch, 'end')
}
