// The rich-text editor's own shortcuts, and how a shortcut is named.
// Notion's block keys (rich-text-format-items.ts BLOCK_KEYS): Ctrl+Shift
// and a digit turns the line into a block (0 plain text, 1 to 3 headings,
// 4 tasks, 5 bullets, 6 numbers, 8 a code block), and Cmd+Option and the
// digit does on a Mac, as in Notion (Cmd+Shift+3 to 5 are the Mac's
// screenshots). Mod+Shift+S strikes through, also Notion's. Each runs the
// same command as its toolbar button, so it toggles the same way.
//
// Read by the key's position (`event.code`), not the character it types:
// Shift+5 types "%", and Option+5 "∞".
import type { EditorState, Transaction } from '@milkdown/kit/prose/state'
import { BLOCK_KEYS } from './rich-text-format-items'
import { toggleFormat, type FormatId } from './rich-text-formats'

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
  return null
}

/**
 * Runs the shortcut a key press is, if it's one of these. True when it
 * was (whether or not the format could apply where the caret is: the key
 * is taken either way, so the browser's own never runs).
 */
export function handleShortcut(state: EditorState, dispatch: (tr: Transaction) => void, event: KeyboardEvent): boolean {
  const format = shortcutFormat(event, isApple())
  if (!format) return false
  toggleFormat(state, dispatch, format)
  return true
}
