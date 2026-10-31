// A hub page's Customize sheet (#263): every card the page has, in the
// person's order, each row with Up and Down buttons and a Show switch,
// and Reset at the foot. It edits a useWidgetLayout, which keeps the
// order (on this device by default) and which the page renders its cards
// by (`layout.visible`).
//
// It's the same on a phone, a desktop and a keyboard: no dragging. Up and
// Down keep the focus on the button pressed, so pressing it again moves
// the card on. At either end the button is `aria-disabled`, not
// `disabled`, so the focus stays on it there too, and a polite live region
// says where the card went ("Saved links, 1 of 3").
//
// The trigger is a Customize button for the page's header; pass `open`
// and `onOpenChange` to open it from elsewhere instead.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDownIcon, ArrowUpIcon, SlidersHorizontalIcon } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import type { WidgetLayout } from '@/hooks/use-widget-layout'

export interface WidgetLayoutSheetProps {
  /** The page's layout, from useWidgetLayout. */
  layout: WidgetLayout
  /** Each card's title by its id: the row's name. An id without one shows as the id. */
  titles: Readonly<Record<string, string>>
  /** The sheet's heading. */
  title?: string
  /** A line under the heading. */
  description?: ReactNode
  /** The trigger button's label. */
  triggerLabel?: string
  /** Opens and closes the sheet from outside (then the trigger can be left out with `trigger={false}`). */
  open?: boolean
  /** Whether the sheet starts open, when `open` isn't given. */
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Show the Customize button; `false` when the app opens the sheet itself. */
  trigger?: boolean
  /** Which side the sheet comes from: the right on a desktop, `bottom` suits a phone. */
  side?: 'right' | 'bottom'
  className?: string
}

export function WidgetLayoutSheet({
  layout,
  titles,
  title = 'Customize this page',
  description = 'Order the cards, and hide the ones you don’t need.',
  triggerLabel = 'Customize',
  open,
  defaultOpen,
  onOpenChange,
  trigger = true,
  side = 'right',
  className,
}: WidgetLayoutSheetProps) {
  const listRef = useRef<HTMLOListElement>(null)
  const [moved, setMoved] = useState<{ id: string; by: -1 | 1 } | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const { order, hidden } = layout
  const nameOf = (id: string) => titles[id] ?? id

  // Moving a row re-orders the list, which can take the focus off the
  // button that moved it: put it back.
  useLayoutEffect(() => {
    if (moved === null) return
    const button = listRef.current?.querySelector<HTMLButtonElement>(
      `[data-widget-id="${CSS.escape(moved.id)}"] [data-move="${moved.by}"]`,
    )
    if (button && document.activeElement !== button) button.focus()
  }, [moved, order])

  const move = (id: string, by: -1 | 1) => {
    const from = order.indexOf(id)
    const to = from + by
    if (from === -1 || to < 0 || to >= order.length) return
    layout.move(id, by)
    setMoved({ id, by })
    setAnnouncement(`${nameOf(id)}, ${to + 1} of ${order.length}`)
  }

  return (
    <Sheet open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange ? (next) => onOpenChange(next) : undefined}>
      {trigger && (
        <SheetTrigger render={<Button variant="outline" size="sm" />}>
          <SlidersHorizontalIcon aria-hidden="true" />
          {triggerLabel}
        </SheetTrigger>
      )}
      <SheetContent side={side} className={cn(side === 'bottom' && 'max-h-[85dvh]', className)}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <ol ref={listRef} data-slot="widget-layout-list" className="flex flex-col divide-y divide-border overflow-y-auto px-4">
          {order.map((id, index) => (
            <WidgetLayoutRow
              key={id}
              id={id}
              name={nameOf(id)}
              shown={!hidden.includes(id)}
              first={index === 0}
              last={index === order.length - 1}
              onMove={(by) => move(id, by)}
              onToggle={() => layout.toggle(id)}
            />
          ))}
        </ol>
        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>
        <SheetFooter>
          <Button
            variant="outline"
            aria-disabled={layout.isDefault || undefined}
            onClick={() => {
              if (layout.isDefault) return
              layout.reset()
              setAnnouncement('Back to the default order')
            }}
            className="aria-disabled:opacity-50"
          >
            Reset
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function WidgetLayoutRow({
  id,
  name,
  shown,
  first,
  last,
  onMove,
  onToggle,
}: {
  id: string
  name: string
  shown: boolean
  first: boolean
  last: boolean
  onMove: (by: -1 | 1) => void
  onToggle: () => void
}) {
  return (
    <li data-widget-id={id} data-hidden={!shown || undefined} className="flex min-h-12 items-center gap-2 py-2">
      <span className={cn('min-w-0 flex-1 truncate type-body', shown ? 'text-foreground' : 'text-muted-foreground')}>
        {name}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        data-move="-1"
        aria-label={`Move ${name} up`}
        aria-disabled={first || undefined}
        onClick={() => onMove(-1)}
        className="aria-disabled:opacity-50"
      >
        <ArrowUpIcon aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        data-move="1"
        aria-label={`Move ${name} down`}
        aria-disabled={last || undefined}
        onClick={() => onMove(1)}
        className="aria-disabled:opacity-50"
      >
        <ArrowDownIcon aria-hidden="true" />
      </Button>
      <Switch aria-label={`Show ${name}`} checked={shown} onCheckedChange={onToggle} className="ml-2" />
    </li>
  )
}
