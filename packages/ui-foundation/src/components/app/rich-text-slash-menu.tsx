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
// over it when the window has no room below.
import { useLayoutEffect, useState } from 'react'
import type { EditorView } from '@milkdown/kit/prose/view'
import { cn } from 'cn'
import type { FormatItem } from './rich-text-format-items'
import type { FormatId } from './rich-text-formats'
import { slashOptionId } from './rich-text-slash'

// Its gap from the caret's line.
const GAP = 4

type Placement = { top: number; left: number; side: 'top' | 'bottom' }

function place(view: EditorView, at: number, field: HTMLElement, menu: HTMLElement): Placement {
  const caret = view.coordsAtPos(at)
  const box = field.getBoundingClientRect()
  const { offsetWidth: width, offsetHeight: height } = menu
  const below = caret.bottom + GAP + height <= window.innerHeight || caret.top - GAP - height < 0
  const top = below ? caret.bottom + GAP : caret.top - GAP - height
  const left = Math.max(0, Math.min(caret.left - box.left, box.width - width))
  return { top: top - box.top, left, side: below ? 'bottom' : 'top' }
}

export interface RichTextSlashMenuProps {
  /** The list's id, for the text's `aria-controls`. */
  id: string
  view: EditorView
  /** The caret: where it's placed. */
  at: number
  /** The field's element it's placed against (positioned: `relative`). */
  field: HTMLElement | null
  items: FormatItem[]
  /** The highlighted item: Enter picks it. */
  active: number
  onHighlight: (index: number) => void
  onPick: (id: FormatId) => void
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
    return () => window.removeEventListener('resize', update)
  }, [view, at, field, menu, items.length])

  // The highlighted item stays in sight.
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
      // Tall enough for every block, but a filtered list can still scroll:
      // focusable for axe (scrollable-region-focusable), never by a press.
      tabIndex={-1}
      onMouseDown={(event) => event.preventDefault()}
      style={placement ? { top: placement.top, left: placement.left } : undefined}
      className={cn(
        'absolute z-50 flex max-h-96 w-56 flex-col gap-0.5 overflow-y-auto rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10',
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
            className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 select-none aria-selected:bg-muted"
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
