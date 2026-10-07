// A table toolbar's less-used filters behind one "Filters" button, so a
// table with many filters still starts near the top of the page (issue
// #93). The primary filters (search, status, whatever most visits use)
// stay in the toolbar; this goes beside them, holding the rest:
//
// - The button says how many of its filters are on ("Filters 2", named
//   "Filters, 2 active"), and opens them in a popover, or a sheet from the
//   bottom on a phone. Base UI gives focus back to the button on close.
// - Each filter that's on shows beside the button as a chip with a remove
//   button, so a filtered list never looks unfiltered while they're
//   hidden; "Clear filters" takes them all off. Both are here too, in the
//   panel's footer.
// - It holds no state of its own: the app passes what's on (`active`, from
//   the URL like every filter, useTableUrlState), so the count and chips
//   follow back/forward and saved views. Collapsing is display only.
// - Esc in a filter's open list closes the list only (Base UI's lists keep
//   their Esc); the next one closes the panel.
import { useState, type ReactNode } from 'react'
import { SlidersHorizontalIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'

/** A filter that's on: its chip's text ("In stock: No") and how to take it off. */
export type ActiveFilter = {
  id: string
  label: string
  onRemove: () => void
}

export type SecondaryFiltersProps = {
  /** The filter controls the button opens, each with its own label. */
  children: ReactNode
  /** The filters among them that are on now, in the order their chips show. */
  active: readonly ActiveFilter[]
  /** Takes every one of them off at once. */
  onClear: () => void
  /** The button's text. */
  label?: string
}

export function SecondaryFilters({ children, active, onClear, label = 'Filters' }: SecondaryFiltersProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const count = active.length

  const trigger = (
    <Button variant="outline" aria-label={count > 0 ? `${label}, ${count} active` : label}>
      <SlidersHorizontalIcon aria-hidden="true" />
      {label}
      {count > 0 && (
        <span aria-hidden="true" className="rounded-full bg-primary px-1.5 type-caption text-primary-foreground tabular-nums">
          {count}
        </span>
      )}
    </Button>
  )

  const footer = (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" size="sm" disabled={count === 0} onClick={onClear}>
        Clear filters
      </Button>
      <Button size="sm" onClick={() => setOpen(false)}>
        Done
      </Button>
    </div>
  )

  return (
    <div data-slot="secondary-filters" className="flex flex-wrap items-center gap-2">
      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={trigger} />
          <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{label}</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-3 px-4 [&>*]:w-full">{children}</div>
            <SheetFooter>{footer}</SheetFooter>
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={trigger} />
          <PopoverContent align="start" className="w-auto min-w-64 gap-3 p-3">
            <PopoverTitle>{label}</PopoverTitle>
            <div className="flex flex-col gap-3">{children}</div>
            {footer}
          </PopoverContent>
        </Popover>
      )}
      {active.map((filter) => (
        <span
          key={filter.id}
          data-slot="secondary-filter-chip"
          className="inline-flex h-7 items-center gap-0.5 rounded-md bg-muted pr-0.5 pl-2 type-caption text-foreground"
        >
          {filter.label}
          <Button variant="ghost" size="icon-xs" aria-label={`Remove filter: ${filter.label}`} onClick={filter.onRemove}>
            <XIcon aria-hidden="true" />
          </Button>
        </span>
      ))}
      {count > 1 && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  )
}
