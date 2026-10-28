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
// A long list of rich items (#222) can show each item as one line instead
// (`summary`): the line is a button that opens the item to its fields,
// one item at a time (list-editor-rows.ts), with the row buttons beside
// it. And `onDuplicate` puts a Duplicate button beside Remove, for lists
// whose items repeat with small changes. Without either, every item shows
// its fields, as before.
//
// Editing a list in place on a view (editable-list.tsx) is built on it
// too, so the rows and their buttons match the form's: there, `add` is the
// in-place Add box, and `disabled` holds the buttons while a change saves.
import { useState, type ReactNode } from 'react'
import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon, CopyIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { followOpenItem, isItemOpen } from './list-editor-rows'

export function ListEditor({
  items,
  renderItem,
  summary,
  invalid,
  onAdd,
  onRemove,
  onMove,
  onDuplicate,
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
  /**
   * Shows each item as one line, this text (e.g. "Squat · 3 × 8 at 60 kg"),
   * that opens to its `renderItem` fields on a click, Enter or Space. One
   * item is open at a time; one just added or duplicated opens. For a long
   * list of rich items. Without it, every item shows its fields.
   */
  summary?: (index: number) => ReactNode
  /**
   * With `summary`: the item at this index has an error to show, e.g.
   * (i) => !!errors.steps?.[i]. It opens, beside the open one, until the
   * error clears, so a refused save never hides why. react-hook-form's
   * focus on the first error then makes that item the open one.
   */
  invalid?: (index: number) => boolean
  /** The Add button's action. Not needed with `add`. */
  onAdd?: () => void
  onRemove: (index: number) => void
  onMove: (from: number, to: number) => void
  /**
   * Puts a Duplicate button beside Remove. The app inserts the copy right
   * after the original, e.g. (i) => insert(i + 1, { ...getValues(`steps.${i}`) }),
   * leaving out anything a copy mustn't share (a saved id). With `summary`,
   * the copy opens. Disabled once `max` is reached, as Add is.
   */
  onDuplicate?: (index: number) => void
  /**
   * How the row buttons name an item for a screen reader, e.g.
   * (i) => `item ${i + 1}` gives "Move item 2 up", "Remove item 2".
   * A summary line is named by it too: "item 2: Squat · 3 × 8 at 60 kg".
   */
  itemName: (index: number) => string
  /** The Add button's text, e.g. "Add item". */
  addLabel: string
  /** Shown instead of the list when it's empty. */
  emptyText?: string
  /** The most items allowed; Add and Duplicate are disabled once reached. */
  max?: number
  /** In place of the Add button: what adds an item (editing in place's Add box). */
  add?: ReactNode
  /** The row buttons and Add can't be used (a change is saving). */
  disabled?: boolean
  /** Names the list (e.g. the field's label). */
  'aria-label'?: string
}) {
  const atMax = max !== undefined && items.length >= max

  // The open item, by id. When the ids change (an add, a move, a remove),
  // it follows them here, in the render that shows the change, so a new
  // item's fields are already there when react-hook-form focuses them.
  const ids = items.map((item) => item.id)
  const [open, setOpen] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)
  const [seen, setSeen] = useState(ids)
  if (seen.join('\n') !== ids.join('\n')) {
    setSeen(ids)
    setOpen(followOpenItem({ before: seen, after: ids, open, opening }))
    setOpening(false)
  }

  // An add or a duplicate asks for the item it makes to open. The app's
  // action runs in the same click, so its new id arrives with the ask.
  const addItem = () => {
    setOpening(true)
    onAdd?.()
  }
  const duplicate = (index: number) => {
    setOpening(true)
    onDuplicate?.(index)
  }

  const rowButtons = (index: number, name: string) => (
    <>
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
      {onDuplicate && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Duplicate ${name}`}
          disabled={disabled || atMax}
          onClick={() => duplicate(index)}
        >
          <CopyIcon />
        </Button>
      )}
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
    </>
  )

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 ? (
        <p className="type-caption text-muted-foreground">{emptyText}</p>
      ) : (
        <ul aria-label={ariaLabel} className="flex flex-col gap-2">
          {items.map((item, index) => {
            const name = itemName(index)
            if (!summary) {
              return (
                <li key={item.id} className="flex items-start gap-1">
                  <div className="flex min-w-0 flex-1 items-start gap-2">{renderItem(index)}</div>
                  {rowButtons(index, name)}
                </li>
              )
            }
            // A summary line: the whole line is the button (named by the
            // item's name, then its summary), the row buttons beside it,
            // and the fields under it while it's open. Clicking the line
            // again closes it; an item with an error stays open. Going into
            // an item's fields makes it the open one, so one opened by its
            // error doesn't close under the caret once the error clears.
            return (
              <li key={item.id}>
                <Collapsible
                  open={isItemOpen({ id: item.id, open, invalid: invalid?.(index) ?? false })}
                  onOpenChange={(next) => setOpen((current) => (next ? item.id : current === item.id ? null : current))}
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-start gap-1">
                    <CollapsibleTrigger className="group/summary flex min-h-7 min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1.5 py-1 text-left type-body text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
                      <ChevronRightIcon
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]/summary:rotate-90 motion-reduce:transition-none"
                      />
                      <span className="sr-only">{name}: </span>
                      <span className="min-w-0 flex-1 truncate">{summary(index)}</span>
                    </CollapsibleTrigger>
                    {rowButtons(index, name)}
                  </div>
                  <CollapsibleContent
                    className="flex min-w-0 items-start gap-2 pl-7"
                    onFocus={() => setOpen(item.id)}
                  >
                    {renderItem(index)}
                  </CollapsibleContent>
                </Collapsible>
              </li>
            )
          })}
        </ul>
      )}
      {add ?? (
        <div>
          <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={disabled || atMax}>
            <PlusIcon />
            {addLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
