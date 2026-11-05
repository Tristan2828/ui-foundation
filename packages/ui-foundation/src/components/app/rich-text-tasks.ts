// Task lists in the rich-text editor, typed rather than picked:
// - `[] ` (or `[ ] `, `[x] `) at a line's start makes it a task item: a
//   plain line becomes a new task list, a list item becomes a task item.
//   GFM's own rule only knows `[ ] ` already inside a list item.
// - Enter in a task item makes the next one, its box unticked, whatever
//   the item it came from. (ProseMirror's split copies the item, ticked
//   box and all.) Enter in an empty one ends the list, as in a bulleted
//   one: that's ProseMirror's own, left as it is.
import { InputRule } from '@milkdown/kit/prose/inputrules'
import { findWrapping } from '@milkdown/kit/prose/transform'
import { splitListItem } from '@milkdown/kit/prose/schema-list'
import type { EditorState, Transaction } from '@milkdown/kit/prose/state'
import { $inputRule } from '@milkdown/kit/utils'

const TASK_START = /^\[([ xX]?)\]\s$/

export const taskInputRule = $inputRule(
  () =>
    new InputRule(TASK_START, (state, match, start, end) => {
      const { list_item: item, bullet_list: list } = state.schema.nodes
      const $start = state.doc.resolve(start)
      const paragraph = $start.parent
      if (paragraph.type.name !== 'paragraph') return null
      const checked = match[1].toLowerCase() === 'x'
      // A list item's first line: the item becomes a task item.
      if ($start.depth >= 2 && $start.node(-1).type === item && $start.index(-1) === 0) {
        const node = $start.node(-1)
        if (node.attrs.checked != null) return null
        return state.tr.delete(start, end).setNodeMarkup($start.before(-1), undefined, { ...node.attrs, checked })
      }
      // A plain line: wrapped in a new list, its item a task item.
      const tr = state.tr.delete(start, end)
      const range = tr.doc.resolve(start).blockRange()
      const wrapping = range && findWrapping(range, list)
      if (!range || !wrapping) return null
      tr.wrap(range, wrapping)
      const itemPos = range.start + 1
      const made = tr.doc.nodeAt(itemPos)
      if (made?.type !== item) return null
      return tr.setNodeMarkup(itemPos, undefined, { ...made.attrs, checked })
    }),
)

/**
 * Enter in a task item with words in it: the item split there, and the
 * new one's box unticked. False anywhere else (an empty task item
 * included), for the editor's own Enter.
 */
export function splitTaskItem(state: EditorState, dispatch: (tr: Transaction) => void): boolean {
  const { $from, empty } = state.selection
  if (!empty || $from.depth < 2 || $from.parent.type.name !== 'paragraph') return false
  const node = $from.node(-1)
  if (node.type.name !== 'list_item' || node.attrs.checked == null) return false
  if ($from.parent.content.size === 0) return false
  let split: Transaction | null = null
  if (!splitListItem(node.type)(state, (tr) => (split = tr))) return false
  const tr = split as Transaction | null
  if (!tr) return false
  const $to = tr.selection.$from
  for (let depth = $to.depth; depth > 0; depth--) {
    const made = $to.node(depth)
    if (made.type.name !== 'list_item') continue
    if (made.attrs.checked) tr.setNodeMarkup($to.before(depth), undefined, { ...made.attrs, checked: false })
    break
  }
  dispatch(tr.scrollIntoView())
  return true
}
