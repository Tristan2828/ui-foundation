// Edits a control holds back until they're needed (RichTextEditor, F6 of
// the 2026-11-17 review). Turning a long note back into Markdown that
// keeps every untouched block as written (mergeMarkdown) costs time in
// proportion to the note, so the editor does it a short pause after
// typing stops, not on every key. Anything about to read a control's
// value to save it calls `flushPendingEdits()` first: each editor with
// typing not yet reported reports it, synchronously, through its
// `onChange` (or `onProblem`).
//
// The edit-in-place store does (before each save, commit, refresh and
// when a field leaves), EntityForm does before its submit, and the leave
// guards do before they decide whether leaving loses something.
// `hasPendingEdits()` (with `subscribePendingEdits`) says whether any is
// waiting, for a leave guard that must ask the browser to hold a tab
// open before the pause is over.

type Flush = () => void

const pending = new Set<Flush>()
const listeners = new Set<() => void>()

function changed() {
  for (const listener of listeners) listener()
}

/**
 * A control has typing it hasn't reported yet: `flush` reports it now.
 * Returns the release, called once it has reported (by itself, after its
 * pause, or through `flush`).
 */
export function holdPendingEdit(flush: Flush): () => void {
  pending.add(flush)
  if (pending.size === 1) changed()
  return () => {
    if (pending.delete(flush) && pending.size === 0) changed()
  }
}

/** Every control with typing held back reports it now (before a save reads the value). */
export function flushPendingEdits(): void {
  for (const flush of [...pending]) flush()
}

/** Whether any control holds typing it hasn't reported yet. */
export function hasPendingEdits(): boolean {
  return pending.size > 0
}

/** Called when `hasPendingEdits()` changes (for `useSyncExternalStore`). */
export function subscribePendingEdits(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
