// The rich-text editor's own node views: how a callout and a table are
// drawn in the text. Each has a slot outside the editable content (a
// callout's icon, a table's "add a row"/"add a column" bars) where the
// editor renders React (rich-text-widgets.tsx, through a portal), and
// ProseMirror leaves alone: events there are the widget's, and changes to
// it aren't read back as edits.
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import type { EditorView, NodeView } from '@milkdown/kit/prose/view'
import { cn } from 'cn'
import { CALLOUT_KINDS, type CalloutKind } from '@/lib/markdown-callout'
import { CALLOUT_BOX, CALLOUT_LOOK } from './prose-look'
import { TABLE_SCROLL_FOCUS, watchTableScroll } from './prose-table-scroll'

/** A slot a node view has, for the editor to render its widget into. */
export type Widget =
  | { type: 'callout'; key: string; slot: HTMLElement; kind: CalloutKind; getPos: () => number | undefined }
  | { type: 'table'; key: string; slot: HTMLElement; column: HTMLElement; getPos: () => number | undefined }

// Each slot's key for its portal, for as long as the node view lives.
let made = 0
const nextKey = () => `widget-${++made}`

/** Where node views tell the editor their slots came, changed and went. */
export type WidgetRegistry = {
  set: (widget: Widget) => void
  remove: (slot: HTMLElement) => void
}

export function calloutKind(value: unknown): CalloutKind {
  return CALLOUT_KINDS.includes(value as CalloutKind) ? (value as CalloutKind) : 'note'
}

function slot(className: string, tag: 'span' | 'div' = 'div'): HTMLElement {
  const element = document.createElement(tag)
  element.contentEditable = 'false'
  element.className = className
  return element
}

// Mutations ProseMirror shouldn't read as edits: anything outside the
// node's editable content (its slots, and the classes set here).
function outside(contentDOM: HTMLElement) {
  return (mutation: MutationRecord | { type: 'selection'; target: Node }) =>
    mutation.type !== 'selection' && !contentDOM.contains(mutation.target)
}

/** A callout: its kind's box, its icon (a widget: the kind's menu) beside its blocks. */
export function calloutView(node: ProseNode, getPos: () => number | undefined, registry: WidgetRegistry): NodeView {
  const dom = document.createElement('div')
  const icon = slot('flex h-5 shrink-0 items-center', 'span')
  const contentDOM = document.createElement('div')
  contentDOM.className = 'flex min-w-0 flex-1 flex-col gap-2'
  dom.append(icon, contentDOM)

  let current = node
  const key = nextKey()
  const render = () => {
    const kind = calloutKind(current.attrs.kind)
    dom.dataset.callout = kind
    dom.className = cn(CALLOUT_BOX, CALLOUT_LOOK[kind].box)
    registry.set({ type: 'callout', key, slot: icon, kind, getPos })
  }
  render()

  return {
    dom,
    contentDOM,
    update: (next) => {
      if (next.type !== current.type) return false
      current = next
      render()
      return true
    },
    stopEvent: (event) => icon.contains(event.target as Node),
    ignoreMutation: outside(contentDOM),
    destroy: () => registry.remove(icon),
  }
}

// A table's header row, as texts, from the node (its first row's cells).
function columnsOf(node: ProseNode): string[] {
  const header = node.firstChild
  if (!header) return []
  const columns: string[] = []
  header.forEach((cell) => columns.push(cell.textContent))
  return columns
}

// How far an arrow key scrolls the table's box.
const SCROLL_STEP = 40

// The keys a focused table box takes: the arrow keys, Home and End scroll
// it, as a box that isn't editable scrolls by itself, and any other plain
// key adds nothing (the text can't be typed into from the table's frame).
// Tab, Esc and shortcuts are left alone: Tab leaves the box, Esc and the
// shortcuts go on to the field. True when it took the key.
function scrollKey(box: HTMLElement, event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey || event.key === 'Tab' || event.key === 'Escape') return false
  const max = box.scrollWidth - box.clientWidth
  const to: Partial<Record<string, number>> = {
    ArrowLeft: box.scrollLeft - SCROLL_STEP,
    ArrowRight: box.scrollLeft + SCROLL_STEP,
    Home: 0,
    End: max,
  }
  const target = to[event.key]
  if (target !== undefined) box.scrollLeft = Math.min(Math.max(target, 0), max)
  event.preventDefault()
  return true
}

