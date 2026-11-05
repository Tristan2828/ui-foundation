// A table's grips in the rich-text editor, Notion's way: while the pointer
// is over a cell, or the caret is in one, a grip sits on the top edge of
// its column and another on the left edge of its row. Each opens that
// column's or that row's menu: insert, move and delete, the column's
// alignment and sort, the header column, and colours (rich-text-table.ts).
// A right-click in a cell, or Shift+F10 (or the menu key) with the caret
// in one, opens the cell's menu: its colour, then its row's and its
// column's items. The grips are mouse shortcuts, out of the tab order;
// the keyboard has the cell's menu.
//
// Rendered into the table node view's grip layer (rich-text-node-views.ts)
// through a portal. A menu acts on the cell it was opened for, then gives
// focus back to the text with the caret in that cell.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { TextSelection, type EditorState } from '@milkdown/kit/prose/state'
import { selectedRect, TableMap } from '@milkdown/kit/prose/tables'
import type { EditorView } from '@milkdown/kit/prose/view'
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  ArrowDownAZIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ArrowUpZAIcon,
  BetweenHorizontalEndIcon,
  BetweenHorizontalStartIcon,
  BetweenVerticalEndIcon,
  BetweenVerticalStartIcon,
  GripHorizontalIcon,
  GripVerticalIcon,
  PanelLeftIcon,
  Trash2Icon,
  type LucideIcon,
} from 'lucide-react'
import { cn } from 'cn'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { HIGHLIGHT_COLORS, type HighlightColor } from '@/lib/markdown-highlight'
import { tableAt } from './rich-text-formats'
import {
  cellColorAt,
  columnAlignment,
  headerColumnOn,
  tableActionEnabled,
  tableColorEnabled,
  type ColumnAlignment,
  type TableAction,
  type TableColorScope,
} from './rich-text-table'

/** A cell by its row (0 is the header row) and column. */
export type TableCell = { row: number; column: number }

/** The event the editor sends a table's frame to open the caret's cell menu (Shift+F10). */
export const TABLE_MENU_EVENT = 'rich-text-table-menu'

const SWATCH: Record<HighlightColor, string> = {
  amber: 'bg-highlight-amber',
  yellow: 'bg-highlight-yellow',
  green: 'bg-highlight-green',
  red: 'bg-highlight-red',
}

type Item = { action: TableAction; label: string; icon: LucideIcon }

const ROW_ITEMS: Item[] = [
  { action: 'rowAbove', label: 'Insert row above', icon: BetweenHorizontalStartIcon },
  { action: 'rowBelow', label: 'Insert row below', icon: BetweenHorizontalEndIcon },
  { action: 'moveRowUp', label: 'Move row up', icon: ArrowUpIcon },
  { action: 'moveRowDown', label: 'Move row down', icon: ArrowDownIcon },
  { action: 'deleteRow', label: 'Delete row', icon: Trash2Icon },
]

const COLUMN_ITEMS: Item[] = [
  { action: 'columnLeft', label: 'Insert column left', icon: BetweenVerticalStartIcon },
  { action: 'columnRight', label: 'Insert column right', icon: BetweenVerticalEndIcon },
  { action: 'moveColumnLeft', label: 'Move column left', icon: ArrowLeftIcon },
  { action: 'moveColumnRight', label: 'Move column right', icon: ArrowRightIcon },
  { action: 'deleteColumn', label: 'Delete column', icon: Trash2Icon },
]

const SORT_ITEMS: Item[] = [
  { action: 'sortAscending', label: 'Sort ascending', icon: ArrowDownAZIcon },
  { action: 'sortDescending', label: 'Sort descending', icon: ArrowUpZAIcon },
]

const ALIGNMENTS: { value: ColumnAlignment; action: TableAction; label: string; icon: LucideIcon }[] = [
  { value: 'left', action: 'alignLeft', label: 'Left', icon: AlignLeftIcon },
  { value: 'center', action: 'alignCenter', label: 'Center', icon: AlignCenterIcon },
  { value: 'right', action: 'alignRight', label: 'Right', icon: AlignRightIcon },
]

