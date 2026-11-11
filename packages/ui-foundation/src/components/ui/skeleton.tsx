import * as React from "react"
import { cn } from "cn"

// `delay` (4.90, the dialogs and feedback standard D7): nothing shows for
// the first 300ms, so a fast load just appears instead of flashing grey
// shapes; a slow one shows its shape after that. It keeps its room while
// it waits (invisible, not absent), so nothing moves when it shows.
// `delay={0}` shows it at once. DataTable's loading state, made of these,
// waits the same way.
function Skeleton({
  className,
  delay = 300,
  ...props
}: React.ComponentProps<"div"> & {
  /** Milliseconds before it shows. 300 unless set; 0 shows it at once. */
  delay?: number
}) {
  const [shown, setShown] = React.useState(delay <= 0)
  React.useEffect(() => {
    if (delay <= 0) return
    const timer = window.setTimeout(() => setShown(true), delay)
    return () => window.clearTimeout(timer)
  }, [delay])
  const visible = shown || delay <= 0

  return (
    <div
      data-slot="skeleton"
      data-shown={visible || undefined}
      className={cn("animate-pulse rounded-md bg-muted", !visible && "invisible", className)}
      {...props}
    />
  )
}

export { Skeleton }
