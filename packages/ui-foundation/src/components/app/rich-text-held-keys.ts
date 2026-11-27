// Keys typed before the editor is up. While its code loads, RichTextEditor
// (with `autoFocus`) puts a textarea beside the loading view that takes
// focus and holds what's typed; once the editor is built it takes that
// text and types it in, and the textarea goes. Typed in the way keys are,
// so `# ` makes a heading and a typed address links, and a newline is
// Enter. Only after the editor has read the text it opened with: typed in
// before, it would count as that text, and never be saved.
//
// A paste is held too: its plain text and HTML are kept, and one mark
// character stands for it in the textarea where it went in (deleting the
// mark drops it). Once the editor is up, each paste goes in where its mark
// is, in order with the keys around it, as a paste: through the editor's
// own paste handling (rich-text-paste.ts), its rules for HTML included.
import type { EditorView } from '@milkdown/kit/prose/view'

/** A paste held until the editor is up: what the clipboard had. */
export type HeldPaste = { text: string; html: string }

/** The textarea's side of the hand-over (rich-text-editor.tsx). */
export type HeldKeys = {
  /** The textarea holding the keys, if it's still there. */
  element: () => HTMLTextAreaElement | null
  /** A composition (an IME, a phone's suggestions) is open in it. */
  composing: () => boolean
  /** The pastes held, in the order they came (`holdPaste`). */
  pastes: () => readonly HeldPaste[]
  /** The editor has the text: the textarea goes. */
  release: () => void
}

// Marks are characters from Unicode's private use area, one per paste.
const FIRST_MARK = 0xe000
const LAST_MARK = 0xf8ff

/**
 * A paste into the held textarea: kept in `pastes`, its mark put in the
 * textarea where the paste would have gone. A paste with neither text
 * nor HTML (files alone) is left alone.
 */
export function holdPaste(area: HTMLTextAreaElement, pastes: HeldPaste[], event: ClipboardEvent) {
  const data = event.clipboardData
  if (!data || FIRST_MARK + pastes.length > LAST_MARK) return
  const text = data.getData('text/plain')
  const html = data.getData('text/html')
  if (!text && !html) return
  event.preventDefault()
  const mark = String.fromCharCode(FIRST_MARK + pastes.length)
  pastes.push({ text, html })
  area.setRangeText(mark, area.selectionStart, area.selectionEnd, 'end')
}

// A held paste going in through the editor's own paste handling, as a
// paste from the keyboard does: a paste event on the editable element,
// carrying the clipboard's text and HTML.
// Where a browser can't build one, ProseMirror's own paste of the HTML or
// the text.
function clipboardEvent(text: string, html: string): ClipboardEvent | null {
  try {
    const data = new DataTransfer()
    if (text) data.setData('text/plain', text)
    if (html) data.setData('text/html', html)
    const event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
    return event.clipboardData ? event : null
  } catch {
    return null
  }
}

function paste(view: EditorView, { text, html }: HeldPaste) {
  const event = clipboardEvent(text, html)
  if (event) view.dom.dispatchEvent(event)
  else if (html) view.pasteHTML(html)
  else view.pasteText(text)
}

/**
 * Types `text` into the view at its caret, as typed: each character as
 * text input, each newline as Enter, and each paste's mark as that paste.
 */
export function replayKeys(view: EditorView, text: string, pastes: readonly HeldPaste[] = []) {
  for (const character of text.replace(/\r\n?/g, '\n')) {
    const held = character.length === 1 ? pastes[character.charCodeAt(0) - FIRST_MARK] : undefined
    if (held) {
      paste(view, held)
      continue
    }
    if (character === '\n') {
      const enter = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true })
      if (!view.someProp('handleKeyDown', (handle) => handle(view, enter))) view.dispatch(view.state.tr.split(view.state.selection.from).scrollIntoView())
      continue
    }
    const { from, to } = view.state.selection
    const typed = () => view.state.tr.insertText(character, from, to)
    if (!view.someProp('handleTextInput', (handle) => handle(view, from, to, character, typed))) view.dispatch(typed().scrollIntoView())
  }
}
