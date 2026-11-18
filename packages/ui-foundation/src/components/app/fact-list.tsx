// Several items in one fact (4.111): a list of linked records, a few tasks,
// whatever a box lists, each item marked so where one ends and the next
// begins is plain even when a long title wraps. Each item leads with its
// kind's icon when the app gives one (the record standard's 4I), or a
// neutral bullet; a wrapped line lines up after the mark (a hanging
// indent), and the items have a little room between them.
//
//   <FactList aria-label="Related">
//     <FactListItem icon={MessageSquareIcon}><Link to="/discussions/3">…</Link></FactListItem>
//     <FactListItem>A plain item</FactListItem>
//   </FactList>
//
// EntityView's `list` fact draws one from its items; an app's own box of
// several things (a record's links, its tasks) uses it directly.
import type { ReactNode } from 'react'
import { cn } from 'cn'
import type { IconComponent } from './icon-component'

export type FactListProps = {
  /** FactListItems. */
  children: ReactNode
  /** The list's name, when nothing beside it (a fact's label) says what it lists. */
  'aria-label'?: string
  className?: string
}

/** A list of items, each marked by its icon or a bullet, wrapped lines indented after the mark. */
export function FactList({ children, className, 'aria-label': ariaLabel }: FactListProps) {
  return (
    <ul data-slot="fact-list" aria-label={ariaLabel} className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {children}
    </ul>
  )
}

export type FactListItemProps = {
  children: ReactNode
  /** The item's kind, drawn before it in the muted colour; a neutral bullet without one. */
  icon?: IconComponent
  className?: string
}

/** One item of a FactList: its mark, then what it holds, wrapping under itself. */
export function FactListItem({ children, icon: Icon, className }: FactListItemProps) {
  return (
    <li data-slot="fact-list-item" className={cn('flex min-w-0 items-start gap-2', className)}>
      {/* As tall as one line of the item's text, so the mark sits on the first line. */}
      <span data-slot="fact-list-mark" aria-hidden="true" className="flex h-[1lh] w-4 shrink-0 items-center justify-center text-muted-foreground">
        {Icon ? <Icon aria-hidden="true" className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" />}
      </span>
      <div className="min-w-0 flex-1 break-words">{children}</div>
    </li>
  )
}
