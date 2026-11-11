import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

// The foundation's additions to shadcn's dialog (4.80):
//
// - `size` on DialogContent: `confirm` (420px), `form` (640px) and
//   `record` (1,120px), the three widths every dialog uses. Under 48rem a
//   confirm is a sheet from the bottom with full-width buttons, the action
//   above Cancel, and a form is the whole screen. Left out, the dialog is
//   shadcn's own (384px), as before.
// - `dirty` on DialogContent: while it's true, Esc, the close button, a
//   click outside and any DialogClose ask "Discard your changes?"
//   (DiscardChangesDialog) before the dialog closes. Closing it from code
//   (`open={false}` after a save) never asks.
//
// The guard lives in Dialog, the Root: DialogContent tells it whether
// what's inside is dirty, and its onOpenChange stops a close and asks
// first. Discard closes through the Root's own `close()` action, so a
// controlled dialog still hears onOpenChange(false) and an uncontrolled
// one closes itself.

type DialogGuard = { setDirty: (dirty: boolean) => void }

const DialogGuardContext = React.createContext<DialogGuard | null>(null)

const IMPERATIVE: DialogPrimitive.Root.ChangeEventReason = "imperative-action"

function Dialog({
  onOpenChange,
  actionsRef: actionsRefProp,
  children,
  ...props
}: DialogPrimitive.Root.Props) {
  const ownActions = React.useRef<DialogPrimitive.Root.Actions | null>(null)
  const actionsRef = actionsRefProp ?? ownActions
  const dirty = React.useRef(false)
  const [asking, setAsking] = React.useState(false)
  const guard = React.useMemo<DialogGuard>(
    () => ({
      setDirty: (next) => {
        dirty.current = next
      },
    }),
    []
  )
  const discard = () => {
    setAsking(false)
    dirty.current = false
    actionsRef.current?.close()
  }
  const ask = (
    <DiscardChangesDialog
      open={asking}
      onKeepEditing={() => setAsking(false)}
      onDiscard={discard}
    />
  )
  return (
    <DialogGuardContext.Provider value={guard}>
      <DialogPrimitive.Root
        data-slot="dialog"
        actionsRef={actionsRef}
        onOpenChange={(open, details) => {
          if (!open && dirty.current && details.reason !== IMPERATIVE) {
            details.cancel()
            setAsking(true)
            return
          }
          onOpenChange?.(open, details)
        }}
        {...props}
      >
        {typeof children === "function" ? (
          (payload) => (
            <>
              {children(payload)}
              {ask}
            </>
          )
        ) : (
          <>
            {children}
            {ask}
          </>
        )}
      </DialogPrimitive.Root>
    </DialogGuardContext.Provider>
  )
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/20 duration-100 supports-backdrop-filter:backdrop-blur-sm dark:bg-black/40 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * The dialog's width: `confirm` 420px (a question with two buttons; a
 * bottom sheet on a phone), `form` 640px (a small form; the whole screen
 * on a phone), `record` 1,120px (a record over its list, as wide as its
 * page). Left out, shadcn's 384px.
 */
type DialogSize = "confirm" | "form" | "record"

// Written phone first, the laptop's look from `md:` (48rem), so nothing
// in the base classes' `sm:` (40rem) leaks into a phone's layout between
// the two. cn() drops each base class these replace.
const DIALOG_SIZE: Record<DialogSize, string> = {
  // A phone: a sheet across the bottom, its footer's buttons full width
  // and 40px, stacked with the action (the footer's last child) on top,
  // clear of the home indicator.
  confirm: cn(
    "top-auto bottom-0 left-0 max-w-none translate-x-0 translate-y-0 rounded-t-2xl rounded-b-none sm:max-w-none data-open:slide-in-from-bottom-8 data-closed:slide-out-to-bottom-8",
    "max-md:[&_[data-slot=dialog-footer]]:flex-col-reverse max-md:[&_[data-slot=dialog-footer]]:pb-[calc(1rem+env(safe-area-inset-bottom))] max-md:[&_[data-slot=dialog-footer]>*]:h-10 max-md:[&_[data-slot=dialog-footer]>*]:w-full",
    "md:top-1/2 md:bottom-auto md:left-1/2 md:max-w-[26.25rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:data-open:slide-in-from-bottom-0 md:data-closed:slide-out-to-bottom-0"
  ),
  // A column whose children decide what scrolls (FormDialog's body). A
  // phone: the whole screen.
  form: cn(
    "inset-0 flex h-dvh max-h-none max-w-none translate-x-0 translate-y-0 flex-col rounded-none ring-0 sm:max-w-none",
    "md:inset-auto md:top-1/2 md:left-1/2 md:h-auto md:max-h-[calc(100dvh-2rem)] md:max-w-[40rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:ring-1"
  ),
  // A phone keeps the 1rem margin round it, the rail under the main column.
  record: "flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-[70rem]",
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  size,
  dirty = false,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  /** One of the three widths (see DialogSize). Left out, 384px. */
  size?: DialogSize
  /**
   * Something was typed and not saved: closing (Esc, the close button, a
   * click outside, a DialogClose) asks "Discard your changes?" first.
   */
  dirty?: boolean
}) {
  const guard = React.useContext(DialogGuardContext)
  React.useEffect(() => {
    guard?.setDirty(dirty)
  }, [guard, dirty])
  React.useEffect(() => () => guard?.setDirty(false), [guard])
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-size={size}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          size && DIALOG_SIZE[size],
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

/**
 * "Discard your changes?": the one prompt for leaving with something typed
 * and not saved (a dialog's `dirty`, a form's leave guard, a value edited
 * in place). A confirm: 420px, a bottom sheet on a phone. Esc or a click
 * outside keeps editing.
 */
function DiscardChangesDialog({
  open,
  onKeepEditing,
  onDiscard,
  description = "What you typed will be lost.",
  ...props
}: {
  open: boolean
  /** Keep editing, Esc or a click outside: the prompt closes and nothing is lost. */
  onKeepEditing: () => void
  /** Discard: throw away what was typed and leave. */
  onDiscard: () => void
  /** The line under the question. Defaults to "What you typed will be lost." */
  description?: React.ReactNode
} & Omit<DialogPrimitive.Popup.Props, "children">) {
  // Its own Root, outside any guard: rendered inside a dirty dialog, its
  // content mustn't tell that dialog's guard it's clean.
  return (
    <DialogGuardContext.Provider value={null}>
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          if (!next) onKeepEditing()
        }}
      >
        <DialogContent
          size="confirm"
          showCloseButton={false}
          data-discard-changes=""
          {...props}
        >
          <DialogHeader>
            <DialogTitle>Discard your changes?</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Keep editing
            </DialogClose>
            <Button variant="destructive" onClick={onDiscard}>
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPrimitive.Root>
    </DialogGuardContext.Provider>
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  DiscardChangesDialog,
  type DialogSize,
}
