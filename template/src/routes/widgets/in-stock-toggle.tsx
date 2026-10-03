// The In Stock cell: a yes/no you flip straight from the table row, saved
// on its own (useToggleWidgetInStockMutation). Its own file and component
// so the columns stay stable (category-names.tsx says why) and the hook
// lives in a component, not a column definition.
//
// A Switch, not a checkbox: it acts at once, like a light switch. The word
// stays beside it (cell pattern 12) so the value reads in greyscale and at
// a glance; it's aria-hidden because the switch already announces its
// state. The accessible name says which row ("In stock: Wireless Mouse").
import { toast } from 'sonner'
import { Switch } from '@tristan2828/ui-foundation/ui/switch'
import type { components } from '@/api/schema'
import { useToggleWidgetInStockMutation } from './use-widgets'

type Widget = components['schemas']['Widget']

export function InStockToggle({ widget }: { widget: Widget }) {
  const toggle = useToggleWidgetInStockMutation()

  return (
    <span className="inline-flex items-center gap-2">
      <Switch
        size="sm"
        checked={widget.inStock}
        aria-label={`In stock: ${widget.name}`}
        disabled={toggle.isPending}
        onCheckedChange={(inStock) =>
          toggle.mutate(
            { id: widget.id, inStock },
            { onError: (error) => toast.error(`Couldn't update ${widget.name}: ${error.message}`) },
          )
        }
      />
      <span aria-hidden="true" className={widget.inStock ? undefined : 'text-muted-foreground'}>
        {widget.inStock ? 'Yes' : 'No'}
      </span>
    </span>
  )
}
