// A web or email address typed into the rich-text editor becomes a link
// as the word ends: on a space (autolinkPlugin) or on Enter (linkWordBefore,
// which the editor's Enter calls before the line splits). Web and email
// addresses only (`https://…`, `www.…`, `name@example.com`), through
// linkHref: `www.` gains https://, an email mailto:. Punctuation that ends
// a sentence after it (`.`, `,`, `)`) stays outside the link. Not in code,
// and not in words already linked. One undo takes the link off, the
// typing kept.
//
// The link's words are the address as typed, so the Markdown saves it as
// an address (`<https://…>` or `[www.x.org](https://www.x.org)`), never
// as escaped text (`https\://`).
import { Plugin, PluginKey, type EditorState, type Transaction } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { addressOf } from './rich-text-paste'

const TRAILING = /[.,;:!?'")\]}]+$/

// The address ending at `pos` in its textblock, and its span; `null` when
// the word before `pos` isn't one, or can't be linked there.
function addressBefore(state: EditorState, pos: number): { from: number; to: number; href: string } | null {
  const $pos = state.doc.resolve(pos)
  const parent = $pos.parent
  if (!parent.isTextblock || parent.type.spec.code) return null
  const link = state.schema.marks.link
  if (!link) return null
  const before = parent.textBetween(0, $pos.parentOffset, undefined, '￼')
  const word = /\S+$/.exec(before)?.[0]
  if (!word) return null
  const trimmed = word.replace(TRAILING, '')
  // An opening bracket before the address stays outside it too.
  const lead = /^[(['"<]+/.exec(trimmed)?.[0] ?? ''
  const address = trimmed.slice(lead.length)
  const href = addressOf(address)
  if (!href) return null
  const from = pos - word.length + lead.length
  const to = from + address.length
  let blocked = false
  state.doc.nodesBetween(from, to, (node) => {
    if (node.isText && node.marks.some((mark) => mark.type === link || mark.type.spec.code)) blocked = true
    if (node.isInline && !node.isText) blocked = true
  })
  return blocked ? null : { from, to, href }
}

function linkAt(tr: Transaction, state: EditorState, span: { from: number; to: number; href: string }) {
  return tr.addMark(span.from, span.to, state.schema.marks.link.create({ href: span.href }))
}

/** Links the address that ends at the caret, if there is one: for Enter, before the line splits. */
export function linkWordBefore(view: EditorView): void {
  const { selection } = view.state
  if (!selection.empty || !view.editable) return
  const span = addressBefore(view.state, selection.from)
  if (span) view.dispatch(linkAt(view.state.tr, view.state, span))
}

const autolinkKey = new PluginKey('rich-text-autolink')

/** A space typed after an address links it. */
export function autolinkPlugin(): Plugin {
  return new Plugin({
    key: autolinkKey,
    props: {
      handleTextInput: (view, from, to, text) => {
        if (text !== ' ' || from !== to || view.composing) return false
        const span = addressBefore(view.state, from)
        if (!span) return false
        // The space first, so it takes the words' marks and not the link's.
        const tr = linkAt(view.state.tr.insertText(text, from, to), view.state, span)
        view.dispatch(tr)
        return true
      },
    },
  })
}
