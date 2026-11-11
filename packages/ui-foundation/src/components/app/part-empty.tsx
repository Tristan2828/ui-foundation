// A part with nothing in it yet (overview standard O5): the card stays,
// with "Nothing here yet" and one way to start ("Add the first line"), as
// an empty list does. The foundation's Empty at card size: no big
// illustration, a dashed border, the message and one outline button.
//
// `WidgetCard`'s `empty` prop draws this in its body in place of the
// plain `emptyMessage` line; an overview part uses the same component for
// its own `empty`. The button is a link (`to`) or a plain button
// (`onClick`).
import { Link, type To } from 'react-router'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader } from '@/components/ui/empty'

export type PartEmptyAction = { label: string; to: To; onClick?: never } | { label: string; onClick: () => void; to?: never }

export type PartEmptyState = {
  /** What it says. Defaults to "Nothing here yet". */
  text?: string
  /** The one way to start: a link to where the first one is added, or a button that opens it. */
  action?: PartEmptyAction
}

export type PartEmptyProps = PartEmptyState & { className?: string }

export function PartEmpty({ text = 'Nothing here yet', action, className }: PartEmptyProps) {
  return (
    <Empty data-slot="part-empty" data-state="empty" className={cn('gap-3 border p-4', className)}>
      <EmptyHeader>
        <EmptyDescription>{text}</EmptyDescription>
      </EmptyHeader>
      {action && (
        <EmptyContent>
          {action.to !== undefined ? (
            <Button size="sm" variant="outline" nativeButton={false} render={<Link to={action.to} />}>
              {action.label}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </EmptyContent>
      )}
    </Empty>
  )
}
