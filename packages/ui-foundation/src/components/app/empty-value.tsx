// What an empty value reads as on a record (form standard 22.2, #F17): a
// dash in the muted text tone, everywhere, with "Not set" as what a screen
// reader says for it. Words given instead ("No budget yet") read as they
// are. EntityView, its strip (KeyStats) and the inPlace presets' fields all
// show it.
import { EMPTY_DASH } from '@/lib/empty-value'

/** The empty text in the muted tone; the dash is read as "Not set". */
export function EmptyText({ text = EMPTY_DASH, className }: { text?: string; className?: string }) {
  return (
    <span data-slot="empty-value" className={className ?? 'text-muted-foreground'}>
      {text === EMPTY_DASH ? (
        <>
          <span aria-hidden="true">{EMPTY_DASH}</span>
          <span className="sr-only">Not set</span>
        </>
      ) : (
        text
      )}
    </span>
  )
}
