// Keys typed before any editor is on the page: a notes app's New Note
// (the note is made by a request, then its page mounts) or its cold start
// (what's typed before the note's page shows). `holdKeysForNextEditor()`
// puts a hidden textarea at the end of the body and focuses it, so what's
// typed is kept there, an IME's composition included, and isn't delivered
// to the page: Enter doesn't press the button that was just pressed
// again. The next RichTextEditor with `autoFocus` to mount takes it over,
// as it takes its own while its code loads (rich-text-held-keys.ts), and
// types it in once it has read the text it opened with.
//
// It never takes focus from something that takes text (an input, a
// textarea, a select, editable text): called with focus in one, it holds
// nothing. Until an editor takes it over it lets go, dropping what it
// held, when focus moves to any other element (Tab, a field's own
// autoFocus), on a click or tap anywhere else, on Esc, or when `timeout`
// passes; on Esc and the timeout focus goes back where it was. Nothing a
// control would have taken is held. Once an editor has taken it over,
// only that editor lets it go.
import type { HeldKeys } from './rich-text-held-keys'
import { preloadRichTextEditor } from './rich-text-load'

export type HoldKeysOptions = {
  /** How long to wait for an editor, in milliseconds. Default 5000. */
  timeout?: number
}

type Hold = {
  area: HTMLTextAreaElement
  composing: boolean
  before: Element | null
  timeout: number
  stop: (() => void) | undefined
}

// The hold waiting for an editor. One taken over by an editor is that
// editor's, and no longer here.
let waiting: Hold | null = null

const TEXT_INPUT = /^(text|search|email|url|tel|password|number|date|datetime-local|month|week|time)$/

function takesText(element: Element | null) {
  if (!(element instanceof HTMLElement)) return false
  if (element.isContentEditable || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true
  return element instanceof HTMLInputElement && TEXT_INPUT.test(element.type)
}

// Keys that are text (or Enter) stop at the textarea: no listener on the
// page sees them while they're held. Tab, Esc and shortcuts with Ctrl,
// Cmd or Alt go on.
function stopTyped(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (event.key === 'Tab' || event.key === 'Escape') return
  event.stopPropagation()
}

function makeHold(before: Element | null, timeout: number): Hold {
  const area = document.createElement('textarea')
  const hold: Hold = { area, composing: false, before, timeout, stop: undefined }
  area.setAttribute('data-slot', 'rich-text-editor-held')
  area.setAttribute('aria-label', 'Note, opening')
  area.className = 'sr-only'
  for (const type of ['keydown', 'keypress', 'keyup'] as const) area.addEventListener(type, stopTyped)
  area.addEventListener('compositionstart', () => (hold.composing = true))
  area.addEventListener('compositionend', () => (hold.composing = false))
  return hold
}

// Lets go of a waiting hold: what it held is dropped and, asked to, focus
// goes back where it was.
function letGo(hold: Hold, giveFocusBack: boolean) {
  hold.stop?.()
  if (waiting === hold) waiting = null
  if (giveFocusBack && document.activeElement === hold.area) {
    const before = hold.before
    if (before instanceof HTMLElement && before.isConnected && before !== document.body) before.focus({ preventScroll: true })
    else hold.area.blur()
  }
  hold.area.remove()
}

// While waiting: focus or a pointer going anywhere else, Esc, or the
// timeout lets go.
function listen(hold: Hold) {
  const onFocus = (event: FocusEvent) => {
    if (event.target !== hold.area) letGo(hold, false)
  }
  const onPointer = (event: PointerEvent) => {
    if (event.target !== hold.area) letGo(hold, false)
  }
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') letGo(hold, true)
  }
  document.addEventListener('focusin', onFocus, true)
  document.addEventListener('pointerdown', onPointer, true)
  hold.area.addEventListener('keydown', onKey)
  const timer = setTimeout(() => letGo(hold, true), hold.timeout)
  hold.stop = () => {
    document.removeEventListener('focusin', onFocus, true)
    document.removeEventListener('pointerdown', onPointer, true)
    hold.area.removeEventListener('keydown', onKey)
    clearTimeout(timer)
    hold.stop = undefined
  }
}

/**
 * Holds the keys typed from now until the next RichTextEditor with
 * `autoFocus` mounts, which types them in. Call it on the press that
 * leads to an editor (New Note, before its request), or as the app starts
 * when it opens on one. Starts loading the editor's code too. Returns a
 * function that lets go (what was held is dropped), for a press whose
 * editor won't come (the request failed).
 */
export function holdKeysForNextEditor(options: HoldKeysOptions = {}): () => void {
  if (typeof document === 'undefined') return () => {}
  preloadRichTextEditor()
  const timeout = options.timeout ?? 5000
  const focused = document.activeElement
  let hold = waiting
  if (hold) {
    hold.stop?.()
    hold.timeout = timeout
  } else {
    if (takesText(focused)) return () => {}
    hold = makeHold(focused, timeout)
    document.body.append(hold.area)
    waiting = hold
  }
  if (focused !== hold.area && !takesText(focused)) {
    hold.before = focused
    hold.area.focus({ preventScroll: true })
  }
  listen(hold)
  const mine = hold
  return () => {
    if (waiting === mine) letGo(mine, true)
  }
}

/** A hold is waiting for an editor (read as an `autoFocus` editor first renders). */
export function keyHoldWaiting(): boolean {
  return waiting !== null
}

/** The editor's side of a hold it took over. */
export type ClaimedHold = HeldKeys & {
  /** The editor went before it took the keys: the hold waits again. */
  giveBack: () => void
}

/** Takes over the waiting hold, if there is one: from now on it's the editor's to let go. */
export function claimKeyHold(): ClaimedHold | null {
  const hold = waiting
  if (!hold) return null
  hold.stop?.()
  waiting = null
  let done = false
  return {
    element: () => (done ? null : hold.area),
    composing: () => hold.composing,
    release: () => {
      done = true
      hold.area.remove()
    },
    giveBack: () => {
      if (done) return
      done = true
      if (waiting || !hold.area.isConnected) {
        hold.area.remove()
        return
      }
      waiting = hold
      listen(hold)
    },
  }
}
