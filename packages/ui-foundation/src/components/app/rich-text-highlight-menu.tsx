// The toolbars' Highlight menu: the four colours (amber, yellow, green,
// red) to put on the selected words, or on what is typed next, and "Remove
// highlight". A menu button in the toolbar's row, moved to with the arrow
// keys like the rest; the menu is Base UI's (ARIA's menu pattern), the
// colour on the words its checked item. Picking gives focus back to the
// text, the selection kept. The popup is marked `data-rich-text-menu` so
// the floating toolbar, which this menu also sits in, knows focus in it is
// still the field's (milkdown-editor.tsx).
import { useRef, type KeyboardEvent, type Ref } from 'react'
import type { EditorState } from '@milkdown/kit/prose/state'
import { ChevronDownIcon, HighlighterIcon, RemoveFormattingIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toggleVariants } from '@/components/ui/toggle'
import { HIGHLIGHT_COLORS, type HighlightColor } from '@/lib/markdown-highlight'
import { highlightColor, type FormatId } from './rich-text-formats'

const SWATCH: Record<HighlightColor, string> = {
  amber: 'bg-highlight-amber',
  yellow: 'bg-highlight-yellow',
  green: 'bg-highlight-green',
  red: 'bg-highlight-red',
}

export interface RichTextHighlightMenuProps {
  state: EditorState | null
  readOnly: boolean
  /** The toolbar's roving tab stop: 0 for the one Tab reaches. */
  tabIndex: number
  onFocus: () => void
  /** The toolbar's arrow keys. */
  onKeyDown: (event: KeyboardEvent) => void
  /** A colour, or Remove highlight, picked. */
  onFormat: (id: FormatId) => void
  /** The editable element, where focus goes once an item is picked. */
  text: () => HTMLElement | null
  ref?: Ref<HTMLButtonElement>
}

export function RichTextHighlightMenu({ state, readOnly, tabIndex, onFocus, onKeyDown, onFormat, text, ref }: RichTextHighlightMenuProps) {
  const current = state ? highlightColor(state) : null
  // Whether the menu is closing because an item was picked.
  const picked = useRef(false)
  const run = (id: FormatId) => {
    picked.current = true
    onFormat(id)
  }
  const finalFocus = () => {
    const toText = picked.current
    picked.current = false
    return toText ? (text() ?? true) : true
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        ref={ref}
        aria-label="Highlight"
        disabled={readOnly}
        tabIndex={tabIndex}
        data-active={current !== null || undefined}
        // Shaped like the toolbar's toggles: on while the words are highlighted.
        className={toggleVariants({ size: 'sm', className: 'gap-0.5 px-1.5 data-active:bg-muted data-active:text-foreground' })}
        // A mouse press keeps focus, and the selection, in the text.
        onMouseDown={(event) => event.preventDefault()}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
      >
        <HighlighterIcon aria-hidden="true" />
        <ChevronDownIcon aria-hidden="true" className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-44" data-rich-text-menu="" finalFocus={finalFocus}>
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(value) => {
            if (HIGHLIGHT_COLORS.includes(value as HighlightColor)) run(`highlight-${value as HighlightColor}`)
          }}
        >
          {HIGHLIGHT_COLORS.map((color) => (
            <DropdownMenuRadioItem key={color} value={color} closeOnClick>
              <span aria-hidden="true" className={`size-4 shrink-0 rounded-sm border border-foreground/30 ${SWATCH[color]}`} />
              {color[0].toUpperCase() + color.slice(1)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={current === null} onClick={() => run('highlight-off')}>
          <RemoveFormattingIcon aria-hidden="true" />
          Remove highlight
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
