// The note's two edges: a code
// block, a table, a quote, a callout or a divider that ends a note had no
// way past it (Ctrl+Enter, shown nowhere, and none on a phone), and one
// that starts it nothing above it.
// - ArrowDown at the end of such a last block, or ArrowRight at its very
//   end, puts a line under it and the caret there; ArrowUp (ArrowLeft) at
//   the start of such a first block, a line above it. Anywhere else the
//   keys are left alone.
// - A click under the last block (in the text's padding or the space under
//   a short note) puts the caret on a line under it: a new one, unless the
//   last block is already a paragraph. A click above the first block, a
//   line above it when that block isn't one.
// - Ticking a task's box keeps focus in the text, so
//   Ctrl+Z takes the tick back: from outside, the caret lands in that item.
// No trailing-paragraph rule: a note isn't given a line nobody typed, so
// nothing is saved until one is asked for. And no gap cursor, which can't
// stand by a code block (a textblock).
import { Plugin, Selection, TextSelection } from '@milkdown/kit/prose/state'
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import type { EditorView } from '@milkdown/kit/prose/view'
import { $prose } from '@milkdown/kit/utils'

// The blocks the keys lead out of: those Enter doesn't (a code block keeps
// its lines, a table's last row has its own Enter), or does only twice.
const BOXED = new Set(['code_block', 'table', 'blockquote', 'callout', 'hr'])

type Side = 'end' | 'start'

// Whether the selection is at the note's edge, in the block there that the
// keys lead out of: on its last (first) line, or its table's last (first)
// row; for `whole`, at its very end (start), as ArrowRight needs.
function atEdge(view: EditorView, side: Side, whole: boolean): boolean {
  const { doc, selection } = view.state
  const block = side === 'end' ? doc.lastChild : doc.firstChild
  if (!block || !BOXED.has(block.type.name)) return false
  const edge = side === 'end' ? Selection.atEnd(doc) : Selection.atStart(doc)
  if (selection.eq(edge)) return true
  if (!selection.empty || whole) return false
  const $head = selection.$head
  if ($head.index(0) !== (side === 'end' ? doc.childCount - 1 : 0)) return false
  if (!view.endOfTextblock(side === 'end' ? 'down' : 'up')) return false
  if ($head.parent === edge.$head.parent) return true
  // In a table: any cell of its last (first) row.
  return block.type.name === 'table' && $head.depth >= 2 && $head.index(1) === (side === 'end' ? block.childCount - 1 : 0)
}

// A paragraph at the note's edge, the caret in it, scrolled to.
function addLine(view: EditorView, side: Side): void {
  const { state } = view
  const at = side === 'end' ? state.doc.content.size : 0
  const tr = state.tr.insert(at, state.schema.nodes.paragraph.create())
  view.dispatch(tr.setSelection(TextSelection.create(tr.doc, at + 1)).scrollIntoView())
}

// The caret at the note's edge (a paragraph there), or a new line past the
// block that's there.
function toEdge(view: EditorView, side: Side): void {
  const { doc } = view.state
  const block = (side === 'end' ? doc.lastChild : doc.firstChild) as ProseNode
  if (block.type.name === 'paragraph') {
    const selection = side === 'end' ? Selection.atEnd(doc) : Selection.atStart(doc)
    view.dispatch(view.state.tr.setSelection(selection).scrollIntoView())
  } else addLine(view, side)
  view.focus()
}

/** Whether a key press leads out of the block at the note's edge, and does it if so. */
export function handleEdgeKey(view: EditorView, event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.isComposing) return false
  const side: Side | null = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 'end' : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? 'start' : null
  if (!side || !atEdge(view, side, event.key === 'ArrowRight' || event.key === 'ArrowLeft')) return false
  event.preventDefault()
  addLine(view, side)
  return true
}

// Which edge a click is past: under the last block's box or above the
// first's, or neither.
function clickedPast(view: EditorView, event: MouseEvent): Side | null {
  const first = view.dom.firstElementChild
  const last = view.dom.lastElementChild
  if (!first || !last) return null
  if (event.clientY > last.getBoundingClientRect().bottom) return 'end'
  if (event.clientY < first.getBoundingClientRect().top) return 'start'
  return null
}

// What a press below or above the text is for: the element the text sits
// in, padding and all (Milkdown's root, around its own wrapper).
function frameOf(view: EditorView): HTMLElement {
  return view.dom.parentElement?.parentElement ?? view.dom
}

function isTaskBox(target: EventTarget | null): target is HTMLInputElement {
  return target instanceof HTMLInputElement && target.type === 'checkbox' && target.closest('li')?.dataset.itemType === 'task'
}

/** The plugin: the keys at the edges, a click past them, and focus kept on a ticked box. */
export function edgesPlugin(): Plugin {
  return new Plugin({
    props: {
      handleKeyDown: (view, event) => view.editable && handleEdgeKey(view, event),
    },
    view: (view) => {
      const frame = frameOf(view)
      const press = (event: MouseEvent) => {
        if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey || !view.editable) return
        // Only presses on the text's own surface: not a node view's
        // control, a menu or a toolbar in the frame.
        const target = event.target as Node | null
        if (target !== frame && target !== view.dom && target !== view.dom.parentElement) return
        const side = clickedPast(view, event)
        if (!side) return
        event.preventDefault()
        toEdge(view, side)
      }
      // The box's own click (milkdown-editor.tsx) ticks it; this brings focus
      // back to the text after, the caret in that item when it was elsewhere.
      const ticked = (event: MouseEvent) => {
        if (!isTaskBox(event.target) || !view.editable) return
        const text = event.target.nextElementSibling
        if (!view.hasFocus() && text) {
          const $at = view.state.doc.resolve(view.posAtDOM(text, 0))
          view.dispatch(view.state.tr.setSelection(Selection.near($at)))
        }
        view.focus()
      }
      frame.addEventListener('mousedown', press)
      view.dom.addEventListener('click', ticked)
      return {
        destroy: () => {
          frame.removeEventListener('mousedown', press)
          view.dom.removeEventListener('click', ticked)
        },
      }
    },
  })
}


/** The plugin, for the editor's `.use()`. */
export const edges = $prose(() => edgesPlugin())
