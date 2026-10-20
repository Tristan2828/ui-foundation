// A full-screen view for a timed screen (a paced timer, a step-by-step
// player, anything followed from across the room): the whole viewport over
// the app shell, inside the phone's safe-area insets. It's a modal dialog,
// so focus stays in it and Esc closes it through onOpenChange, and it's
// named by its title. It fades in, never zooms.
//
// Optional: a "Full screen" control that also asks the browser for real
// fullscreen and quietly isn't there where the browser can't (iOS Safari
// on a phone), and keepAwake, which holds a screen wake lock while open.
// Recipes for its states in Playwright: docs/foundation/timed-screens.md.
import * as React from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Maximize2Icon, Minimize2Icon, XIcon } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogPortal, DialogTitle } from '@/components/ui/dialog'
import { useWakeLock } from '@/hooks/use-wake-lock'

export type SessionViewProps = {
  open: boolean
  /** Called with false on Esc and on the Close button. */
  onOpenChange: (open: boolean) => void
  /** Names the view for screen readers, and heads it on screen. */
  title: React.ReactNode
  children: React.ReactNode
  /** Hold a screen wake lock while the view is open (useWakeLock). */
  keepAwake?: boolean
  /** Show a "Full screen" control that asks the browser for real fullscreen too. */
  fullscreenControl?: boolean
  /** What takes focus on open (default: the first focusable control, which is the header's). */
  initialFocus?: DialogPrimitive.Popup.Props['initialFocus']
  /** On the area below the header, which holds `children`. */
  className?: string
}

export function SessionView({
  open,
  onOpenChange,
  title,
  children,
  keepAwake = false,
  fullscreenControl = false,
  initialFocus,
  className,
}: SessionViewProps) {
  useWakeLock(open && keepAwake)
  const fullscreen = useDocumentFullscreen(open)

  return (
    <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogPortal>
        <DialogPrimitive.Popup
          data-slot="session-view"
          initialFocus={initialFocus}
          className={cn(
            'fixed inset-0 z-50 flex flex-col bg-background text-foreground outline-none',
            // The insets are 0 unless the page's viewport meta has viewport-fit=cover.
            'pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]',
            'duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
          )}
        >
          <header className="flex items-center gap-1 px-4 py-2">
            <DialogTitle className="min-w-0 flex-1 truncate type-section-title">{title}</DialogTitle>
            {fullscreenControl && fullscreen.supported && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Full screen"
                aria-pressed={fullscreen.active}
                onClick={fullscreen.toggle}
              >
                {fullscreen.active ? <Minimize2Icon /> : <Maximize2Icon />}
              </Button>
            )}
            <DialogClose render={<Button variant="ghost" size="icon" aria-label="Close" />}>
              <XIcon />
            </DialogClose>
          </header>
          <div className={cn('flex min-h-0 flex-1 flex-col overflow-auto px-4 pb-4', className)}>{children}</div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}

// The whole page in the browser's fullscreen (not the view's own element:
// popups inside the view portal to <body>, and would vanish outside a
// fullscreen element). Followed through `fullscreenchange`, since the
// browser's own Esc leaves it too. Left when the view closes, if the view
// was what entered it.
function useDocumentFullscreen(open: boolean) {
  const [supported] = React.useState(
    () => typeof document !== 'undefined' && document.fullscreenEnabled === true && !!document.documentElement.requestFullscreen,
  )
  const [active, setActive] = React.useState(false)
  const entered = React.useRef(false)

  React.useEffect(() => {
    if (!supported) return
    const onChange = () => {
      const now = document.fullscreenElement !== null
      setActive(now)
      if (!now) entered.current = false
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [supported])

  React.useEffect(() => {
    if (open || !entered.current) return
    entered.current = false
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }, [open])

  React.useEffect(
    () => () => {
      if (entered.current && document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    },
    [],
  )

  const toggle = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
      return
    }
    // Refused (no gesture, a policy, an iframe without allowfullscreen):
    // the view stays as it is, already covering the page.
    document.documentElement.requestFullscreen().then(
      () => (entered.current = true),
      () => {},
    )
  }

  return { supported, active, toggle }
}
