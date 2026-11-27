// Keys typed before the editor is up. While its code loads, RichTextEditor
// (with `autoFocus`) puts a textarea beside the loading view that takes
// focus and holds what's typed; once the editor is built it takes that
// text and types it in, and the textarea goes. Typed in the way keys are,
// so `# ` makes a heading and a typed address links, and a newline is
// Enter. Only after the editor has read the text it opened with: typed in
// before, it would count as that text, and never be saved.
import type { EditorView } from '@milkdown/kit/prose/view'

/** The textarea's side of the hand-over (rich-text-editor.tsx). */
export type HeldKeys = {
  /** The textarea holding the keys, if it's still there. */
  element: () => HTMLTextAreaElement | null
  /** A composition (an IME, a phone's suggestions) is open in it. */
  composing: () => boolean
  /** The editor has the text: the textarea goes. */
  release: () => void
}

/** Types `text` into the view at its caret, as typed: each character as text input, each newline as Enter. */
export function replayKeys(view: EditorView, text: string) {
  for (const character of text.replace(/\r\n?/g, '\n')) {
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
