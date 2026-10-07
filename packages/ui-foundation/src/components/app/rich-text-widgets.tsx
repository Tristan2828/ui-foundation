// The React parts of the editor's node views (rich-text-node-views.ts),
// rendered into their slots through portals:
//
// - A callout's icon is a menu of its kinds (and Remove callout). From the
//   keyboard, "/" at the start of a line in the callout lists the kinds
//   too (rich-text-slash.ts), so the icon is a mouse shortcut and out of
//   the tab order.
// - A table's bars add a column at its right and a row at its end, shown
//   while the pointer is over the table or the caret is in it. Mouse
//   shortcuts as well: Tab in the last cell adds a row, and the toolbar's
//   Table menu does both.
//
// Each gives focus back to the text when it's done.
import { PlusIcon } from 'lucide-react'
import { cn } from 'cn'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CALLOUT_KINDS, type CalloutKind } from '@/lib/markdown-callout'
import { CALLOUT_LOOK } from './prose-look'

export interface CalloutKindMenuProps {
  kind: CalloutKind
  readOnly: boolean
  onPick: (kind: CalloutKind) => void
  onRemove: () => void
  /** The editable element, where focus goes when the menu closes. */
  text: () => HTMLElement | null
}

export function CalloutKindMenu({ kind, readOnly, onPick, onRemove, text }: CalloutKindMenuProps) {
  const look = CALLOUT_LOOK[kind]
  const Icon = look.icon
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        tabIndex={-1}
        disabled={readOnly}
        aria-label={`${look.label} callout: change its kind`}
        data-slot="rich-text-callout-kind"
        className="flex size-5 items-center justify-center rounded-md outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none"
      >
        <Icon aria-hidden="true" className={cn('size-4', look.tint)} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-44" finalFocus={() => text() ?? true}>
        <DropdownMenuRadioGroup value={kind} onValueChange={(value) => onPick(value as CalloutKind)}>
          {CALLOUT_KINDS.map((one) => {
            const OneIcon = CALLOUT_LOOK[one].icon
            return (
              <DropdownMenuRadioItem key={one} value={one} closeOnClick>
                <OneIcon aria-hidden="true" className={CALLOUT_LOOK[one].tint} />
                {CALLOUT_LOOK[one].label}
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onRemove}>Remove callout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export interface TableBarProps {
  /** Under the table (a row) or along its right (a column). */
  side: 'row' | 'column'
  /** The caret is in this table: shown without the pointer over it. */
  active: boolean
  readOnly: boolean
  onAdd: () => void
}

export function TableBar({ side, active, readOnly, onAdd }: TableBarProps) {
  if (readOnly) return null
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={side === 'row' ? 'Add a row' : 'Add a column'}
      data-slot={`rich-text-table-add-${side}`}
      className={cn(
        'flex flex-1 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground',
        'opacity-0 group-hover/table:opacity-100',
        active && 'opacity-100',
      )}
      // A press keeps focus in the text: the caret moves into the new cell.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onAdd}
    >
      <PlusIcon aria-hidden="true" className="size-3.5" />
    </button>
  )
}
