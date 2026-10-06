// What the rich-text editor's toolbar can do: each format, whether it's on
// where the caret (or the selection) is, and how to turn it on or off.
// Plain ProseMirror commands over Milkdown's schema (commonmark + gfm), so
// a toolbar press is one undo step, the same as its keyboard shortcut.
import { lift, setBlockType, toggleMark, wrapIn } from '@milkdown/kit/prose/commands'
import type { MarkType, Node as ProseNode, NodeType } from '@milkdown/kit/prose/model'
import { liftListItem, wrapInList } from '@milkdown/kit/prose/schema-list'
import type { EditorState, Transaction } from '@milkdown/kit/prose/state'

export type FormatId =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'heading'
  | 'subheading'
  | 'bullets'
  | 'numbers'
  | 'tasks'
  | 'quote'
  | 'codeBlock'
  | 'link'

type Dispatch = (tr: Transaction) => void

const MARKS: Partial<Record<FormatId, string>> = {
  bold: 'strong',
  italic: 'emphasis',
  strike: 'strike_through',
  code: 'inlineCode',
  link: 'link',
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

const isList = (node: ProseNode) => node.type.name === 'bullet_list' || node.type.name === 'ordered_list'

/** Whether a format is on where the caret is. */
export function formatOn(state: EditorState, id: FormatId): boolean {
  const { schema } = state
  const mark = MARKS[id]
  if (mark) return markOn(state, schema.marks[mark])
  const parent = state.selection.$from.parent
  switch (id) {
    case 'heading':
    case 'subheading':
      return parent.type.name === 'heading' && parent.attrs.level === (id === 'heading' ? 1 : 2)
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
  const on = formatOn(state, id)
  const paragraph = schema.nodes.paragraph
  switch (id) {
    case 'heading':
    case 'subheading':
      return on
        ? setBlockType(paragraph)(state, dispatch)
        : setBlockType(schema.nodes.heading, { level: id === 'heading' ? 1 : 2 })(state, dispatch)
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
