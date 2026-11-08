// Page links in the rich-text editor (src/lib/page-link.ts says what one
// is), drawn as <Markdown> draws them, with decorations only: the document
// and its Markdown never change. A link the app's `pageLink` marks as a
// page gets the page icon (a widget inside the link) and the page-link
// look on its words; a paragraph that holds only one is a page line; a
// removed page is struck through with "Page removed" and, when the app
// can restore it, a Restore button after it. The words shown are the
// link's own, since they're what's saved.
//
// The app's answers can change without the text changing (a page
// renamed, removed, restored): `refreshPageLinks` redraws only when what
// it answers for the links in the text has.
//
// Also here: the span a "/page" (or the floating toolbar's Page) will put
// its link in once the app has made the page, kept in step with any edit
// while the app works (`pendingPagePlugin`).
import type { Mark, Node as ProseNode } from '@milkdown/kit/prose/model'
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view'
import { buttonVariants } from '@/components/ui/button'
import { PAGE_ICON_PATHS, pageLinkSignature, pageName, type PageLinkInfo, type PageLinkResolver } from '@/lib/page-link'

/** One link in the text: its words' span, its mark and its address. */
type LinkRun = { from: number; to: number; mark: Mark; href: string; words: string; parent: ProseNode; parentPos: number }

// Every link in the text, as runs of text under one link mark.
function linkRuns(doc: ProseNode): LinkRun[] {
  const runs: LinkRun[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    let run: LinkRun | null = null
    node.forEach((child, offset) => {
      const start = pos + 1 + offset
      const mark = child.marks.find((candidate) => candidate.type.name === 'link')
      if (mark && run && run.mark.eq(mark) && run.to === start) {
        run.to = start + child.nodeSize
        run.words += child.text ?? ''
        return
      }
      if (run) runs.push(run)
      const href = mark ? String(mark.attrs.href ?? '') : ''
      run = mark && href ? { from: start, to: start + child.nodeSize, mark, href, words: child.text ?? '', parent: node, parentPos: pos } : null
    })
    if (run) runs.push(run)
    return false
  })
  return runs
}

function pageIcon(): HTMLElement {
  const box = document.createElement('span')
  box.setAttribute('aria-hidden', 'true')
  const svgNs = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNs, 'svg')
  for (const [name, value] of Object.entries({
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    class: 'page-link-icon',
  }))
    svg.setAttribute(name, value)
  for (const d of PAGE_ICON_PATHS) {
    const path = document.createElementNS(svgNs, 'path')
    path.setAttribute('d', d)
    svg.appendChild(path)
  }
  box.appendChild(svg)
  return box
}

export type PageLinksOptions = {
  /** The app's `pageLink` now (it may change between renders). */
  resolve: () => PageLinkResolver | undefined
  /** A Restore button pressed: resolves once the app's restore settles. */
  restore: (info: PageLinkInfo, name: string) => Promise<void>
  /** Whether the text can be edited now (no Restore while it can't). */
  editable: () => boolean
}

type PageLinksState = { decorations: DecorationSet; signature: string }

const pageLinksKey = new PluginKey<PageLinksState>('rich-text-page-links')

function draw(doc: ProseNode, options: PageLinksOptions): PageLinksState {
  const resolve = options.resolve()
  if (!resolve) return { decorations: DecorationSet.empty, signature: '' }
  const decorations: Decoration[] = []
  const signature: string[] = []
  for (const run of linkRuns(doc)) {
    const info = resolve(run.href)
    signature.push(`${run.href}:${pageLinkSignature(info)}`)
    if (!info) continue
    const removed = Boolean(info.removed)
    decorations.push(
      // The icon inside the link (its marks), so a click on it is one on the link.
      Decoration.widget(run.from, pageIcon, { side: -1, marks: [run.mark], key: 'page-icon', ignoreSelection: true }),
      Decoration.inline(run.from, run.to, { class: 'page-link-text', 'data-page-link': '', ...(removed ? { 'data-removed': '' } : {}) }),
    )
    if (run.parent.type.name === 'paragraph' && run.from === run.parentPos + 1 && run.to === run.parentPos + 1 + run.parent.content.size)
      decorations.push(Decoration.node(run.parentPos, run.parentPos + run.parent.nodeSize, { class: 'page-line', 'data-page-line': '' }))
    if (removed) {
      const name = pageName(info, run.words)
      const restorable = Boolean(info.onRestore) && options.editable()
      decorations.push(
        Decoration.widget(run.to, () => removedNote(info, name, restorable, options), {
          side: 1,
          key: `page-removed:${restorable}:${name}`,
          ignoreSelection: true,
          // The button's own events: ProseMirror leaves them alone.
          stopEvent: () => true,
        }),
      )
    }
  }
  return { decorations: DecorationSet.create(doc, decorations), signature: signature.join('\n') }
}

