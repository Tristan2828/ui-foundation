// The fixed toolbar's Table menu: a table inserted where the caret is, or,
// in a table, its rows, columns and alignment (rich-text-table.ts). A menu
// button in the toolbar's row (one of its tab stops' places, moved to with
// the arrow keys like the rest); the menu itself is Base UI's (ARIA's menu
// pattern). Picking an item gives focus back to the text, the caret where
// it was (the editor keeps its selection while the menu has focus); Esc
// gives it back to the button, as a menu button's does.
import { useRef, type KeyboardEvent, type Ref } from 'react'
import type { EditorState } from '@milkdown/kit/prose/state'
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BetweenHorizontalEndIcon,
  BetweenHorizontalStartIcon,
  BetweenVerticalEndIcon,
  BetweenVerticalStartIcon,
  ChevronDownIcon,
  TableIcon,
  Trash2Icon,
  type LucideIcon,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toggleVariants } from '@/components/ui/toggle'
import { tableAt } from './rich-text-formats'
import { columnAlignment, tableActionEnabled, type ColumnAlignment, type TableAction } from './rich-text-table'

type Item = { action: TableAction; label: string; icon: LucideIcon }

const ROWS: Item[] = [
  { action: 'rowAbove', label: 'Insert row above', icon: BetweenHorizontalStartIcon },
  { action: 'rowBelow', label: 'Insert row below', icon: BetweenHorizontalEndIcon },
  { action: 'columnLeft', label: 'Insert column left', icon: BetweenVerticalStartIcon },
  { action: 'columnRight', label: 'Insert column right', icon: BetweenVerticalEndIcon },
]

const ALIGNMENTS: { value: ColumnAlignment; action: TableAction; label: string; icon: LucideIcon }[] = [
  { value: 'left', action: 'alignLeft', label: 'Left', icon: AlignLeftIcon },
  { value: 'center', action: 'alignCenter', label: 'Center', icon: AlignCenterIcon },
  { value: 'right', action: 'alignRight', label: 'Right', icon: AlignRightIcon },
]

const DELETES: Item[] = [
  { action: 'deleteRow', label: 'Delete row', icon: Trash2Icon },
  { action: 'deleteColumn', label: 'Delete column', icon: Trash2Icon },
  { action: 'deleteTable', label: 'Delete table', icon: Trash2Icon },
]

export interface RichTextTableMenuProps {
  state: EditorState | null
  readOnly: boolean
  /** The toolbar's roving tab stop: 0 for the one Tab reaches. */
  tabIndex: number
  onFocus: () => void
  /** The toolbar's arrow keys. */
  onKeyDown: (event: KeyboardEvent) => void
  /** Insert table picked. */
  onInsert: () => void
  /** A row, column or alignment item picked. */
  onAction: (action: TableAction) => void
  /** The editable element, where focus goes once an item is picked. */
  text: () => HTMLElement | null
  ref?: Ref<HTMLButtonElement>
}

export function RichTextTableMenu({
  state,
  readOnly,
  tabIndex,
  onFocus,
  onKeyDown,
  onInsert,
  onAction,
  text,
  ref,
}: RichTextTableMenuProps) {
  const inTable = state ? tableAt(state) !== null : false
  const enabled = (action: TableAction) => (state ? tableActionEnabled(state, action) : false)
  // Whether the menu is closing because an item was picked.
  const picked = useRef(false)
  const run = (action: () => void) => {
    picked.current = true
    action()
  }
  const finalFocus = () => {
    const toText = picked.current
    picked.current = false
    return toText ? (text() ?? true) : true
  }
  const item = ({ action, label, icon: Icon }: Item) => (
    <DropdownMenuItem key={action} disabled={!enabled(action)} onClick={() => run(() => onAction(action))}>
      <Icon aria-hidden="true" />
      {label}
    </DropdownMenuItem>
  )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        ref={ref}
        aria-label="Table"
        disabled={readOnly}
        tabIndex={tabIndex}
        data-active={inTable || undefined}
        // Shaped like the toolbar's toggles: on while the caret is in a table.
        className={toggleVariants({ size: 'sm', className: 'gap-0.5 px-1.5 data-active:bg-muted data-active:text-foreground' })}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
      >
        <TableIcon aria-hidden="true" />
        <ChevronDownIcon aria-hidden="true" className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" finalFocus={finalFocus}>
        <DropdownMenuItem disabled={inTable} onClick={() => run(onInsert)}>
          <TableIcon aria-hidden="true" />
          Insert table
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>{ROWS.map(item)}</DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Align column</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={state && inTable ? columnAlignment(state) : null}
            onValueChange={(value) => {
              const alignment = ALIGNMENTS.find((one) => one.value === value)
              if (alignment) run(() => onAction(alignment.action))
            }}
          >
            {ALIGNMENTS.map(({ value, label, icon: Icon }) => (
              <DropdownMenuRadioItem key={value} value={value} disabled={!inTable} closeOnClick>
                <Icon aria-hidden="true" />
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>{DELETES.map(item)}</DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
