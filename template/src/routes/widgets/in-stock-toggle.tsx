// The In Stock cell: a yes/no you flip straight from the table row, saved
// on its own (useSaveWidgetField: optimistic, rolled back with a toast if
// the save fails). Its own file and component so the columns stay stable
// (category-names.tsx says why) and the hook lives in a component, not a
// column definition.
//
// A Switch, not a checkbox: it acts at once, like a light switch. The word
// stays beside it (cell pattern 12) so the value reads in greyscale and at
// a glance; it's aria-hidden because the switch already announces its
// state. The accessible name says which row ("In stock: Wireless Mouse").
// While it saves, a spinner shows in a slot that's always there, so the
// cell never changes width; the switch stays usable (a second flip waits
// for the first and builds on it).
import { Spinner } from '@tristan2828/ui-foundation/ui/spinner'
import { Switch } from '@tristan2828/ui-foundation/ui/switch'
import type { components } from '@/api/schema'
import { useSaveWidgetField } from './use-widgets'

type Widget = components['schemas']['Widget']

export function InStockToggle({ widget }: { widget: Widget }) {
  const save = useSaveWidgetField(widget.id)

  return (
    <span className="inline-flex items-center gap-2">
      <Switch
        size="sm"
        checked={widget.inStock}
        aria-label={`In stock: ${widget.name}`}
        onCheckedChange={(inStock) => save.mutate({ inStock })}
      />
      <span aria-hidden="true" className={widget.inStock ? undefined : 'text-muted-foreground'}>
        {widget.inStock ? 'Yes' : 'No'}
      </span>
      <span className="inline-flex size-3.5 shrink-0">
        {save.isPending && <Spinner aria-label="Saving" className="size-3.5 text-muted-foreground" />}
      </span>
    </span>
  )
}
