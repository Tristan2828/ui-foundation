// The widget view's quick actions (cell pattern 17): the values the plan
// lets you change straight from the view, each saved on its own the moment
// it changes, without the form. Status (picked in the header), In Stock (a
// switch in the header) and the checklist (items ticked in place). Every
// other value on the view stays read-only.
//
// Each control calls useSaveWidgetField itself, so `isPending` is its own
// save: a spinner shows beside it in a slot that's always there (nothing
// moves), and nothing is disabled, the rest of the page included. A second
// change while one saves waits for it and builds on it. A refusal puts the
// value back and the server's reason shows in a toast.
import { useId } from 'react'
import { Badge } from '@tristan2828/ui-foundation/ui/badge'
import { Checkbox } from '@tristan2828/ui-foundation/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@tristan2828/ui-foundation/ui/select'
import { Spinner } from '@tristan2828/ui-foundation/ui/spinner'
import { Switch } from '@tristan2828/ui-foundation/ui/switch'
import type { components } from '@/api/schema'
import { useSaveWidgetField } from './use-widgets'
import { STATUS_BADGE_VARIANT, checklistDoneCount } from './widget-format'
import { WIDGET_STATUSES } from './widget-schema'

type Widget = components['schemas']['Widget']
type WidgetStatus = components['schemas']['WidgetStatus']

function Saving({ pending }: { pending: boolean }) {
  return (
    <span className="inline-flex size-3.5 shrink-0">
      {pending && <Spinner aria-label="Saving" className="size-3.5 text-muted-foreground" />}
    </span>
  )
}

// Status, in the header where its badge was: the same tone-mapped badge
// (cell pattern 5), now inside a picker. Options in the plan's order.
export function WidgetStatusSelect({ widget }: { widget: Widget }) {
  const save = useSaveWidgetField(widget.id)
  return (
    <span className="inline-flex items-center gap-1.5">
      <Select
        value={widget.status}
        onValueChange={(status) => {
          if (status && status !== widget.status) save.mutate({ status })
        }}
      >
        <SelectTrigger size="sm" aria-label="Status">
          <SelectValue>
            {(status: WidgetStatus) => <Badge variant={STATUS_BADGE_VARIANT[status]}>{status}</Badge>}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {WIDGET_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              <Badge variant={STATUS_BADGE_VARIANT[status]}>{status}</Badge>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Saving pending={save.isPending} />
    </span>
  )
}

// In Stock, in the header: the table row's switch (cell pattern 15) with
// the field's name as its accessible name and the value in words beside
// it, aria-hidden since the switch announces its own state.
export function WidgetInStockSwitch({ widget }: { widget: Widget }) {
  const save = useSaveWidgetField(widget.id)
  return (
    <span className="inline-flex items-center gap-2 type-label">
      <Switch size="sm" checked={widget.inStock} aria-label="In stock" onCheckedChange={(inStock) => save.mutate({ inStock })} />
      <span aria-hidden="true" className={widget.inStock ? 'text-foreground' : 'text-muted-foreground'}>
        {widget.inStock ? 'In stock' : 'Out of stock'}
      </span>
      <Saving pending={save.isPending} />
    </span>
  )
}

// One item: ticking it sends the whole list with this item changed, built
// from the latest list when the request goes out (so two quick ticks both
// land). The label wraps the box, so the text ticks it too; its hidden
// "Done:" prefix makes the box's name say what it changes.
function ChecklistItem({ widget, index }: { widget: Widget; index: number }) {
  const save = useSaveWidgetField(widget.id)
  const item = widget.checklist[index]
  return (
    <li className="flex items-start gap-2">
      <label className="flex min-w-0 items-start gap-2">
        <Checkbox
          className="mt-0.5"
          checked={item.done}
          onCheckedChange={(done) =>
            save.mutate((current) => ({
              checklist: current.checklist.map((other, i) => (i === index ? { ...other, done } : other)),
            }))
          }
        />
        <span className="sr-only">Done: </span>
        <span className={item.done ? 'text-muted-foreground' : undefined}>{item.text}</span>
      </label>
      <span className="mt-0.5 inline-flex">
        <Saving pending={save.isPending} />
      </span>
    </li>
  )
}

// Sub-records ticked in place: the done-count (it follows every tick),
// then each item in order as a checkbox, in one named group.
export function ChecklistItems({ widget }: { widget: Widget }) {
  const countId = useId()
  return (
    <div className="flex flex-col gap-2">
      <p id={countId} className="type-caption tabular-nums text-muted-foreground">
        {checklistDoneCount(widget.checklist)}
      </p>
      <div role="group" aria-label="Checklist items" aria-describedby={countId}>
        <ul className="flex flex-col gap-1.5">
          {widget.checklist.map((_item, index) => (
            <ChecklistItem key={index} widget={widget} index={index} />
          ))}
        </ul>
      </div>
    </div>
  )
}
