// A message across the page about the state of what's on it, before
// anything else: a held record ("Hold: read these two first"), an overdue
// one, one that's archived and read-only. Louder than a badge, quieter
// than a toast, and it stays until the state changes. EntityView's
// `notice` is its usual home; any page can render one under its header.
//
// Built on shadcn's Alert. A wash of the tone (the tinted badge's recipe,
// lighter) with `foreground` text on it, so nothing inside needs muted
// text, and the tone's `*-text` shade for the icon, which carries the
// tone's 3:1 on the wash in both themes. Not `role="alert"` (Alert's
// default): a notice there when the page opens is part of the page, not
// an interruption. Where one can appear or change after the page loads,
// render it inside a `role="status"` region that is already there (as
// EntityView does), so the change is announced and the first one isn't.
import type { ReactNode } from 'react'
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon, type LucideIcon } from 'lucide-react'
import { cn } from 'cn'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export type NoticeTone = 'info' | 'success' | 'warning' | 'destructive'

export type NoticeProps = {
  /** What kind of state it is (design-language.md "Semantic tones"). Defaults to `info`. */
  tone?: NoticeTone
  /** A short lead in bold ("On hold"), before the message. */
  title?: ReactNode
  /** The message: one or two sentences saying what to do about it. */
  children: ReactNode
  /** One way to act on it: a link or a small button (`<Button size="sm" variant="outline">`). */
  action?: ReactNode
  /** Another icon than the tone's own, when the state has a better one (a lock for read-only). */
  icon?: LucideIcon
  className?: string
}

const TONE: Record<NoticeTone, { surface: string; icon: string; Icon: LucideIcon }> = {
  info: { surface: 'border-info-text/30 bg-info/10 dark:bg-info/20', icon: 'text-info-text', Icon: InfoIcon },
  success: {
    surface: 'border-success-text/30 bg-success/10 dark:bg-success/20',
    icon: 'text-success-text',
    Icon: CircleCheckIcon,
  },
  warning: {
    surface: 'border-warning-text/30 bg-warning/10 dark:bg-warning/20',
    icon: 'text-warning-text',
    Icon: TriangleAlertIcon,
  },
  destructive: {
    surface: 'border-destructive-text/30 bg-destructive/10 dark:bg-destructive/20',
    icon: 'text-destructive-text',
    Icon: CircleAlertIcon,
  },
}

export function Notice({ tone = 'info', title, children, action, icon, className }: NoticeProps) {
  const look = TONE[tone]
  const Icon = icon ?? look.Icon
  return (
    <Alert
      role={undefined}
      data-slot="notice"
      data-tone={tone}
      // Flex, not Alert's grid, so the action wraps under the message on a
      // narrow screen instead of squeezing it.
      className={cn('flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3 text-foreground', look.surface, className)}
    >
      {/* In a span: Alert paints a direct <svg> child text-current. */}
      <span className={cn('mt-0.5 shrink-0', look.icon)}>
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
        {title && <AlertTitle className="font-semibold">{title}</AlertTitle>}
        <AlertDescription className="text-foreground">{children}</AlertDescription>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">{action}</div>}
    </Alert>
  )
}
