// The app's toaster (4.90, the dialogs and feedback standard D5).
//
// - Each icon in its tone's `*-text` shade (a green check, a red octagon,
//   an amber triangle, a blue i), through `--toast-icon-*` (styles/
//   index.css: sonner shadows the tokens' own names inside the toaster),
//   which clears 3:1 on the popover surface
//   in every theme and palette, so a success and an error are told apart
//   at a glance. The words stay in the popover's foreground.
// - Top centre from 48rem up, where the eye already is and clear of the
//   bars at the bottom; at the bottom on a phone, in thumb reach, above
//   whatever is pinned there: `--toast-bottom-offset` (EntityForm's stuck
//   bar sets it on <html>) or else AppShell's bottom bar
//   (`--toast-bottom-base`, styles/index.css).
// - Toasts last 4 seconds, Undo too. An error from `notify.failed` stays
//   until it's closed.
//
// What a toast says and when one shows: `notify` (components/app/notify.ts).
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"

// sonner's own gap from the window's edge is 24px (16px on its narrow
// layout); 16px here, plus whatever is pinned to the bottom.
const EDGE = "16px"
const BOTTOM = `calc(var(--toast-bottom-offset, var(--toast-bottom-base, 0px)) + ${EDGE})`

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const phone = useIsMobile()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={phone ? "bottom-center" : "top-center"}
      offset={{ top: EDGE, bottom: BOTTOM, left: EDGE, right: EDGE }}
      mobileOffset={{ top: EDGE, bottom: BOTTOM, left: EDGE, right: EDGE }}
      duration={4000}
      icons={{
        success: (
          <CircleCheckIcon className="size-4 text-(--toast-icon-success)" />
        ),
        info: (
          <InfoIcon className="size-4 text-(--toast-icon-info)" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4 text-(--toast-icon-warning)" />
        ),
        error: (
          <OctagonXIcon className="size-4 text-(--toast-icon-error)" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
