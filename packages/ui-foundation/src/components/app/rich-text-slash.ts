// The slash menu's logic: "/" typed at the start of a line of text opens
// it, what's typed after the "/" filters it, and picking an item turns the
// line into that block, the "/…" gone. The menu itself:
// rich-text-slash-menu.tsx; its keys and ARIA: milkdown-editor.tsx.
//
// Any line of text: a top-level
// one or a heading, a list item's, a quote's or a callout's, a table
// cell's. The menu lists only what can be made there: in a cell, the
// highlights (a cell holds one line), not a heading or a list.
//
// Only a "/" typed there opens it: one already in the text (a path,
// `/usr/bin`) never does, and neither does a "/" mid-line or in a code
// block.
import { Plugin, PluginKey, type EditorState, type Transaction } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { FileTextIcon, ImageIcon } from 'lucide-react'
import { CALLOUT_VARIANTS, FORMAT_GROUPS, HIGHLIGHT_VARIANTS, TOGGLE_HEADING_VARIANTS, type FormatItem } from './rich-text-format-items'
import { toggleFormat, type FormatId } from './rich-text-formats'

/** Where the "/" that opened the menu is, while it's open. */
type SlashState = { from: number } | null

const slashKey = new PluginKey<SlashState>('rich-text-slash')

/** The open menu's span in the text ("/" to the caret) and what's typed after the "/". */
export type SlashQuery = { from: number; to: number; query: string }

// Longer than any item's name: past it, the person is writing, not picking.
const MAX_QUERY = 24

// A line of text's start, but a code block's: where a "/" opens the menu.
function atParagraphStart(state: EditorState, pos: number): boolean {
  const $pos = state.doc.resolve(pos)
  return $pos.parent.isTextblock && !$pos.parent.type.spec.code && $pos.parentOffset === 0
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

/** The transaction that closes the menu, leaving what was typed as text (Esc, or the page's title box opening). */
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
  toggleHeading1: ['toggle', 'fold', 'collapse', 'heading'],
  toggleHeading2: ['toggle', 'fold', 'collapse', 'heading'],
  toggleHeading3: ['toggle', 'fold', 'collapse', 'heading'],
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
  'highlight-amber': ['highlight', 'mark', 'marker', 'colour', 'color'],
  'highlight-yellow': ['highlight', 'mark', 'marker', 'colour', 'color'],
  'highlight-green': ['highlight', 'mark', 'marker', 'colour', 'color'],
  'highlight-red': ['highlight', 'mark', 'marker', 'colour', 'color'],
}

// The menu's items: the blocks, in the toolbar's order, the toggle
// headings after the plain ones (the toolbar's one Toggle heading isn't
// here). The kinds of callout past the default, and the highlights, only
// once something's typed ("/warn"), so the list "/" opens with stays short.
const BLOCKS = FORMAT_GROUPS.flat().filter((item) => KEYWORDS[item.id])
BLOCKS.splice(BLOCKS.findIndex((item) => item.id === 'heading3') + 1, 0, ...TOGGLE_HEADING_VARIANTS)

/**
 * A slash menu item: a block, an image (only with the editor's `upload`)
 * or the new page (only with the app's `onCreatePage`).
 */
export type SlashItem = Omit<FormatItem, 'id'> & { id: FormatId | 'image' | 'page' }

// An image: the file picker, the image going where the "/" was.
// The Image button's job for an editor with no fixed toolbar
// (`toolbar="floating"`), and a quicker way with one.
const IMAGE_ITEM: SlashItem = { id: 'image', label: 'Image', icon: ImageIcon }
const IMAGE_KEYWORDS = ['image', 'picture', 'photo', 'img', 'upload']

// A page of its own, linked from here (src/lib/page-link.ts): last, since
// it's the only item that leaves the editor (a title box, then the app).
const PAGE_ITEM: SlashItem = { id: 'page', label: 'Page', icon: FileTextIcon }
const PAGE_KEYWORDS = ['page', 'subpage', 'child', 'link', 'new']

/** Where the menu is open, for `slashItems` to leave out what can't be made there. */
export type SlashPlace = { state: EditorState; span: SlashQuery }

// Whether picking `id` would do anything where the menu is: its command
// run, with the "/…" gone, and its transaction dropped.
function appliesAt(place: SlashPlace): (id: FormatId) => boolean {
  const state = place.state.apply(place.state.tr.delete(place.span.from, place.span.to))
  return (id) => toggleFormat(state, () => {}, id)
}

/**
 * The blocks matching what's typed after the "/": in the name, or the
 * start of a keyword. With `image`, an image too; with `page`, the new page.
 * With `at`, only the blocks that can be made there.
 */
export function slashItems(query: string, options: { page?: boolean; image?: boolean; at?: SlashPlace } = {}): SlashItem[] {
  const typed = query.trim().toLowerCase()
  const page = options.page && (!typed || 'page'.includes(typed) || PAGE_KEYWORDS.some((word) => word.startsWith(typed))) ? [PAGE_ITEM] : []
  const image = options.image && (!typed || IMAGE_KEYWORDS.some((word) => word.startsWith(typed))) ? [IMAGE_ITEM] : []
  const applies = options.at ? appliesAt(options.at) : () => true
  if (!typed) {
    // Where no block can go (a table cell), the highlights, which can.
    const here = BLOCKS.filter((item) => applies(item.id))
    return [...(here.length ? here : HIGHLIGHT_VARIANTS.filter((item) => applies(item.id))), ...image, ...page]
  }
  const blocks = [...BLOCKS]
  blocks.splice(BLOCKS.findIndex((item) => item.id === 'callout') + 1, 0, ...CALLOUT_VARIANTS)
  blocks.push(...HIGHLIGHT_VARIANTS)
  const matches: SlashItem[] = [
    ...blocks.filter(
      (item) => (item.label.toLowerCase().includes(typed) || KEYWORDS[item.id]!.some((word) => word.startsWith(typed))) && applies(item.id),
    ),
    ...image,
  ]
  // "/page" puts the page first: it's what was asked for by name.
  return typed.length >= 2 && 'page'.startsWith(typed) ? [...page, ...matches] : [...matches, ...page]
}

/** Picks the image item: the "/…" goes and the menu closes, the caret where it was, for the picked images. */
export function clearSlash(view: EditorView, span: SlashQuery): void {
  view.dispatch(view.state.tr.delete(span.from, span.to).setMeta(slashKey, 'close'))
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
    // A highlight picked here is for what is typed next.
    if (done.storedMarks) tr.setStoredMarks(done.storedMarks)
  }
  view.dispatch(tr.scrollIntoView())
}