// How long a press keeps the box out of the tab order: until the click it
// starts, or this long for one that never clicks (a touch that pans).
const PRESS_MS = 1000

/**
 * A table: in a box that scrolls sideways when it's wider than the text,
 * with an "add a column" bar along its right and an "add a row" bar under
 * it (widgets), Notion's way. While it scrolls, the box is a tab stop and
 * a region named for its columns (prose-table-scroll.ts), which the arrow
 * keys, Home and End scroll; a click in it still puts the caret in the
 * cell clicked.
 */
export function tableView(
  node: ProseNode,
  view: EditorView,
  getPos: () => number | undefined,
  registry: WidgetRegistry,
): NodeView {
  const dom = document.createElement('div')
  dom.dataset.slot = 'rich-text-table'
  dom.className = 'group/table grid grid-cols-[minmax(0,1fr)_auto] gap-1'
  const scroll = document.createElement('div')
  scroll.className = cn('overflow-x-auto rounded-lg border border-border', TABLE_SCROLL_FOCUS)
  const table = document.createElement('table')
  const contentDOM = document.createElement('tbody')
  table.append(contentDOM)
  scroll.append(table)
  const column = slot('flex w-5')
  const row = slot('col-start-1 flex h-5')
  dom.append(scroll, column, row)
  registry.set({ type: 'table', key: nextKey(), slot: row, column, getPos })
  const region = watchTableScroll(scroll, table, columnsOf(node))

  // A press in the box is the text's: a click in a cell puts the caret
  // there. The browser focuses the nearest focusable ancestor of what was
  // pressed, which would be the box while it's a tab stop, so the box
  // leaves the tab order from the press to its click.
  let pressing: ReturnType<typeof setTimeout> | undefined
  const released = () => {
    clearTimeout(pressing)
    pressing = undefined
    document.removeEventListener('click', releasedSoon, true)
    region.resume()
  }
  const releasedSoon = () => setTimeout(released)
  const onPointerDown = (event: PointerEvent) => {
    if (event.target === scroll && event.pointerType === 'mouse') return // its own scrollbar
    region.suspend()
    clearTimeout(pressing)
    pressing = setTimeout(released, PRESS_MS)
    document.addEventListener('click', releasedSoon, { capture: true, once: true })
  }
  scroll.addEventListener('pointerdown', onPointerDown)

  // A key pressed while the box has focus is the box's (scrollKey), never
  // ProseMirror's. It comes one of two ways. To the box itself, when the
  // text's selection is outside it. Or, when the browser first moves
  // focus to the editable text around it (as it can for a box inside
  // editable text), to the text: then the box's blur to the text marks
  // the key that follows in the same moment as the box's, and focus goes
  // back to it.
  const onBoxKey = (event: KeyboardEvent) => {
    if (event.target === scroll && scrollKey(scroll, event)) event.stopPropagation()
  }
  let bounced = false
  const onBlur = (event: FocusEvent) => {
    if (event.relatedTarget !== view.dom) return
    bounced = true
    setTimeout(() => (bounced = false))
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (!bounced) return
    bounced = false
    scroll.focus({ preventScroll: true })
    if (scrollKey(scroll, event)) event.stopImmediatePropagation()
  }
  scroll.addEventListener('keydown', onBoxKey)
  scroll.addEventListener('blur', onBlur)
  view.dom.addEventListener('keydown', onKeyDown, true)

  return {
    dom,
    contentDOM,
    update: (next) => {
      if (next.type.name !== 'table') return false
      region.setColumns(columnsOf(next))
      return true
    },
    stopEvent: (event) => row.contains(event.target as Node) || column.contains(event.target as Node),
    ignoreMutation: outside(contentDOM),
    destroy: () => {
      released()
      region.destroy()
      scroll.removeEventListener('pointerdown', onPointerDown)
      scroll.removeEventListener('blur', onBlur)
      scroll.removeEventListener('keydown', onBoxKey)
      view.dom.removeEventListener('keydown', onKeyDown, true)
      registry.remove(row)
    },
  }
}
