// A task-list item's node view in the editor (milkdown-editor.tsx): a real
// checkbox that ticks it, and the keyboard's way to do the same.
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import type { EditorView, NodeView } from '@milkdown/kit/prose/view'
import { TASK_ROW, taskBoxHit } from './rich-text-tasks'

// A task-list item: its checkbox toggles `checked`. Any other list item
// renders as Milkdown's own.
export function taskItemView(node: ProseNode, view: EditorView, getPos: () => number | undefined): NodeView {
  const dom = document.createElement('li')
  const box = document.createElement('input')
  box.type = 'checkbox'
  box.contentEditable = 'false'
  box.tabIndex = -1
  box.setAttribute('aria-label', 'Done')
  const contentDOM = document.createElement('div')
  // Takes the row's width, so an empty item's caret and placeholder show.
  contentDOM.className = 'min-w-0 flex-1'
  dom.append(taskBoxHit(box), contentDOM)
  dom.className = TASK_ROW
  dom.dataset.itemType = 'task'

  let current = node
  const render = () => {
    box.checked = Boolean(current.attrs.checked)
    dom.dataset.checked = String(Boolean(current.attrs.checked))
  }
  render()
  box.addEventListener('mousedown', (event) => event.preventDefault())
  // The browser's own toggle is left to happen (cancelling a checkbox's
  // click puts its old state back after this handler), and the document
  // follows it.
  box.addEventListener('click', () => {
    const pos = getPos()
    if (pos === undefined || !view.editable) return
    view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, checked: !current.attrs.checked }))
  })
  return {
    dom,
    contentDOM,
    update: (next) => {
      if (next.type !== current.type || next.attrs.checked == null) return false
      current = next
      render()
      return true
    },
    stopEvent: (event) => event.target === box || event.target === box.parentElement,
    ignoreMutation: (mutation) => mutation.target === box || mutation.target === box.parentElement,
  }
}

// The task-list item the caret is in, ticked or unticked. False when the
// caret isn't in one.
export function toggleTaskItem(view: EditorView): boolean {
  const { $from } = view.state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (node.type.name === 'list_item' && node.attrs.checked != null) {
      view.dispatch(view.state.tr.setNodeMarkup($from.before(depth), undefined, { ...node.attrs, checked: !node.attrs.checked }))
      return true
    }
  }
  return false
}
