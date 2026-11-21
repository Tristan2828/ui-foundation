// Where the editor's boxes (the link box, the page box) open: a point in
// the text, for the popover's anchor.
import type { EditorView } from '@milkdown/kit/prose/view'

export type BoxAnchor = { getBoundingClientRect: () => DOMRect; contextElement: Element }

export function anchorAt(view: EditorView, pos: number): BoxAnchor {
  const point = view.coordsAtPos(pos)
  return {
    getBoundingClientRect: () => new DOMRect(point.left, point.top, 0, point.bottom - point.top),
    contextElement: view.dom,
  }
}
