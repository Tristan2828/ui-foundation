// The widget view's quick actions (cell pattern 17): the values the plan
// lets you change straight from the view, each saved on its own the moment
// it changes, without the form. In Stock (a switch in the header) and the
// checklist (items ticked in place). Status, Name, Price, Description and
// Extra Categories edit in place instead (cell pattern 18, widget-view.tsx),
// and so do the checklist's items themselves (their text, adding, moving,
// removing): ticking is a quick action within that list.
//
// Each control calls useSaveWidgetField itself, so `isPending` is its own
// save: a spinner shows beside it in a slot that's always there (nothing
// moves), and nothing is disabled, the rest of the page included. A second
// change while one saves waits for it and builds on it. A refusal puts the
// value back and the server's reason shows in a toast.
import { Checkbox } from '@tristan2828/ui-foundation/ui/checkbox'
import { Spinner } from '@tristan2828/ui-foundation/ui/spinner'
import { Switch } from '@tristan2828/ui-foundation/ui/switch'
import type { components } from '@/api/schema'
import { useSaveWidgetField } from './use-widgets'
import { checklistDoneCount } from './widget-format'

type Widget = components['schemas']['Widget']

function Saving({ pending }: { pending: boolean }) {
  return (
    <span className="inline-flex size-3.5 shrink-0">
      {pending && <Spinner aria-label="Saving" className="size-3.5 text-muted-foreground" />}
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

// One item as the view shows it: ticking its box sends the whole list with
// this item changed, built from the latest list when the request goes out
// (so two quick ticks both land). The box is named for what it changes
// ("Done: Pair the receiver"). The text beside it isn't part of the box:
// clicking it edits the item in place (widget-view.tsx).
export function ChecklistItem({ widget, index }: { widget: Widget; index: number }) {
  const save = useSaveWidgetField(widget.id)
  const item = widget.checklist[index]
  return (
    <span className="flex items-start gap-2">
      <Checkbox
        className="mt-0.5"
        checked={item.done}
        aria-label={`Done: ${item.text}`}
        onCheckedChange={(done) =>
          save.mutate((current) => ({
            checklist: current.checklist.map((other, i) => (i === index ? { ...other, done } : other)),
          }))
        }
      />
      <span className={item.done ? 'text-muted-foreground' : undefined}>{item.text}</span>
      <span className="mt-0.5 inline-flex">
        <Saving pending={save.isPending} />
      </span>
    </span>
  )
}

// Above the items: the done-count, which follows every tick.
export function ChecklistDoneCount({ widget }: { widget: Widget }) {
  return <p className="type-caption tabular-nums text-muted-foreground">{checklistDoneCount(widget.checklist)}</p>
}
