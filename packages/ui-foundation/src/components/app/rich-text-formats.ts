// What the rich-text editor's toolbar can do: each format, whether it's on
// where the caret (or the selection) is, and how to turn it on or off.
// Plain ProseMirror commands over Milkdown's schema (commonmark + gfm, and
// the editor's callout node), so a toolbar press is one undo step, the
// same as its keyboard shortcut.
import { lift, setBlockType, toggleMark, wrapIn } from '@milkdown/kit/prose/commands'
import { Fragment, type MarkType, type Node as ProseNode, type NodeType, type Schema } from '@milkdown/kit/prose/model'
import { liftListItem, sinkListItem, wrapInList } from '@milkdown/kit/prose/schema-list'
import { TextSelection, type EditorState, type Transaction } from '@milkdown/kit/prose/state'
import type { CalloutKind } from '@/lib/markdown-callout'
import { HIGHLIGHT_COLORS, type HighlightColor } from '@/lib/markdown-highlight'

export type FormatId =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'highlight'
  | HighlightFormat
  | 'highlight-off'
  | 'indent'
  | 'outdent'
  | 'text'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bullets'
  | 'numbers'
  | 'tasks'
  | 'quote'
  | CalloutFormat
  | 'codeBlock'
  | 'divider'
  | 'table'
  | 'link'

/** Words highlighted in each colour. `highlight` is the toolbar's menu of them. */
export type HighlightFormat = `highlight-${HighlightColor}`

/** The colour a highlight format puts on, or null when it isn't one. */
export function highlightColorOf(id: FormatId): HighlightColor | null {
  const color = id.startsWith('highlight-') ? id.slice('highlight-'.length) : null
  return HIGHLIGHT_COLORS.find((one) => one === color) ?? null
}

/** A callout of each kind: `callout` is a note, the default. */
export type CalloutFormat = 'callout' | `callout-${Exclude<CalloutKind, 'note'>}`

/** The kind of callout a format makes, or null when it isn't one. */
export function calloutKindOf(id: FormatId): CalloutKind | null {
  if (id === 'callout') return 'note'
  return id.startsWith('callout-') ? (id.slice('callout-'.length) as CalloutKind) : null
}

const HEADING_LEVEL: Partial<Record<FormatId, number>> = { heading1: 1, heading2: 2, heading3: 3 }

type Dispatch = (tr: Transaction) => void

const MARKS: Partial<Record<FormatId, string>> = {
  bold: 'strong',
  italic: 'emphasis',
  strike: 'strike_through',
  code: 'inlineCode',
  link: 'link',
}

/**
 * The colour of the highlight on the selection (the caret's own, or what
 * is typed next, with nothing selected), or null when there is none or the
 * words are highlighted in more than one.
 */
export function highlightColor(state: EditorState): HighlightColor | null {
  const type = state.schema.marks.highlight
  if (!type) return null
  const { from, to, empty, $from } = state.selection
  const colors = new Set<string | null>()
  if (empty) colors.add((type.isInSet(state.storedMarks ?? $from.marks())?.attrs.color as string | undefined) ?? null)
  else
    state.doc.nodesBetween(from, to, (node) => {
      if (node.isInline) colors.add((type.isInSet(node.marks)?.attrs.color as string | undefined) ?? null)
    })
  if (colors.size !== 1) return null
  const [only] = [...colors]
  return HIGHLIGHT_COLORS.find((color) => color === only) ?? null
}

// Highlights the selection in `color` (what was highlighted before, in any
// colour, replaced), or takes the highlight off with null. With nothing
// selected it is what is typed next.
function setHighlight(state: EditorState, dispatch: Dispatch, color: HighlightColor | null): boolean {
  const type = state.schema.marks.highlight
  if (!type) return false
  const { from, to, empty } = state.selection
  if (empty) {
    const tr = state.tr.removeStoredMark(type)
    dispatch(color ? tr.addStoredMark(type.create({ color })) : tr)
    return true
  }
  const tr = state.tr.removeMark(from, to, type)
  dispatch(color ? tr.addMark(from, to, type.create({ color })) : tr)
  return true
}

