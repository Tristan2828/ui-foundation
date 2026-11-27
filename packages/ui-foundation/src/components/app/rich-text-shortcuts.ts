// The rich-text editor's own shortcuts, and how a shortcut is named.
// Notion's block keys (rich-text-format-items.ts BLOCK_KEYS): Ctrl+Shift
// and a digit turns the line into a block (0 plain text, 1 to 3 headings,
// 4 tasks, 5 bullets, 6 numbers, 8 a code block), and Cmd+Option and the
// digit does on a Mac, as in Notion (Cmd+Shift+3 to 5 are the Mac's
// screenshots). Mod+Shift+S strikes through, also Notion's, and
// Mod+Shift+H highlights, Notion's too. Each runs the same command
// as its toolbar button, so it toggles the same way.
//
// Read by the key's position (`event.code`), not the character it types:
// Shift+5 types "%", and Option+5 "∞".
//
// And the editing keys Notion, Docs and Obsidian share (each is
// taken here, before Milkdown's own keymap):
// - Backspace at the start of a list item's first line lifts the item out
//   of its list (a nested one up a level), its words kept as a line; a
//   second Backspace joins it to the line above. Milkdown's (joinBackward)
//   would fuse a nested item into the item above as its second paragraph.
// - Tab and Shift+Tab in a list item indent and outdent it, and stay in
//   the text where it can't move (a first item): Tab leaving the editor
//   from one item and not the next would be a surprise. In a code block they
//   indent and outdent its lines by two spaces. On a plain line Tab still
//   leaves the editor, the keyboard's way on to the rest of the page,
//   unless the editor has `tabStaysInText` (milkdown-editor.tsx: Esc, then
//   Tab, moves on).
// - Undo and redo (Mod+Z; Mod+Shift+Z, and Ctrl+Y off Apple) are taken
//   here whether or not there is a step to take: ProseMirror's keymap,
//   finding nothing to redo, would run Shift+Mod+Z's unshifted key, Mod+Z,
//   so a redo pressed once too often would undo a step.
// - Enter after `[!NOTE]` (or `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`,
//   `[!CAUTION]`, any case) alone on a quote's first line makes the quote
//   a callout of that kind, its marker kept as typed, the caret on in it:
//   GitHub's syntax typed as it's written, as `# ` makes a heading
//   (src/lib/markdown-callout.ts). Words after the marker keep it a quote.
import { redo, undo } from '@milkdown/kit/prose/history'
import { liftListItem, sinkListItem } from '@milkdown/kit/prose/schema-list'
import type { EditorState, Transaction } from '@milkdown/kit/prose/state'
import { DEFAULT_HIGHLIGHT } from '@/lib/markdown-highlight'
import { BLOCK_KEYS } from './rich-text-format-items'
import { highlightColor, tableAt, toggleFormat, type FormatId } from './rich-text-formats'

export function isApple(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
}

// Notion's block keys: Cmd+Option on Apple, Ctrl+Shift elsewhere.
function withBlock(keys: string, apple: boolean): string {
  return keys.replace('Block', apple ? 'Mod+Alt' : 'Ctrl+Shift')
}

/** For `aria-keyshortcuts`, which names real keys: Meta on Apple, Control elsewhere. */
export function ariaKeys(keys: string, apple: boolean): string {
  return withBlock(keys, apple)
    .replace('Mod', apple ? 'Meta' : 'Control')
    .replace('Ctrl', 'Control')
}

/** What a person reads: ⌘⌥X on Apple, Ctrl+Alt+X elsewhere. */
export function shownKeys(keys: string, apple: boolean): string {
  const real = withBlock(keys, apple)
  if (!apple) return real.replace('Mod', 'Ctrl')
  const symbols: Record<string, string> = { Mod: '⌘', Alt: '⌥', Shift: '⇧', Enter: '↵' }
  return real
    .split('+')
    .map((part) => symbols[part] ?? part)
    .join('')
}

// The format a key press asks for, or null when it's none of these.
function shortcutFormat(event: KeyboardEvent, apple: boolean): FormatId | null {
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(event.code)?.[1]
  const ctrlShift = event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey
  // Ctrl+Alt on Windows is AltGr, which types characters ({ and [ on a
  // German keyboard), so Cmd+Option counts on Apple only.
  const cmdOption = apple && event.metaKey && event.altKey && !event.shiftKey && !event.ctrlKey
  if (digit && (ctrlShift || cmdOption)) return BLOCK_KEYS[digit] ?? null
  const mod = apple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey
  if (mod && event.shiftKey && !event.altKey && event.code === 'KeyS') return 'strike'
  if (mod && event.shiftKey && !event.altKey && event.code === 'KeyH') return 'highlight'
  return null
}

type Dispatch = (tr: Transaction) => void

