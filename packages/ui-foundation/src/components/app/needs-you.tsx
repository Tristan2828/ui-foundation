// What waits on you (overview standard O2): one list at the top of an
// overview, in the warning tone, each line a link to where it's fixed
// ("Balances are three months old", "2 deals at their target"). It
// collects what each part already says about itself, so the page's first
// answer is "what do I do", not a scan of every tile.
//
// Nothing at all when `items` is empty: no heading, no empty box. A
// region named by its heading, so it is in the page's outline and a
// screen reader can jump to it. The wash is the tone at 10% (20% in dark)
// with foreground text and the `*-text` icon, as a Notice draws it; a
// line may take another tone (`destructive` for an overdue one).
import { ChevronRightIcon, CircleAlertIcon, TriangleAlertIcon, type LucideIcon } from 'lucide-react'
import { useId } from 'react'
import { Link, type To } from 'react-router'
import { cn } from 'cn'

export type NeedsYouTone = 'warning' | 'destructive'

export type NeedsYouItem = {
  /** What waits: a short sentence ("1 document is overdue"). The whole line is the link. */
  text: string
  /** Where to fix it. */
  to: To
  /** `warning` (the default), or `destructive` for what's overdue. */
  tone?: NeedsYouTone
}

export type NeedsYouProps = {
  items: readonly NeedsYouItem[]
  /** The heading. Defaults to "Needs you". */
  title?: string
  /** The heading's level: 2 under the page's h1 (the default). */
  headingLevel?: 2 | 3 | 4
  className?: string
}

const LINE: Record<NeedsYouTone, { icon: string; Icon: LucideIcon }> = {
  warning: { icon: 'text-warning-text', Icon: TriangleAlertIcon },
  destructive: { icon: 'text-destructive-text', Icon: CircleAlertIcon },
}

export function NeedsYou({ items, title = 'Needs You', headingLevel = 2, className }: NeedsYouProps) {
  const headingId = useId()
  if (items.length === 0) return null
  const Heading = `h${headingLevel}` as const
  return (
    <section
      aria-labelledby={headingId}
      data-slot="needs-you"
      className={cn(
        'flex flex-col gap-1 rounded-lg border border-warning-text/30 bg-warning/10 px-4 py-3 text-foreground dark:bg-warning/20',
        className,
      )}
    >
      <Heading id={headingId} className="type-label font-semibold text-foreground">
        {title}
      </Heading>
      <ul className="flex flex-col">
        {items.map((item, index) => {
          const { icon, Icon } = LINE[item.tone ?? 'warning']
          return (
            <li key={`${index}-${item.text}`} data-tone={item.tone ?? 'warning'}>
              <Link
                to={item.to}
                className="group/line -mx-1 flex min-h-8 items-center gap-2 rounded-sm px-1 py-1 type-body text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:min-h-11"
              >
                <Icon aria-hidden="true" className={cn('size-4 shrink-0', icon)} />
                <span className="min-w-0 flex-1 underline-offset-4 group-hover/line:underline">{item.text}</span>
                <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
