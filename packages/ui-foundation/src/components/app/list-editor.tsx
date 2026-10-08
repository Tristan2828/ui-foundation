// Edits a list of sub-records inside a parent's form: one row per item,
// each with move up / move down / remove, and an Add button below. The one
// control for every "sub-records" section of an entity plan
// (conventions/docs/entity-plan-template.md): Widget's checklist, a task's
// checklist and links.
//
// It owns the row chrome only. Each item's fields are the app's (rendered
// by `renderItem`), and so is the state: pass react-hook-form's
// useFieldArray `fields`, `append`, `remove` and `move`, so the items save
// with the parent's form and their errors bind like any other field.
//
// Editing a list in place on a view (editable-list.tsx) is built on it
// too, so the rows and their buttons match the form's: there, `add` is the
// in-place Add box, and `disabled` holds the buttons while a change saves.
import type { ReactNode } from 'react'
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ListEditor({
  items,
  renderItem,
  onAdd,
  onRemove,
  onMove,
  itemName,
  addLabel,
  emptyText = 'Nothing added yet.',
  max,
  add,
  disabled = false,
  'aria-label': ariaLabel,
}: {
  /** One entry per item, with a stable key (useFieldArray's `fields`). */
  items: readonly { id: string }[]
  /** The item's own fields, for the item at this index. */
  renderItem: (index: number) => ReactNode
  /** The Add button's action. Not needed with `add`. */
  onAdd?: () => void
  onRemove: (index: number) => void
  onMove: (from: number, to: number) => void
  /**
   * How the row buttons name an item for a screen reader, e.g.
   * (i) => `item ${i + 1}` gives "Move item 2 up", "Remove item 2".
   */
  itemName: (index: number) => string
  /** The Add button's text, e.g. "Add item". */
  addLabel: string
  /** Shown instead of the list when it's empty. */
  emptyText?: string
  /** The most items allowed; Add is disabled once reached. */
  max?: number
  /** In place of the Add button: what adds an item (editing in place's Add box). */
  add?: ReactNode
  /** The row buttons and Add can't be used (a change is saving). */
  disabled?: boolean
  /** Names the list (e.g. the field's label). */
  'aria-label'?: string
}) {
  const atMax = max !== undefined && items.length >= max

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 ? (
        <p className="type-caption text-muted-foreground">{emptyText}</p>
      ) : (
        <ul aria-label={ariaLabel} className="flex flex-col gap-2">
          {items.map((item, index) => {
            const name = itemName(index)
            return (
              <li key={item.id} className="flex items-start gap-1">
                <div className="flex min-w-0 flex-1 items-start gap-2">{renderItem(index)}</div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${name} up`}
                  disabled={disabled || index === 0}
                  onClick={() => onMove(index, index - 1)}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${name} down`}
                  disabled={disabled || index === items.length - 1}
                  onClick={() => onMove(index, index + 1)}
                >
                  <ArrowDownIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${name}`}
                  disabled={disabled}
                  onClick={() => onRemove(index)}
                >
                  <Trash2Icon />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      {add ?? (
        <div>
          <Button type="button" variant="outline" size="sm" onClick={onAdd} disabled={disabled || atMax}>
            <PlusIcon />
            {addLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