export interface TableGripsProps {
  view: EditorView
  /** The editor's state, so the grips follow each change. */
  state: EditorState | null
  getPos: () => number | undefined
  /** The node view's frame (the grips' layer is positioned in it), its scroll box and its table. */
  frame: HTMLElement
  box: HTMLElement
  table: HTMLTableElement
  readOnly: boolean
  /** Whether focus is in the field: the caret's cell has grips only then. */
  focused: boolean
  /** Runs a table action on a cell (the caret put there first), focus back in the text. */
  onAction: (cell: TableCell, action: TableAction) => void
  /** Colours a cell, its row or its column (null: no colour). */
  onColor: (cell: TableCell, scope: TableColorScope, color: HighlightColor | null) => void
  /** The editable element, where focus goes when a menu closes. */
  text: () => HTMLElement | null
}

type Menu = 'row' | 'column' | 'cell'

// The cell an element is in, if it's one of this table's.
function cellOf(table: HTMLTableElement, target: EventTarget | null): TableCell | null {
  const cell = target instanceof Element ? target.closest('td, th') : null
  if (!(cell instanceof HTMLTableCellElement) || cell.closest('table') !== table) return null
  return { row: (cell.parentElement as HTMLTableRowElement).rowIndex, column: cell.cellIndex }
}

// The state with the caret put in a cell, to ask what applies there.
function stateAt(state: EditorState, tablePos: number, cell: TableCell): EditorState | null {
  const table = state.doc.nodeAt(tablePos)
  if (!table || table.type.name !== 'table') return null
  const map = TableMap.get(table)
  if (cell.row >= map.height || cell.column >= map.width) return null
  const at = tablePos + 1 + map.map[cell.row * map.width + cell.column] + 1
  return state.apply(state.tr.setSelection(TextSelection.near(state.doc.resolve(at))))
}

