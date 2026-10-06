// The rich-text editor's floating toolbar: the formats for selected words
// (Bold, Italic, Strikethrough, Code · Link), over the selection. The
// fixed toolbar (rich-text-toolbar.tsx) stays; this one saves the trip up
// to it. The editor decides when it shows (milkdown-editor.tsx):
//
// - While words are selected in the text and the field has focus, once
//   the mouse is up (not while a drag is still choosing them). Not in a
//   code block (no formats apply there), read-only, or with the link box
//   open.
// - Above the selection, or below it when there's no room for it inside
//   the text (the first line), so it never covers the fixed toolbar.
// - A mouse press never takes focus from the text, as on the fixed one.
// - Keyboard: Alt+F10 in the text reaches it; the arrow keys, Home and
//   End move along it (one tab stop, as on the fixed one); Esc or Tab goes
//   back to the text, the selection kept. Esc (here or in the text) hides
//   it until the selection changes.
//
// It sits inside the field's own element, placed against it, not in a
// portal: it scrolls with the text, is part of the field for editing in
// place and inside a dialog, and needs none of a popover's focus guards
// (Base UI's Popover adds tabbable `aria-hidden` guards while focus is
// outside it, which for this toolbar is always, and axe fails them).
import { useLayoutEffect, useState, type FocusEvent, type KeyboardEvent, type Ref } from 'react'
import type { EditorState } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { cn } from 'cn'
import type { FormatId } from './rich-text-formats'
import { FormatButtons } from './rich-text-toolbar'

// Its gap from the words.
const GAP = 8

// The selection's box on screen: the words themselves on one line, the
// text's width over several.
function selectionRect(view: EditorView, from: number, to: number): DOMRect {
  const size = view.state.doc.content.size
  const start = view.coordsAtPos(Math.min(from, size), 1)
  const end = view.coordsAtPos(Math.min(to, size), -1)
  const top = Math.min(start.top, end.top)
  const bottom = Math.max(start.bottom, end.bottom)
  if (end.top < start.bottom) return new DOMRect(Math.min(start.left, end.left), top, Math.abs(end.left - start.left), bottom - top)
  const text = view.dom.getBoundingClientRect()
  return new DOMRect(text.left, top, text.width, bottom - top)
}

type Placement = { top: number; left: number; side: 'top' | 'bottom' }

// Where it goes, against `field` (its positioned parent): centred over
// the words, below them when there's no room above inside the text, and
// never past the field's sides.
function place(view: EditorView, from: number, to: number, field: HTMLElement, bar: HTMLElement): Placement {
  const words = selectionRect(view, from, to)
  const box = field.getBoundingClientRect()
  const text = view.dom.getBoundingClientRect()
  const { offsetWidth: width, offsetHeight: height } = bar
  const above = words.top - height - GAP >= text.top
  const top = above ? words.top - height - GAP : words.bottom + GAP
  const centre = words.left + words.width / 2 - width / 2
  const left = Math.max(0, Math.min(centre - box.left, box.width - width))
  return { top: top - box.top, left, side: above ? 'top' : 'bottom' }
}

export interface RichTextFloatingToolbarProps {
  /** The editor, to measure the selection. */
  view: EditorView
  /** The editor's state now: the selection, and which formats are on. */
  state: EditorState
  /** The field's element it's placed against (positioned: `relative`). */
  field: HTMLElement | null
  /** The editable element's id, for `aria-controls`. */
  controls: string
  /** A button pressed: run the format on the editor and give it focus back. */
  onFormat: (id: FormatId) => void
  /** Esc: hide it until the selection changes. */
  onDismiss: () => void
  /** Esc or Tab: focus back to the text. */
  onReturn: () => void
  /** Focus leaving one of its buttons, for the editor to tell whether it left the field. */
  onBlur: (event: FocusEvent) => void
  /** Its element, for Alt+F10 to reach it and for the editor's own blur. */
  ref?: Ref<HTMLDivElement>
}

export function RichTextFloatingToolbar({
  view,
  state,
  field,
  controls,
  onFormat,
  onDismiss,
  onReturn,
  onBlur,
  ref,
}: RichTextFloatingToolbarProps) {
  const [bar, setBar] = useState<HTMLDivElement | null>(null)
  const [placement, setPlacement] = useState<Placement | null>(null)
  const { from, to } = state.selection

  // Placed after each change (a mark makes the words wider), and again
  // when the window's width reflows the text.
  useLayoutEffect(() => {
    if (!bar || !field) return
    const update = () => setPlacement(place(view, from, to, field, bar))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [view, state, from, to, field, bar])

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      // Its own: not the field's (editing in place would give up the edit).
      event.preventDefault()
      event.stopPropagation()
      onDismiss()
      onReturn()
    } else if (event.key === 'Tab') {
      event.preventDefault()
      onReturn()
    }
  }

  return (
    <div
      ref={(element) => {
        setBar(element)
        if (typeof ref === 'function') ref(element)
        else if (ref) ref.current = element
      }}
      role="toolbar"
      aria-label="Format selection"
      aria-controls={controls}
      data-slot="rich-text-floating-toolbar"
      data-side={placement?.side}
      style={placement ? { top: placement.top, left: placement.left } : undefined}
      className={cn(
        'absolute z-50 flex items-center gap-0.5 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10',
        'animate-in fade-in-0 zoom-in-95 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
        // Measured before it's seen, so it never shows in the wrong place.
        !placement && 'invisible',
      )}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      <FormatButtons formats="selection" state={state} readOnly={false} onFormat={onFormat} />
    </div>
  )
}
