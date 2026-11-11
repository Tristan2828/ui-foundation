// "You're offline" across the top of the app (4.90, the dialogs and
// feedback standard D9), while the server can't be reached: the browser
// says it's offline, or a request got no answer at all. Gone as soon as
// the browser is back online or any request gets an answer. AppShell
// draws it above every page; an app without the shell can render it
// itself. One bar instead of each save failing on its own: a save made
// meanwhile still shows its own error beside it.
//
// A warning-tone band (the Notice's wash, edge to edge), in a live region
// that's always there, so the bar is announced when it appears.
import { WifiOffIcon } from 'lucide-react'
import { cn } from 'cn'
import { useOffline } from '@/lib/connection'

export type OfflineNoticeProps = {
  /** Show it whatever the connection: for a fixture or a test. */
  offline?: boolean
  className?: string
}

export function OfflineNotice({ offline: forced, className }: OfflineNoticeProps) {
  const detected = useOffline()
  const offline = forced ?? detected
  return (
    <div role="status" data-slot="offline-notice" className="empty:hidden">
      {offline && (
        <div
          data-state="offline"
          className={cn(
            'flex items-center justify-center gap-2 border-b border-warning-text/30 bg-warning/10 px-4 py-1.5 text-center type-body text-foreground dark:bg-warning/20',
            className,
          )}
        >
          <WifiOffIcon aria-hidden="true" className="size-4 shrink-0 text-warning-text" />
          <span>You’re offline. Changes won’t save until you’re back.</span>
        </div>
      )}
    </div>
  )
}
