// The slash menu's logic: "/" typed at the start of a top-level paragraph
// (or one in a callout) opens it, what's typed after the "/" filters it,
// and picking an item turns the paragraph into that block, the "/…" gone.
// The menu itself: rich-text-slash-menu.tsx; its keys and ARIA:
// milkdown-editor.tsx.
//
// Only a "/" typed there opens it: one already in the text (a path,
// `/usr/bin`) never does, and neither does a "/" mid-line or inside a
// list, a quote or a code block.
import { Plugin, PluginKey, type EditorState, type Transaction } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { CALLOUT_VARIANTS, FORMAT_GROUPS, type FormatItem } from './rich-text-format-items'
import { toggleFormat, type FormatId } from './rich-text-formats'

/** Where the "/" that opened the menu is, while it's open. */
type SlashState = { from: number } | null

const slashKey = new PluginKey<SlashState>('rich-text-slash')

/** The open menu's span in the text ("/" to the caret) and what's typed after the "/". */
export type SlashQuery = { from: number; to: number; query: string }

// Longer than any item's name: past it, the person is writing, not picking.
const MAX_QUERY = 24

// A top-level paragraph's start, or one's in a callout (where picking a
// kind of callout changes the callout's): where a "/" opens the menu.
function atParagraphStart(state: EditorState, pos: number): boolean {
  const $pos = state.doc.resolve(pos)
  const placed = $pos.depth === 1 || ($pos.depth === 2 && $pos.node(1).type.name === 'callout')
  return placed && $pos.parent.type.name === 'paragraph' && $pos.parentOffset === 0
}

// The menu's span, if the "/" at `from` still opens it: the caret after it
// in the same paragraph, nothing selected, and what follows the "/" plain
// text that doesn't start with a space.
function queryAt(state: EditorState, from: number): SlashQuery | null {
  const { selection, doc } = state
  if (!selection.empty || from >= doc.content.size || !atParagraphStart(state, from)) return null
  const to = selection.from
  if (to <= from || !doc.resolve(from).sameParent(selection.$from)) return null
  const text = doc.textBetween(from, to, '\n', '\n')
  if (!text.startsWith('/')) return null
  const query = text.slice(1)
  if (query.length > MAX_QUERY || /^\s|\n/.test(query)) return null
  return { from, to, query }
}

/** The open menu's span and query, or null when it's closed. */
export function slashQuery(state: EditorState): SlashQuery | null {
  const open = slashKey.getState(state)
  return open ? queryAt(state, open.from) : null
}

/** The transaction that closes the menu, leaving what was typed as text (Esc). */
export function closeSlash(state: EditorState): Transaction {
  return state.tr.setMeta(slashKey, 'close')
}

/** The id of the menu's item at `index`, for the text's `aria-activedescendant`. */
export function slashOptionId(listId: string, index: number): string {
  return `${listId}-${index}`
}

/** The plugin: opens on a typed "/", follows the text, closes once the span stops qualifying. */
export function slashPlugin(): Plugin<SlashState> {
  return new Plugin<SlashState>({
    key: slashKey,
    state: {
      init: () => null,
      apply: (tr, value, _previous, next) => {
        const meta = tr.getMeta(slashKey) as { from: number } | 'close' | undefined
        if (meta === 'close') return null
        const from = meta ? meta.from : value ? tr.mapping.map(value.from) : null
        // Closed for good once it stops qualifying: the caret coming back
        // later doesn't reopen it.
        return from !== null && queryAt(next, from) ? { from } : null
      },
    },
    props: {
      handleTextInput: (view, from, to, text) => {
        if (text !== '/' || from !== to || !atParagraphStart(view.state, from)) return false
        view.dispatch(view.state.tr.insertText('/', from, to).setMeta(slashKey, { from }))
        return true
      },
    },
  })
}

// What each block answers to besides its name.
const KEYWORDS: Partial<Record<FormatId, string[]>> = {
  heading1: ['h1', 'title', 'heading'],
  heading2: ['h2', 'subheading', 'heading'],
  heading3: ['h3', 'heading'],
  bullets: ['ul', 'unordered', 'bullet'],
  numbers: ['ol', 'ordered', 'number'],
  tasks: ['todo', 'checkbox', 'checklist'],
  quote: ['blockquote'],
  callout: ['note', 'info', 'alert', 'box'],
  'callout-tip': ['callout', 'hint', 'idea', 'alert'],
  'callout-important': ['callout', 'alert'],
  'callout-warning': ['callout', 'alert', 'warn'],
  'callout-caution': ['callout', 'alert', 'danger'],
  codeBlock: ['pre'],
  divider: ['hr', 'rule', 'line', 'separator', '---'],
  table: ['grid', 'columns'],
}

// The menu's items: the blocks, in the toolbar's order. The kinds of
// callout past the default only once something's typed ("/warn"), so
// the list "/" opens with stays short.
const BLOCKS = FORMAT_GROUPS.flat().filter((item) => KEYWORDS[item.id])
const TYPED_ONLY = CALLOUT_VARIANTS

/** The blocks matching what's typed after the "/": in the name, or the start of a keyword. */
export function slashItems(query: string): FormatItem[] {
  const typed = query.trim().toLowerCase()
  if (!typed) return BLOCKS
  const blocks = [...BLOCKS]
  blocks.splice(BLOCKS.findIndex((item) => item.id === 'callout') + 1, 0, ...TYPED_ONLY)
  return blocks.filter(
    (item) => item.label.toLowerCase().includes(typed) || KEYWORDS[item.id]!.some((word) => word.startsWith(typed)),
  )
}

/**
 * Picks an item: the "/…" goes and the paragraph becomes that block, in one
 * transaction (one undo step, which brings the "/…" back).
 */
export function applySlash(view: EditorView, span: SlashQuery, id: FormatId): void {
  const tr = view.state.tr.delete(span.from, span.to).setMeta(slashKey, 'close')
  let formatted: Transaction | null = null
  toggleFormat(view.state.apply(tr), (next) => (formatted = next), id)
  const done = formatted as Transaction | null
  if (done) {
    for (const step of done.steps) tr.step(step)
    tr.setSelection(done.selection.getBookmark().resolve(tr.doc))
  }
  view.dispatch(tr.scrollIntoView())
}
