// What an empty value reads as on a record (form standard 22.2, #F17): a
// dash in the muted text tone, everywhere, with "Not set" as what a screen
// reader says for it. Words given instead ("No budget yet") read as they
// are. EntityView, its strip (KeyStats), EqualItems and the inPlace
// presets' fields all show it, and it's exported (4.96) so an app's own
// strips, summary lines and cells draw the same dash, not one of their own.
import type { ComponentProps } from 'react'
import { EMPTY_DASH } from '@/lib/empty-value'

/** Any other span attribute (`data-state`, `id`) passes through to the span. */
export type EmptyTextProps = Omit<ComponentProps<'span'>, 'children'> & {
  /** What shows: the dash unless set. Words ("No budget yet") read as they are. */
  text?: string
  /** What a screen reader says for the dash: "Not set" unless set ("No reason given"). */
  label?: string
  /** Replaces the muted text tone's class (keep a muted tone: `type-body text-muted-foreground`). */
  className?: string
}

/** The empty text in the muted tone; the dash is read as `label`, "Not set" by default. */
export function EmptyText({ text = EMPTY_DASH, label = 'Not set', className, ...props }: EmptyTextProps) {
  return (
    <span data-slot="empty-value" {...props} className={className ?? 'text-muted-foreground'}>
      {text === EMPTY_DASH ? (
        <>
          <span aria-hidden="true">{EMPTY_DASH}</span>
          <span className="sr-only">{label}</span>
        </>
      ) : (
        text
      )}
    </span>
  )
}
