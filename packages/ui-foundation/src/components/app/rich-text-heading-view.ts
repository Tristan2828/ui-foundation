// A heading's node view in the editor (milkdown-editor.tsx): the element
// `headingLevel` gives it, and a toggle heading's fold button.
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import type { Decoration, NodeView } from '@milkdown/kit/prose/view'
import { cn } from 'cn'
import { FOLD_BUTTON, FOLD_HEADING, headingBand, headingClass, headingTag, type HeadingLevel } from './prose-look'
import { foldSpecOf, type FoldSpec } from './rich-text-fold'

// A heading: the element `headingLevel` gives its level, the look its
// level has. Marked as a band for PROSE_INSET (`#` and `##`).
//
// With `foldKey` (`onFold`), a toggle heading sits beside its fold button,
// as in <Markdown>: the look on the two together, the button out of the
// tab order (Ctrl/Cmd+Alt+[ and ] and NotesOutline are the keyboard's
// way), kept invisible where there's nothing under the heading to fold,
// or the heading isn't at the top level. A plain heading has no button
// and no room for one; its fold id still marks it, for NotesOutline.
export function headingView(
  node: ProseNode,
  top: HeadingLevel,
  textTop: number,
  decorations: readonly Decoration[],
  onFold?: (id: string) => void,
): NodeView {
  const level = Number(node.attrs.level)
  const heading = document.createElement(headingTag(level, top, textTop))
  const sameLevel = (next: ProseNode) =>
    next.type === node.type && next.attrs.level === node.attrs.level && Boolean(next.attrs.toggle) === Boolean(node.attrs.toggle)
  if (node.attrs.toggle) heading.dataset.toggle = ''
  if (!onFold || !node.attrs.toggle) {
    heading.className = headingClass(level)
    if (headingBand(level)) heading.dataset.band = ''
    const mark = (decorations: readonly Decoration[]) => {
      const spec = onFold ? foldSpecOf(decorations) : null
      if (spec) heading.dataset.foldId = spec.id
      else delete heading.dataset.foldId
    }
    mark(decorations)
    return {
      dom: heading,
      contentDOM: heading,
      update: (next, decorations) => {
        if (!sameLevel(next)) return false
        mark(decorations)
        return true
      },
    }
  }
  const dom = document.createElement('div')
  dom.dataset.toggle = ''
  dom.className = cn(FOLD_HEADING, headingClass(level))
  if (headingBand(level)) dom.dataset.band = ''
  heading.className = 'min-w-0 flex-1'
  const button = document.createElement('button')
  button.type = 'button'
  button.tabIndex = -1
  button.contentEditable = 'false'
  button.dataset.slot = 'fold-button'
  const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  chevron.setAttribute('viewBox', '0 0 24 24')
  chevron.setAttribute('aria-hidden', 'true')
  chevron.innerHTML =
    '<path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />'
  button.append(chevron)
  dom.append(button, heading)
  let spec: FoldSpec | null = null
  const render = (decorations: readonly Decoration[]) => {
    spec = foldSpecOf(decorations)
    button.className = cn(FOLD_BUTTON, !spec?.foldable && 'invisible')
    chevron.setAttribute('class', cn('size-4 transition-transform', spec?.folded && '-rotate-90'))
    button.setAttribute('aria-expanded', String(!spec?.folded))
    button.setAttribute('aria-label', spec?.label || 'Section')
    if (spec) dom.dataset.foldId = spec.id
    else delete dom.dataset.foldId
  }
  render(decorations)
  // A press keeps the caret where it is.
  button.addEventListener('mousedown', (event) => event.preventDefault())
  button.addEventListener('click', () => {
    if (spec?.foldable) onFold(spec.id)
  })
  return {
    dom,
    contentDOM: heading,
    update: (next, decorations) => {
      if (!sameLevel(next)) return false
      render(decorations)
      return true
    },
    stopEvent: (event) => button.contains(event.target as Node),
    ignoreMutation: (mutation) => mutation.type !== 'selection' && !heading.contains(mutation.target),
  }
}
