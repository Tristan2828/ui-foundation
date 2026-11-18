// The editor's links (milkdown-editor.tsx): what a link edit applies to,
// setting or removing one, and following one on a click.
import type { EditorState } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { linkHref } from '@/lib/link-href'
import type { PageLinkResolver } from '@/lib/page-link'
import { pageLinkInfo } from './rich-text-page-links'

// What a link edit applies to: the selection, or with nothing selected
// the whole link the caret is in (else just the caret), and the address it
// has now (`''` when none).
export type LinkTarget = { from: number; to: number; href: string }

export function linkTarget(state: EditorState): LinkTarget {
  const link = state.schema.marks.link
  const { from, to, empty, $from } = state.selection
  if (!empty) {
    let href = ''
    state.doc.nodesBetween(from, to, (node) => {
      const mark = link.isInSet(node.marks)
      if (mark && !href) href = String(mark.attrs.href)
    })
    return { from, to, href }
  }
  const mark = link.isInSet($from.marks())
  if (!mark) return { from, to, href: '' }
  const start = $from.start()
  let target: LinkTarget = { from, to, href: String(mark.attrs.href) }
  let runFrom = -1
  $from.parent.forEach((child, offset) => {
    const childFrom = start + offset
    const childTo = childFrom + child.nodeSize
    if (!mark.isInSet(child.marks)) {
      runFrom = -1
      return
    }
    if (runFrom < 0) runFrom = childFrom
    if (runFrom <= from && from <= childTo) target = { from: runFrom, to: childTo, href: target.href }
  })
  return target
}

// A plain click (or a tap) on a link opens it in a new tab, the way the
// read view's links open (markdown.tsx), so notes that are always the
// editor still work as notes. Not when the click chose words (a drag ends
// in a click too), extends the selection (Shift) or is Alt's; the address
// goes through linkHref again, so a link that came in with the Markdown
// can't run code (`javascript:`) either: that one stays text to click
// into. Read-only too, where the browser would otherwise follow it in this
// tab. To edit a link's words, put the caret in them from the keyboard or
// drag over them; Ctrl/Cmd+K edits its address.
//
// A page link (`pageLink`) opens its page in this tab instead (`open`:
// the router's, when there is one), and a removed page's link opens
// nothing.
export function followLink(
  view: EditorView,
  event: MouseEvent,
  pages: { resolve: PageLinkResolver | undefined; open: (href: string) => void },
): boolean {
  if (event.button !== 0 || event.shiftKey || event.altKey) return false
  const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
  if (!anchor || !view.dom.contains(anchor)) return false
  if (!view.state.selection.empty) return false
  const written = anchor.getAttribute('href') ?? ''
  const page = pageLinkInfo(pages.resolve, written)
  if (page) {
    event.preventDefault()
    if (page.removed) return false
    const href = linkHref(written)
    if (!href) return false
    pages.open(href)
    return true
  }
  const href = linkHref(written)
  if (!href) return false
  event.preventDefault()
  window.open(href, '_blank', 'noopener,noreferrer')
  return true
}

// Sets (or, with `href` empty, removes) the link on the target. With
// nothing selected and no link there, the address goes in as the link's
// own text.
export function applyLink(view: EditorView, target: LinkTarget, href: string) {
  const link = view.state.schema.marks.link
  const tr = view.state.tr
  if (target.from === target.to) {
    if (!href) return
    tr.insertText(href, target.from).addMark(target.from, target.from + href.length, link.create({ href }))
  } else {
    tr.removeMark(target.from, target.to, link)
    if (href) tr.addMark(target.from, target.to, link.create({ href }))
  }
  view.dispatch(tr.scrollIntoView())
}
