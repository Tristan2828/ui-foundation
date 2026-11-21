// The rich-text editor's slash menu: the blocks a paragraph can become
// (Heading to Code block), listed under the caret after a "/" typed at a
// line's start (rich-text-slash.ts). ARIA's combobox pattern with the
// text as the input: focus never leaves the text. The text names this
// list (`aria-controls`) and the highlighted item
// (`aria-activedescendant`); the arrow keys move the highlight, Enter or
// Tab picks, Esc closes it and leaves what was typed (milkdown-editor.tsx).
//
// Placed against the field's element like the floating toolbar, not in a
// portal (rich-text-floating-toolbar.tsx says why): under the caret, or
// over it when there's more room there, and never taller than what is
// visible on its side (above a phone's keyboard). Visible
// means inside whatever clips the field too: a card's `overflow-hidden`
// would cut a menu opened on a note's last line down to its first item.
import { useLayoutEffect, useState } from 'react'
import type { EditorView } from '@milkdown/kit/prose/view'
import { cn } from 'cn'
import { slashOptionId, type SlashItem } from './rich-text-slash'

const GAP = 4

type Placement = { top: number; left: number; side: 'top' | 'bottom'; maxHeight: number }

// Its tallest: every block shows on a laptop.
const TALLEST = 512
// Below the caret while at least this much of it fits there.
const ENOUGH = 170

// What is visible of the window: above a phone's keyboard
// (`visualViewport`), above the bar pinned to it
// (rich-text-keyboard-bar.tsx) when the field has one, and
// inside every element around the field that clips what overflows it (a
// card, a dialog's scrolling body).
function visibleArea(field: HTMLElement): { top: number; bottom: number } {
  const viewport = window.visualViewport
  let top = viewport?.offsetTop ?? 0
  let bottom = top + (viewport?.height ?? window.innerHeight)
  const bar = field.querySelector('[data-slot="rich-text-keyboard-bar"] [role="toolbar"]')
  if (bar) bottom = Math.min(bottom, bar.getBoundingClientRect().top)
  for (let element: HTMLElement | null = field; element && element !== document.body; element = element.parentElement) {
    if (getComputedStyle(element).overflowY === 'visible') continue
    const box = element.getBoundingClientRect()
    top = Math.max(top, box.top)
    bottom = Math.min(bottom, box.bottom)
  }
  return { top, bottom }
}

// Under the caret, or over it; on a touch screen never taller than the
// room on its side, so it never runs under the keyboard.
function place(view: EditorView, at: number, field: HTMLElement, menu: HTMLElement): Placement {
  const caret = view.coordsAtPos(at)
  const box = field.getBoundingClientRect()
  const area = visibleArea(field)
  const { offsetWidth: width } = menu
  const natural = Math.min(menu.scrollHeight, TALLEST)
  const roomBelow = area.bottom - caret.bottom - GAP * 2
  const roomAbove = caret.top - area.top - GAP * 2
  // A laptop's: below when it all fits there, else above when it fits
  // there, else wherever there's more room. A touch screen's: below while
  // a few items fit, else wherever there's more room. Either way capped to
  // the room on its side, so it scrolls rather than being cut off.
  const touch = window.matchMedia('(pointer: coarse)').matches
  const below = touch
    ? roomBelow >= Math.min(natural, ENOUGH) || roomBelow >= roomAbove
    : natural <= roomBelow || (natural > roomAbove && roomBelow >= roomAbove)
  const maxHeight = Math.max(80, Math.min(TALLEST, below ? roomBelow : roomAbove))
  const height = Math.min(natural, maxHeight)
  const top = below ? caret.bottom + GAP : caret.top - GAP - height
  const left = Math.max(0, Math.min(caret.left - box.left, box.width - width))
  return { top: top - box.top, left, side: below ? 'bottom' : 'top', maxHeight }
}

export interface RichTextSlashMenuProps {
  /** The list's id, for the text's `aria-controls`. */
  id: string
  view: EditorView
  /** The caret: where it's placed. */
  at: number
  /** The field's element it's placed against (positioned: `relative`). */
  field: HTMLElement | null
  items: SlashItem[]
  /** The highlighted item: Enter picks it. */
  active: number
  onHighlight: (index: number) => void
  onPick: (id: SlashItem['id']) => void
}

export function RichTextSlashMenu({ id, view, at, field, items, active, onHighlight, onPick }: RichTextSlashMenuProps) {
  const [menu, setMenu] = useState<HTMLDivElement | null>(null)
  const [placement, setPlacement] = useState<Placement | null>(null)

  // Placed as the caret moves and the list narrows, and again when the
  // window's size changes.
  useLayoutEffect(() => {
    if (!menu || !field) return
    const update = () => setPlacement(place(view, at, field, menu))
    update()
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [view, at, field, menu, items.length])

  useLayoutEffect(() => {
    menu?.querySelector(`#${CSS.escape(slashOptionId(id, active))}`)?.scrollIntoView({ block: 'nearest' })
  }, [menu, id, active])

  return (
    <div
      ref={setMenu}
      id={id}
      role="listbox"
      aria-label="Blocks"
      data-slot="rich-text-slash-menu"
      data-side={placement?.side}
      // It can scroll (capped above a phone's keyboard, or in a short
      // window): a tab stop for axe (scrollable-region-focusable), never
      // reached while it's open (Tab picks), nor by a press.
      tabIndex={0}
      onMouseDown={(event) => event.preventDefault()}
      style={placement ? { top: placement.top, left: placement.left, maxHeight: placement.maxHeight } : undefined}
      className={cn(
        'absolute z-50 flex max-h-128 w-56 flex-col gap-0.5 overflow-y-auto rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10',
        'animate-in fade-in-0 zoom-in-95 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
        // Measured before it's seen, so it never shows in the wrong place.
        !placement && 'invisible',
      )}
    >
      {items.map((item, index) => {
        const Icon = item.icon
        return (
          <div
            key={item.id}
            id={slashOptionId(id, index)}
            role="option"
            aria-selected={index === active}
            // 44px rows on a touch screen.
            className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 select-none aria-selected:bg-muted pointer-coarse:min-h-11"
            // A press never takes focus from the text.
            onMouseDown={(event) => event.preventDefault()}
            onMouseMove={() => index !== active && onHighlight(index)}
            onClick={() => onPick(item.id)}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            {item.label}
          </div>
        )
      })}
    </div>
  )
}
