// The rich-text editor's own node views: how a callout and a table are
// drawn in the text. Each has a slot outside the editable content (a
// callout's icon, a table's "add a row"/"add a column" bars) where the
// editor renders React (rich-text-widgets.tsx, through a portal), and
// ProseMirror leaves alone: events there are the widget's, and changes to
// it aren't read back as edits.
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import type { NodeView } from '@milkdown/kit/prose/view'
import { cn } from 'cn'
import { CALLOUT_KINDS, type CalloutKind } from '@/lib/markdown-callout'
import { CALLOUT_BOX, CALLOUT_LOOK } from './prose-look'

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

/**
 * A table: in a box that scrolls sideways when it's wider than the text,
 * with an "add a column" bar along its right and an "add a row" bar under
 * it (widgets), Notion's way.
 */
export function tableView(getPos: () => number | undefined, registry: WidgetRegistry): NodeView {
  const dom = document.createElement('div')
  dom.dataset.slot = 'rich-text-table'
  dom.className = 'group/table grid grid-cols-[minmax(0,1fr)_auto] gap-1'
  const scroll = document.createElement('div')
  scroll.className = 'overflow-x-auto rounded-lg border border-border'
  const table = document.createElement('table')
  const contentDOM = document.createElement('tbody')
  table.append(contentDOM)
  scroll.append(table)
  const column = slot('flex w-5')
  const row = slot('col-start-1 flex h-5')
  dom.append(scroll, column, row)
  registry.set({ type: 'table', key: nextKey(), slot: row, column, getPos })

  return {
    dom,
    contentDOM,
    update: (next) => next.type.name === 'table',
    stopEvent: (event) => row.contains(event.target as Node) || column.contains(event.target as Node),
    ignoreMutation: outside(contentDOM),
    destroy: () => registry.remove(row),
  }
}
