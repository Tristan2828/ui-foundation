// A full-screen view for a timed screen (a paced timer, a step-by-step
// player, anything followed from across the room): the whole viewport over
// the app shell, inside the phone's safe-area insets. It's a modal dialog,
// so focus stays in it and Esc closes it through onOpenChange, and it's
// named by its title. It fades in, never zooms.
//
// Optional: a "Full screen" control that also asks the browser for real
// fullscreen and quietly isn't there where the browser can't (iOS Safari
// on a phone), and keepAwake, which holds a screen wake lock while open.
// `dark` renders the view in the dark theme whatever the app's (the dark
// stage, #253): the dark tokens are scoped to the view, so the page under
// it keeps its own. SessionStage, below, is the stage under the header.
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
  /** Render the view with the dark theme's tokens, whatever the app's theme. */
  dark?: boolean
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
  dark = false,
  className,
}: SessionViewProps) {
  useWakeLock(open && keepAwake)
  const fullscreen = useDocumentFullscreen(open)

  return (
    <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogPortal>
        <DialogPrimitive.Popup
          data-slot="session-view"
          data-look={dark ? 'dark' : undefined}
          initialFocus={initialFocus}
          className={cn(
            'fixed inset-0 z-50 flex flex-col bg-background text-foreground outline-none',
            // theme.css's .dark block remaps the tokens for this subtree only.
            dark && 'dark scheme-dark',
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

export type SessionStageTone = 'neutral' | 'success' | 'info' | 'warning' | 'destructive'

// Each tone's solid fill (the glow) and its text shade (the lit time).
// Neutral glows with the foreground, faintly, and lights in it.
const STAGE_TONES: Record<SessionStageTone, { solid: string; text: string; wash: string }> = {
  neutral: { solid: 'var(--foreground)', text: 'var(--foreground)', wash: '8%' },
  success: { solid: 'var(--success)', text: 'var(--success-text)', wash: '24%' },
  info: { solid: 'var(--info)', text: 'var(--info-text)', wash: '24%' },
  warning: { solid: 'var(--warning)', text: 'var(--warning-text)', wash: '26%' },
  destructive: { solid: 'var(--destructive)', text: 'var(--destructive-text)', wash: '24%' },
}

export type SessionStageProps = React.ComponentProps<'div'> & {
  /** The phase's tone: what the glow and `sessionStageLit` take. */
  tone?: SessionStageTone
  /** A soft wash of the tone behind the centre of the stage. */
  glow?: boolean
}

// The stage: the area a timed screen draws its run in, filling the view
// below the header. It sets --stage-tone (the tone's solid) and
// --stage-tone-text (its text shade) for what's inside, and with `glow` a
// radial wash of the tone on the page colour, fading out to the edges. Made
// for a dark SessionView, where the wash reads as light; on a light page it
// is a faint tint.
export function SessionStage({ tone = 'neutral', glow = false, className, style, ...props }: SessionStageProps) {
  const t = STAGE_TONES[tone]
  return (
    <div
      data-slot="session-stage"
      data-tone={tone}
      data-glow={glow || undefined}
      className={cn(
        'relative flex min-h-0 flex-1 flex-col',
        glow &&
          'bg-[radial-gradient(ellipse_70%_60%_at_50%_52%,color-mix(in_oklab,var(--stage-tone)_var(--stage-wash),var(--background))_0,var(--background)_75%)]',
        className,
      )}
      style={
        { '--stage-tone': t.solid, '--stage-tone-text': t.text, '--stage-wash': t.wash, ...style } as React.CSSProperties
      }
      {...props}
    />
  )
}

/** The big time on a stage: the tone's text shade, with a glow of the tone around the figures. */
export const sessionStageLit =
  'text-[var(--stage-tone-text)] [text-shadow:0_0_0.3em_color-mix(in_oklab,var(--stage-tone)_55%,transparent)]'

/** A quiet outline control on a stage: no fill, a faint border, dimmed text that brightens on hover. */
export const sessionStageQuiet =
  'border-foreground/25 bg-transparent text-muted-foreground shadow-none hover:border-foreground hover:bg-transparent hover:text-foreground dark:border-foreground/25 dark:bg-transparent dark:hover:border-foreground dark:hover:bg-transparent'

/** The main control on a stage (Start, Done): an outline too, in the foreground colour. */
export const sessionStageMain =
  'border-foreground bg-transparent text-foreground shadow-none hover:bg-foreground/10 hover:text-foreground dark:border-foreground dark:bg-transparent dark:hover:bg-foreground/10'
