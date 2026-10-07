// What the rich-text editor can do to a table: rows and columns added and
// deleted, a column's alignment, the whole table deleted, and its keys.
// Plain ProseMirror commands over prosemirror-tables and Milkdown's gfm
// schema, so each is one undo step.
//
// What GFM can't store, the editor doesn't offer: a table always keeps its
// header row and at least one row under it, and at least one column, so
// those deletes are off where they'd break that (the header row can't be
// deleted or have a row put above it). Alignment is per column, as the
// Markdown writes it (`:---:`).
//
// Keys (handleTableKey), on top of Milkdown's Tab/Shift+Tab between cells:
// Tab in the last cell adds a row; Enter goes to the cell below, and out
// of the table from its last row; Shift+Enter does nothing (a line break
// can't be stored inside a cell).
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import { TextSelection, type EditorState, type Transaction } from '@milkdown/kit/prose/state'
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

export type ColumnAlignment = 'left' | 'center' | 'right'

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
    default:
      return false
  }
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