// "Page removed", and Restore when the app gives one.
function removedNote(info: PageLinkInfo, name: string, restorable: boolean, options: PageLinksOptions): HTMLElement {
  const box = document.createElement('span')
  box.className = 'page-removed'
  box.dataset.slot = 'page-removed'
  const note = document.createElement('span')
  note.className = 'page-removed-note'
  note.textContent = 'Page removed'
  box.appendChild(note)
  if (!restorable) return box
  const button = document.createElement('button')
  button.type = 'button'
  button.className = buttonVariants({ variant: 'outline', size: 'xs' })
  button.dataset.slot = 'page-restore'
  button.setAttribute('aria-label', `Restore ${name}`)
  button.textContent = 'Restore'
  // A press never moves the caret.
  button.addEventListener('mousedown', (event) => event.preventDefault())
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    button.disabled = true
    button.textContent = 'Restoring…'
    void options.restore(info, name).then(() => {
      button.disabled = false
      button.textContent = 'Restore'
    })
  })
  box.appendChild(button)
  return box
}

/** The plugin: the page links' look, drawn again when the text changes or `refreshPageLinks` asks. */
export function pageLinksPlugin(options: PageLinksOptions): Plugin<PageLinksState> {
  return new Plugin<PageLinksState>({
    key: pageLinksKey,
    state: {
      init: (_config, state) => draw(state.doc, options),
      apply: (tr, value, _previous, next) => (tr.docChanged || tr.getMeta(pageLinksKey) ? draw(next.doc, options) : value),
    },
    props: {
      decorations: (state) => pageLinksKey.getState(state)?.decorations,
    },
  })
}

/**
 * Redraws the page links if what the app answers for them has changed
 * (a title, removed or restored, Restore offered or not, read-only or
 * not). Cheap to call after every render: it dispatches only on a change.
 */
export function refreshPageLinks(view: EditorView, resolve: PageLinkResolver | undefined, editable: boolean): void {
  const current = pageLinksKey.getState(view.state)
  if (!current) return
  const signature = resolve
    ? linkRuns(view.state.doc)
        .map((run) => `${run.href}:${pageLinkSignature(resolve(run.href))}`)
        .join('\n')
    : ''
  const key = `${editable}|${signature}`
  if (key === refreshed.get(view)) return
  refreshed.set(view, key)
  view.dispatch(view.state.tr.setMeta(pageLinksKey, true).setMeta('addToHistory', false))
}
const refreshed = new WeakMap<EditorView, string>()

/** What the app says of the page a link points to, if it's one. */
export function pageLinkInfo(resolve: PageLinkResolver | undefined, href: string): PageLinkInfo | null {
  return resolve?.(href) ?? null
}

// --- The span a page being made will go in --------------------------------

/** Where the new page's link goes: what was typed ("/page") or selected. */
export type PageSpan = { from: number; to: number }

const pendingKey = new PluginKey<PageSpan | null>('rich-text-pending-page')

/** Keeps the span a page being made will replace in step with edits made meanwhile. */
export function pendingPagePlugin(): Plugin<PageSpan | null> {
  return new Plugin<PageSpan | null>({
    key: pendingKey,
    state: {
      init: () => null,
      apply: (tr, value) => {
        const meta = tr.getMeta(pendingKey) as PageSpan | null | undefined
        if (meta !== undefined) return meta
        if (!value) return null
        const from = tr.mapping.map(value.from, 1)
        const to = Math.max(from, tr.mapping.map(value.to, -1))
        return { from, to }
      },
    },
  })
}

/** Marks (or, with null, forgets) the span the page being made will go in. */
export function setPendingPage(tr: Transaction, span: PageSpan | null): Transaction {
  return tr.setMeta(pendingKey, span)
}

/** The span the page being made will go in, if one is. */
export function pendingPage(state: EditorState): PageSpan | null {
  return pendingKey.getState(state) ?? null
}

/**
 * Puts the new page's link in its span: the title as the link's words,
 * linked to `href`, in one transaction (one undo step). The caret goes
 * after it, and what's typed next isn't part of the link. False when
 * there's no span any more.
 */
export function insertPageLink(view: EditorView, title: string, href: string): boolean {
  const span = pendingPage(view.state)
  if (!span || span.to > view.state.doc.content.size) return false
  const { schema } = view.state
  const link = schema.marks.link.create({ href })
  const tr = setPendingPage(view.state.tr.replaceWith(span.from, span.to, schema.text(title, [link])), null)
  tr.setSelection(TextSelection.create(tr.doc, span.from + title.length))
  tr.removeStoredMark(schema.marks.link)
  view.dispatch(tr.scrollIntoView())
  return true
}
