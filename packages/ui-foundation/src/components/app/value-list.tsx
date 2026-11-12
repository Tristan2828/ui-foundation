// Several values in one cell (list standard L8): a row's tags, areas or
// icons, kept to `max` (two) on one line, the rest folded into "+N"
// with every value in its tooltip. A column holding values of any count
// stays narrow, instead of one busy row widening it for the rest.
//
// Each value is a chip (a Badge) by default, or the app's own `node` (a
// category icon, a ColorSwatch). Its `label` is the plain text: the
// tooltip lists the folded ones and a screen reader hears them, "2 more:
// Neck, Sleep". The +N is a button so a keyboard (and a tap on a phone,
// which has no hover) reaches the tooltip.
//
// A cell with no values reads "None" to a screen reader and shows a
// muted dash, never a blank.
import type { ReactNode } from 'react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EmptyText } from './empty-value'

export type ValueListItem = {
  /** Plain text: the chip's text, the tooltip's line and the screen reader's. Unique in the list. */
  label: string
  /** The app's own mark for the value (an icon, a swatch), drawn in place of the chip. */
  node?: ReactNode
}

export type ValueListProps = {
  items: readonly ValueListItem[]
  /** How many show before "+N". Defaults to 2. */
  max?: number
  className?: string
}

export function ValueList({ items, max = 2, className }: ValueListProps) {
  if (items.length === 0) {
    return (
      <EmptyText data-slot="value-list" data-state="empty" label="None" className={cn('text-muted-foreground', className)} />
    )
  }
  const shown = items.slice(0, Math.max(0, max))
  const folded = items.slice(shown.length)
  const names = folded.map((item) => item.label).join(', ')
  return (
    <span data-slot="value-list" className={cn('inline-flex items-center gap-1 whitespace-nowrap', className)}>
      {shown.map((item) => (
        <span key={item.label} data-slot="value-list-item" className="inline-flex shrink-0 items-center">
          {item.node ?? <Badge>{item.label}</Badge>}
        </span>
      ))}
      {folded.length > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  data-slot="value-list-more"
                  aria-label={`${folded.length} more: ${names}`}
                  className="rounded-sm px-1 type-caption tabular-nums text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              }
            >
              +{folded.length}
            </TooltipTrigger>
            <TooltipContent>{names}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </span>
  )
}
