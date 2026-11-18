// A record's dated history (record standard R7): updates, changes, a
// care log. Dates line up in a tabular column on the left, a dot and a
// thin line between, the entry on the right, so it reads as a history
// instead of a stack of paragraphs. The newest `initial` (5) show, then
// "Show all N": a long history stays short and the entries after it stay
// where they were.
//
// Items are given newest first, as the app sorts them. An entry has its
// date (`date`, already formatted; `dateTime` the machine-readable day
// for the <time>), an optional `kind` ("Visit", "Note") as a muted line
// under the body, the `body` (text, or markup such as <Markdown inline>),
// and `edit`: the entry's own control (an edit button, a menu), at its
// end. Under 24rem of the timeline's own width (a phone, a narrow
// dialog) the date moves above its entry and the column goes.
//
// It owns the empty state: "Nothing yet" (`emptyText`), never a blank.
import { useId, useState, type ReactNode } from 'react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'

export type TimelineItem = {
  /** Unique in the list; a stored id when there is one. */
  id: string
  /** The date as shown ("Nov 2", "Nov 2, 2025"): short, one line. */
  date: string
  /** The date for machines ('2026-11-02'), on the <time> element. */
  dateTime?: string
  /** What sort of entry: "Visit", "Call", "Note". A muted line under the body. */
  kind?: string
  body: ReactNode
  /** The entry's own control, at its end (an edit button, a ⋯ menu). */
  edit?: ReactNode
}

export type TimelineProps = {
  items: readonly TimelineItem[]
  /** How many show before "Show all N". Defaults to 5. */
  initial?: number
  /** The list's name for screen readers ("Changes"). */
  label: string
  /** What an empty timeline says. Defaults to "Nothing yet". */
  emptyText?: string
  className?: string
}

export function Timeline({ items, initial = 5, label, emptyText = 'Nothing yet', className }: TimelineProps) {
  const [all, setAll] = useState(false)
  const listId = useId()
  if (items.length === 0) {
    return (
      <p data-slot="timeline" data-state="empty" className={cn('type-body text-muted-foreground', className)}>
        {emptyText}
      </p>
    )
  }
  const limit = Math.max(1, initial)
  const folds = items.length > limit
  const shown = folds && !all ? items.slice(0, limit) : items
  return (
    <div data-slot="timeline" className={cn('@container flex min-w-0 flex-col gap-2', className)}>
      <ol id={listId} aria-label={label} className="flex flex-col">
        {shown.map((item, index) => (
          <li
            key={item.id}
            data-slot="timeline-item"
            className="grid grid-cols-[5.5rem_1rem_minmax(0,1fr)] gap-x-2 @max-[24rem]:grid-cols-[1rem_minmax(0,1fr)]"
          >
            <div className="col-start-1 row-start-1 pt-px text-right type-caption tabular-nums text-muted-foreground @max-[24rem]:col-start-2 @max-[24rem]:text-left">
              {item.dateTime ? <time dateTime={item.dateTime}>{item.date}</time> : item.date}
            </div>
            <div aria-hidden="true" className="col-start-2 row-start-1 flex flex-col items-center @max-[24rem]:col-start-1 @max-[24rem]:row-span-2">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
              {index < shown.length - 1 && <span className="w-px flex-1 bg-border" />}
            </div>
            <div className="col-start-3 row-start-1 flex min-w-0 items-start gap-2 pb-3 @max-[24rem]:col-start-2 @max-[24rem]:row-start-2">
              <div className="min-w-0 flex-1 type-body text-foreground">
                <div className="break-words">{item.body}</div>
                {item.kind && <div className="type-caption text-muted-foreground">{item.kind}</div>}
              </div>
              {item.edit && <div className="shrink-0">{item.edit}</div>}
            </div>
          </li>
        ))}
      </ol>
      {folds && (
        <Button
          variant="link"
          size="sm"
          aria-expanded={all}
          aria-controls={listId}
          onClick={() => setAll(!all)}
          className="self-start"
        >
          {all ? 'Show Fewer' : `Show All ${items.length}`}
        </Button>
      )}
    </div>
  )
}