function markOn(state: EditorState, type: MarkType): boolean {
  const { from, to, empty, $from } = state.selection
  if (empty) return Boolean(type.isInSet(state.storedMarks ?? $from.marks()))
  return state.doc.rangeHasMark(from, to, type)
}

// The innermost ancestor of the caret matching `test`, and its position.
function ancestor(state: EditorState, test: (node: ProseNode) => boolean): { node: ProseNode; pos: number } | null {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (test(node)) return { node, pos: $from.before(depth) }
  }
  return null
}

/** The table the caret is in, and its position, or null. */
export function tableAt(state: EditorState): { node: ProseNode; pos: number } | null {
  return ancestor(state, (node) => node.type.name === 'table')
}

const isList = (node: ProseNode) => node.type.name === 'bullet_list' || node.type.name === 'ordered_list'

/** Whether a format is on where the caret is. */
export function formatOn(state: EditorState, id: FormatId): boolean {
  const { schema } = state
  const mark = MARKS[id]
  if (mark) return markOn(state, schema.marks[mark])
  const parent = state.selection.$from.parent
  const level = HEADING_LEVEL[id]
  if (level) return parent.type.name === 'heading' && parent.attrs.level === level
  if (id === 'highlight') return highlightColor(state) !== null
  const color = highlightColorOf(id)
  if (color) return highlightColor(state) === color
  const kind = calloutKindOf(id)
  if (kind) return ancestor(state, (node) => node.type.name === 'callout')?.node.attrs.kind === kind
  switch (id) {
    case 'text':
      return parent.type.name === 'paragraph' && !ancestor(state, (node) => isList(node) || node.type.name === 'blockquote')
    case 'divider':
    case 'indent':
    case 'outdent':
    case 'highlight-off':
      return false
    case 'table':
      return tableAt(state) !== null
    case 'codeBlock':
      return parent.type.name === 'code_block'
    case 'quote':
      return ancestor(state, (node) => node.type.name === 'blockquote') !== null
    default: {
      const list = ancestor(state, isList)
      const item = ancestor(state, (node) => node.type.name === 'list_item')
      if (!list || !item) return false
      const task = item.node.attrs.checked != null
      if (id === 'tasks') return task
      if (id === 'numbers') return list.node.type.name === 'ordered_list'
      return list.node.type.name === 'bullet_list' && !task
    }
  }
}

// The list the caret is in, turned into `type`, every item a task item or
// none (`checked`: false for a task, null for not).
function convertList(tr: Transaction, type: NodeType, checked: boolean | null): Transaction {
  const $from = tr.selection.$from
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (!isList(node)) continue
    const pos = $from.before(depth)
    tr.setNodeMarkup(pos, type)
    node.forEach((item, offset) => {
      const itemPos = pos + 1 + offset
      const keep = checked === false && item.attrs.checked != null ? item.attrs.checked : checked
      tr.setNodeMarkup(itemPos, undefined, {
        ...item.attrs,
        checked: keep,
        listType: type.name === 'ordered_list' ? 'ordered' : 'bullet',
      })
    })
    return tr
  }
  return tr
}

/**
 * Turns a format on, or off when it's already on, where the caret is.
 * Returns false when it can't apply there. `link` isn't run here: the
 * toolbar opens the link box for it.
 */
