// A short line under a header button (4.120): what the button has left
// or costs ("12 searches left"), in caption type and the muted tone,
// centred under it on one line. The row it's in lines its buttons up by
// their tops (ListHeader and EntityView do, while one has a hint), so the
// button stays level with the others and the line hangs below. The button
// is described by it, so a screen reader hears the line with its name.
//
// ListHeader's `secondaryAction` takes it as `hint`; a record header's
// `actions` (EntityView) wrap the button: `<ActionHint hint="12 searches
// left"><Button>Search</Button></ActionHint>`.
import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react'
import { cn } from 'cn'

export type ActionHintProps = {
  /** A few words under the button. */
  hint: string
  /** The button (one element): it's given `aria-describedby` for the line. */
  children: ReactNode
  className?: string
}

export function ActionHint({ hint, children, className }: ActionHintProps) {
  const id = useId()
  const button = isValidElement(children)
    ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, {
        'aria-describedby': cn((children as ReactElement<{ 'aria-describedby'?: string }>).props['aria-describedby'], id),
      })
    : children
  return (
    <span data-slot="action-hint" className={cn('inline-flex flex-col items-center gap-0.5', className)}>
      {button}
      <span id={id} data-slot="action-hint-text" className="whitespace-nowrap type-caption text-muted-foreground">
        {hint}
      </span>
    </span>
  )
}