export function TableGrips({ view, state, getPos, frame, box, table, readOnly, focused, onAction, onColor, text }: TableGripsProps) {
  const [hover, setHover] = useState<TableCell | null>(null)
  const [open, setOpen] = useState<Menu | null>(null)
  const [target, setTarget] = useState<TableCell | null>(null)
  // Bumped when the layout moves without a new state (scroll, resize).
  const [, setLayout] = useState(0)
  const columnGrip = useRef<HTMLButtonElement>(null)
  const rowGrip = useRef<HTMLButtonElement>(null)

  const tablePos = getPos()
  // The caret's cell, when it's in this table.
  let caret: TableCell | null = null
  if (focused && state && tablePos !== undefined && tableAt(state)?.pos === tablePos) {
    const { top, left } = selectedRect(state)
    caret = { row: top, column: left }
  }
  // The caret's cell for the keyboard's menu, read by a listener set up once.
  const caretRef = useRef(caret)
  useLayoutEffect(() => {
    caretRef.current = caret
  })
  const active = open ? target : (hover ?? caret)

  // Pointer over a cell: its grips. Leaving the table, back to the caret's.
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const cell = cellOf(table, event.target)
      if (cell) setHover((now) => (now && now.row === cell.row && now.column === cell.column ? now : cell))
    }
    const onLeave = () => setHover(null)
    const onLayout = () => setLayout((n) => n + 1)
    const onMenu = () => {
      const now = caretRef.current
      if (!now) return
      setTarget(now)
      setOpen('cell')
    }
    const onContext = (event: MouseEvent) => {
      const cell = cellOf(table, event.target)
      if (!cell || !view.editable) return
      event.preventDefault()
      setTarget(cell)
      setOpen('cell')
    }
    frame.addEventListener('pointermove', onMove)
    frame.addEventListener('pointerleave', onLeave)
    frame.addEventListener(TABLE_MENU_EVENT, onMenu)
    frame.addEventListener('contextmenu', onContext)
    box.addEventListener('scroll', onLayout)
    window.addEventListener('resize', onLayout)
    const sizes = new ResizeObserver(onLayout)
    sizes.observe(table)
    return () => {
      frame.removeEventListener('pointermove', onMove)
      frame.removeEventListener('pointerleave', onLeave)
      frame.removeEventListener(TABLE_MENU_EVENT, onMenu)
      frame.removeEventListener('contextmenu', onContext)
      box.removeEventListener('scroll', onLayout)
      window.removeEventListener('resize', onLayout)
      sizes.disconnect()
    }
  }, [frame, box, table, view, caretRef])

  // Where the grips go: the column's on the middle of its top edge (the
  // header cell's), the row's on the middle of its left edge. A column
  // scrolled out of the box has none. Placed on the elements themselves,
  // after each render (the layout is the browser's, not React's).
  useLayoutEffect(() => {
    const columnButton = columnGrip.current
    const rowButton = rowGrip.current
    if (!columnButton || !rowButton) return
    const row = active ? table.rows[active.row] : undefined
    const header = active ? table.rows[0]?.cells[active.column] : undefined
    if (!active || !row || !header) {
      columnButton.hidden = true
      rowButton.hidden = true
      return
    }
    const origin = frame.getBoundingClientRect()
    const scroll = box.getBoundingClientRect()
    const head = header.getBoundingClientRect()
    const line = row.getBoundingClientRect()
    const middle = head.left + head.width / 2
    columnButton.hidden = middle < scroll.left || middle > scroll.right
    columnButton.style.left = `${middle - origin.left}px`
    columnButton.style.top = `${head.top - origin.top}px`
    rowButton.hidden = false
    rowButton.style.left = `${scroll.left - origin.left}px`
    rowButton.style.top = `${line.top - origin.top + line.height / 2}px`
  })

  if (readOnly || tablePos === undefined || !state) return null

  const at = (cell: TableCell | null) => (cell ? stateAt(state, tablePos, cell) : null)
  const menuCell = open ? target : active
  const there = at(menuCell)
  const enabled = (action: TableAction) => (there ? tableActionEnabled(there, action) : false)
  const columnName = (column: number) => table.rows[0]?.cells[column]?.textContent?.trim() || `column ${column + 1}`

  const openMenu = (menu: Menu) => (next: boolean) => {
    if (next) {
      setTarget(active)
      setOpen(menu)
    } else setOpen(null)
  }
  // An item runs once its menu has closed: an action that rebuilds the
  // table (a move, a sort) remakes its node view, grips and menu with it,
  // and focus then goes to the text, not to a menu that's gone.
  const later = (act: () => void) => {
    setOpen(null)
    setTimeout(act)
  }
  const run = (action: TableAction) => {
    const cell = menuCell
    if (cell) later(() => onAction(cell, action))
  }
  const color = (scope: TableColorScope, value: HighlightColor | null) => {
    const cell = menuCell
    if (cell) later(() => onColor(cell, scope, value))
  }

  const items = (list: Item[]) =>
    list.map(({ action, label, icon: Icon }) => (
      <DropdownMenuItem key={action} disabled={!enabled(action)} onClick={() => run(action)}>
        <Icon aria-hidden="true" />
        {label}
      </DropdownMenuItem>
    ))

  const colorGroup = (scope: TableColorScope, label: string): ReactNode => {
    if (!there || !tableColorEnabled(there, scope)) return null
    const current = scope === 'cell' ? cellColorAt(there) : null
    return (
      <DropdownMenuGroup>
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          // A cell says its colour; a row's or a column's cells may differ.
          value={scope === 'cell' ? (current ?? '') : null}
          onValueChange={(value) => color(scope, HIGHLIGHT_COLORS.includes(value as HighlightColor) ? (value as HighlightColor) : null)}
        >
          {HIGHLIGHT_COLORS.map((one) => (
            <DropdownMenuRadioItem key={one} value={one} closeOnClick>
              <span aria-hidden="true" className={cn('size-4 shrink-0 rounded-sm border border-foreground/30', SWATCH[one])} />
              {one[0].toUpperCase() + one.slice(1)}
            </DropdownMenuRadioItem>
          ))}
          <DropdownMenuRadioItem value="" closeOnClick>
            <span aria-hidden="true" className="size-4 shrink-0 rounded-sm border border-foreground/30" />
            No colour
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
    )
  }

  const columnItems = (withColor: boolean, label?: string) => (
    <>
      <DropdownMenuGroup>
        {label && <DropdownMenuLabel>{label}</DropdownMenuLabel>}
        {items(COLUMN_ITEMS)}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Align column</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={there ? columnAlignment(there) : 'left'}
          onValueChange={(value) => {
            const one = ALIGNMENTS.find((alignment) => alignment.value === value)
            if (one) run(one.action)
          }}
        >
          {ALIGNMENTS.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value} closeOnClick>
              <Icon aria-hidden="true" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>{items(SORT_ITEMS)}</DropdownMenuGroup>
      {menuCell?.column === 0 && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={there ? headerColumnOn(there) : false}
            disabled={!enabled('headerColumn')}
            onCheckedChange={() => run('headerColumn')}
            closeOnClick
          >
            <PanelLeftIcon aria-hidden="true" />
            Header column
          </DropdownMenuCheckboxItem>
        </>
      )}
      {withColor && there && tableColorEnabled(there, 'column') && (
        <>
          <DropdownMenuSeparator />
          {colorGroup('column', 'Colour column')}
        </>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => run('deleteTable')}>
        <Trash2Icon aria-hidden="true" />
        Delete table
      </DropdownMenuItem>
    </>
  )

  const rowColor = there && tableColorEnabled(there, 'row')
  const finalFocus = () => text() ?? true
  const grip = 'pointer-events-auto absolute flex items-center justify-center rounded-sm border border-border bg-muted text-muted-foreground shadow-xs outline-none hover:bg-primary hover:text-primary-foreground data-popup-open:bg-primary data-popup-open:text-primary-foreground'

  return (
    <>
      <DropdownMenu open={open === 'column' || open === 'cell'} onOpenChange={openMenu('column')}>
        <DropdownMenuTrigger
          tabIndex={-1}
          aria-label={menuCell ? `Column: ${columnName(menuCell.column)}` : 'Column'}
          ref={columnGrip}
          data-slot="rich-text-table-column-grip"
          className={cn(grip, 'h-3.5 w-6 -translate-x-1/2 -translate-y-1/2')}
        >
          <GripHorizontalIcon aria-hidden="true" className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" data-rich-text-menu="" finalFocus={finalFocus}>
          {open === 'cell' ? (
            <>
              {menuCell && menuCell.row > 0 && (
                <>
                  {colorGroup('cell', 'Cell colour')}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuGroup>
                <DropdownMenuLabel>Row</DropdownMenuLabel>
                {items(ROW_ITEMS)}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {columnItems(false, menuCell ? `Column: ${columnName(menuCell.column)}` : 'Column')}
            </>
          ) : (
            columnItems(true)
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu open={open === 'row'} onOpenChange={openMenu('row')}>
        <DropdownMenuTrigger
          tabIndex={-1}
          aria-label={menuCell ? (menuCell.row === 0 ? 'Header row' : `Row ${menuCell.row}`) : 'Row'}
          ref={rowGrip}
          data-slot="rich-text-table-row-grip"
          className={cn(grip, 'h-6 w-3.5 -translate-x-1/2 -translate-y-1/2')}
        >
          <GripVerticalIcon aria-hidden="true" className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" data-rich-text-menu="" finalFocus={finalFocus}>
          <DropdownMenuGroup>{items(ROW_ITEMS)}</DropdownMenuGroup>
          {rowColor && (
            <>
              <DropdownMenuSeparator />
              {colorGroup('row', 'Colour row')}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