export function toggleFormat(state: EditorState, dispatch: Dispatch, id: FormatId): boolean {
  const { schema } = state
  const mark = MARKS[id]
  if (mark && id !== 'link') return toggleMark(schema.marks[mark])(state, dispatch)
  const color = highlightColorOf(id)
  if (color) return setHighlight(state, dispatch, formatOn(state, id) ? null : color)
  if (id === 'highlight-off') return setHighlight(state, dispatch, null)
  if (id === 'indent') return sinkListItem(schema.nodes.list_item)(state, dispatch)
  if (id === 'outdent') return liftListItem(schema.nodes.list_item)(state, dispatch)
  const on = formatOn(state, id)
  const paragraph = schema.nodes.paragraph
  const level = HEADING_LEVEL[id]
  if (level) return on ? setBlockType(paragraph)(state, dispatch) : setBlockType(schema.nodes.heading, { level })(state, dispatch)
  const kind = calloutKindOf(id)
  if (kind) return toggleCallout(state, dispatch, kind)
  switch (id) {
    case 'text':
      return toText(state, dispatch)
    case 'divider':
      return insertBlock(state, dispatch, schema.nodes.hr.create(), false)
    case 'table':
      return on ? false : insertBlock(state, dispatch, createTable(schema), true)
    case 'codeBlock':
      return on ? setBlockType(paragraph)(state, dispatch) : setBlockType(schema.nodes.code_block)(state, dispatch)
    case 'quote':
      return on ? lift(state, dispatch) : wrapIn(schema.nodes.blockquote)(state, dispatch)
    case 'bullets':
    case 'numbers':
    case 'tasks': {
      if (on) return liftListItem(schema.nodes.list_item)(state, dispatch)
      const type = id === 'numbers' ? schema.nodes.ordered_list : schema.nodes.bullet_list
      const checked = id === 'tasks' ? false : null
      if (ancestor(state, isList)) {
        dispatch(convertList(state.tr, type, checked))
        return true
      }
      let wrapped: Transaction | null = null
      if (!wrapInList(type)(state, (tr) => (wrapped = tr))) return false
      dispatch(convertList(wrapped!, type, checked))
      return true
    }
    default:
      return false
  }
}

// The line the caret is in as plain text (Notion's "Text"): out of a
// heading or code block, a list, a quote. False when it already is.
function toText(state: EditorState, dispatch: Dispatch): boolean {
  const { schema } = state
  const parent = state.selection.$from.parent
  if (parent.type !== schema.nodes.paragraph) return setBlockType(schema.nodes.paragraph)(state, dispatch)
  if (ancestor(state, isList)) return liftListItem(schema.nodes.list_item)(state, dispatch)
  if (ancestor(state, (node) => node.type.name === 'blockquote' || node.type.name === 'callout')) return lift(state, dispatch)
  return false
}

// A callout of `kind` where the caret is: around its block, or the
// callout it's in turned into that kind, or (already that kind) the
// callout taken away, its blocks kept.
function toggleCallout(state: EditorState, dispatch: Dispatch, kind: CalloutKind): boolean {
  const callout = ancestor(state, (node) => node.type.name === 'callout')
  if (!callout) return wrapIn(state.schema.nodes.callout, { kind })(state, dispatch)
  const { node, pos } = callout
  if (node.attrs.kind !== kind) {
    dispatch(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, kind }))
    return true
  }
  const tr = state.tr.replaceWith(pos, pos + node.nodeSize, node.content)
  dispatch(tr.setSelection(TextSelection.create(tr.doc, Math.max(0, state.selection.from - 1))).scrollIntoView())
  return true
}

/** A new table: a header row and two rows, three columns, every cell empty and unaligned. */
export function createTable(schema: Schema, rows = 3, columns = 3): ProseNode {
  const row = (type: string, cell: string) =>
    schema.nodes[type].create(null, Array.from({ length: columns }, () => schema.nodes[cell].createAndFill({ alignment: null })!))
  return schema.nodes.table.create(null, [
    row('table_header_row', 'table_header'),
    ...Array.from({ length: rows - 1 }, () => row('table_row', 'table_cell')),
  ])
}

// A block (a rule, a table) where the caret is: in place of an empty
// line, else after the caret's block. A line to go on writing follows it
// when nothing does. The caret goes into the block (`into`), or past it.
function insertBlock(state: EditorState, dispatch: Dispatch, block: ProseNode, into: boolean): boolean {
  const { $from } = state.selection
  if (tableAt(state) || !$from.parent.isTextblock || $from.parent.type.spec.code) return false
  const depth = $from.depth
  const container = $from.node(depth - 1)
  const index = $from.index(depth - 1)
  const empty = $from.parent.content.size === 0
  const followed = index + 1 < container.childCount
  const content = Fragment.from(into && followed ? [block] : [block, state.schema.nodes.paragraph.create()])
  const at = empty ? index : index + 1
  if (!container.canReplace(at, empty ? index + 1 : at, content)) return false
  const from = empty ? $from.before(depth) : $from.after(depth)
  const tr = state.tr.replaceWith(from, empty ? $from.after(depth) : from, content)
  tr.setSelection(TextSelection.near(tr.doc.resolve(into ? from + 1 : from + block.nodeSize), 1))
  dispatch(tr.scrollIntoView())
  return true
}