// Backspace at the start of a list item's first line: the item lifted out.
function liftAtItemStart(state: EditorState, dispatch: Dispatch): boolean {
  const { $from, empty } = state.selection
  if (!empty || $from.parentOffset > 0 || $from.depth < 2 || !$from.parent.isTextblock) return false
  const item = $from.node(-1)
  if (item.type.name !== 'list_item' || $from.index(-1) !== 0) return false
  return liftListItem(item.type)(state, dispatch)
}

// Two spaces in at the start of each line of a code block the selection
// touches (`out`: up to two, or a tab, taken off). With nothing selected,
// Tab puts them in at the caret.
function indentCode(state: EditorState, dispatch: Dispatch, out: boolean): boolean {
  const { $from, $to, from, to, empty } = state.selection
  if (!$from.sameParent($to)) return false
  if (!out && empty) {
    dispatch(state.tr.insertText('  ').scrollIntoView())
    return true
  }
  const start = $from.start()
  const text = $from.parent.textContent
  const lines: number[] = []
  for (let line = text.lastIndexOf('\n', from - start - 1) + 1; ; ) {
    lines.push(line)
    const next = text.indexOf('\n', line)
    if (next === -1 || next >= to - start) break
    line = next + 1
  }
  const tr = state.tr
  // From the last line up, so the earlier lines' places hold.
  for (const line of lines.reverse()) {
    if (!out) tr.insertText('  ', start + line)
    else {
      const lead = /^(?: {1,2}|\t)/.exec(text.slice(line))?.[0]
      if (lead) tr.delete(start + line, start + line + lead.length)
    }
  }
  dispatch(tr.scrollIntoView())
  return true
}

// Tab (Shift+Tab) in a list item or a code block; false anywhere else,
// where Tab is the browser's (a table's is its own, rich-text-table.ts).
function handleTab(state: EditorState, dispatch: Dispatch, out: boolean): boolean {
  const { $from } = state.selection
  if ($from.parent.type.spec.code) return indentCode(state, dispatch, out)
  if (tableAt(state)) return false
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (node.type.name !== 'list_item') continue
    const move = out ? liftListItem(node.type) : sinkListItem(node.type)
    move(state, dispatch)
    return true
  }
  return false
}

// Undo or redo for a key press, or null when it's neither.
function historyKey(event: KeyboardEvent, apple: boolean): 'undo' | 'redo' | null {
  const mod = apple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey
  if (!mod || event.altKey) return null
  if (event.code === 'KeyZ') return event.shiftKey ? 'redo' : 'undo'
  return !apple && !event.shiftKey && event.code === 'KeyY' ? 'redo' : null
}

/** The editing keys: Backspace at a list item's start, Tab and Shift+Tab, undo and redo. True when the key was taken. */
export function handleEditingKey(state: EditorState, dispatch: Dispatch, event: KeyboardEvent): boolean {
  if (event.isComposing) return false
  const step = historyKey(event, isApple())
  if (step) {
    ;(step === 'undo' ? undo : redo)(state, dispatch)
    return true
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return false
  if (event.key === 'Backspace' && !event.shiftKey) return liftAtItemStart(state, dispatch)
  if (event.key === 'Tab') return handleTab(state, dispatch, event.shiftKey)
  if (event.key === 'Enter' && !event.shiftKey) return calloutFromMarker(state, dispatch)
  return false
}

const TYPED_CALLOUT = /^\[!(note|tip|important|warning|caution)\][ \t]*$/i

// A quote whose first line is a callout's marker, the caret at its end:
// made the callout, the marker's line emptied for the caret.
function calloutFromMarker(state: EditorState, dispatch: Dispatch): boolean {
  const { selection, schema } = state
  const callout = schema.nodes.callout
  const { $from } = selection
  if (!callout || !selection.empty || $from.depth < 2) return false
  const line = $from.parent
  if (line.type.name !== 'paragraph' || $from.parentOffset !== line.content.size) return false
  if (line.childCount !== 1 || !line.firstChild!.isText || line.firstChild!.marks.length > 0) return false
  const found = TYPED_CALLOUT.exec(line.textContent)
  if (!found || $from.node(-1).type.name !== 'blockquote' || $from.index(-1) !== 0) return false
  const tr = state.tr.delete($from.start(), $from.end())
  tr.setNodeMarkup($from.before(-1), callout, { kind: found[1].toLowerCase(), marker: found[0].trim() })
  dispatch(tr.scrollIntoView())
  return true
}

/**
 * Runs the shortcut a key press is, if it's one of these. True when it
 * was (whether or not the format could apply where the caret is: the key
 * is taken either way, so the browser's own never runs).
 */
export function handleShortcut(state: EditorState, dispatch: Dispatch, event: KeyboardEvent): boolean {
  if (handleEditingKey(state, dispatch, event)) {
    event.preventDefault()
    return true
  }
  const format = shortcutFormat(event, isApple())
  if (!format) return false
  // Highlight: the default colour on, or any colour off.
  if (format === 'highlight') toggleFormat(state, dispatch, highlightColor(state) ? 'highlight-off' : `highlight-${DEFAULT_HIGHLIGHT}`)
  else toggleFormat(state, dispatch, format)
  return true
}
