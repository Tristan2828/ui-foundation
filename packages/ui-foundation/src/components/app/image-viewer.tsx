// A full-screen image viewer (a lightbox): one of an ordered list of
// images, large, over the whole viewport, on the dark stage whatever the
// app's theme (photos and covers read best on dark, and the stage never
// fights the picture's own colours). Previous and next by the arrow
// buttons, the arrow keys (Home and End for the first and last), the mouse
// wheel and a swipe on a phone; Esc and Close leave. A counter ("3 of 14"),
// the image's caption, and an app's own actions beside it ("Read from
// here").
//
// It's the package's modal Dialog (Base UI) with its own popup, as
// SessionView is: focus stays inside while it's open and goes back to what
// opened it, and it's named by its title. Each image shows a spinner until
// it has loaded, and a message in the frame if it can't be, with Try
// Again. The neighbours are fetched ahead, so a step is usually instant.
//
// Controlled by one value: `index` is the image shown, null while closed.
// An app keeps `useState<number | null>(null)`, sets it from a click on a
// cover, and passes the setter as `onIndexChange`.
import * as React from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { ChevronLeftIcon, ChevronRightIcon, ImageOffIcon, XIcon } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogPortal, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'

export type ImageViewerImage = {
  src: string
  /** What the image shows, for a screen reader (and the frame's message if it fails). */
  alt: string
  /** Shown under the image: a title, a date, a line about it. */
  caption?: React.ReactNode
}

export type ImageViewerProps<T extends ImageViewerImage = ImageViewerImage> = {
  /** The images in order. */
  images: readonly T[]
  /** The image shown (an index into `images`); null while the viewer is closed. */
  index: number | null
  /** Called with the new index on a step, and with null on Esc and Close. */
  onIndexChange: (index: number | null) => void
  /** Names the viewer for screen readers, and heads it on screen. */
  title: React.ReactNode
  /** An app's own controls beside the caption, for the image shown (a Button or two). */
  actions?: (image: T, index: number) => React.ReactNode
  className?: string
}

// A wheel gesture moves one image: a trackpad's flick sends dozens of
// events, so once a step is taken the rest of the gesture is ignored.
const WHEEL_THRESHOLD = 40
const WHEEL_REST_MS = 350
// A swipe is a mostly sideways touch drag at least this long.
const SWIPE_MIN_PX = 50

export function ImageViewer<T extends ImageViewerImage>({
  images,
  index,
  onIndexChange,
  title,
  actions,
  className,
}: ImageViewerProps<T>) {
  const count = images.length
  const open = index !== null && count > 0
  // The last image shown, so the content stays while the viewer fades out.
  // (React's "adjust state while rendering": the stored value follows `index`.)
  const [lastShown, setLastShown] = React.useState(0)
  const at = open ? clamp(index, count) : Math.min(lastShown, Math.max(count - 1, 0))
  if (open && at !== lastShown) setLastShown(at)
  const image = images[at]

  const canBack = at > 0
  const canForward = at < count - 1
  const go = React.useCallback(
    (next: number) => {
      if (!open || next < 0 || next >= count || next === at) return
      onIndexChange(next)
    },
    [open, count, at, onIndexChange],
  )

  // The keys, heard on the document in the capture phase: Base UI's focus
  // handling stops arrow keys bubbling, and a click on the image can leave
  // focus on the body. A key meant for a control that uses arrows itself
  // (a text box, a slider, a menu an action opened) is left alone.
  const popup = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const target = event.target instanceof Node ? event.target : null
      const inViewer = target === document.body || (target !== null && !!popup.current?.contains(target))
      if (!inViewer || usesArrows(event.target)) return
      const step =
        event.key === 'ArrowLeft' ? at - 1 : event.key === 'ArrowRight' ? at + 1 : event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : null
      if (step === null) return
      event.preventDefault()
      go(step)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, at, count, go])

  usePreload(open ? images : undefined, at)

  const wheel = React.useRef({ total: 0, stepped: 0 })
  const onWheel = (event: React.WheelEvent) => {
    const now = performance.now()
    if (now - wheel.current.stepped < WHEEL_REST_MS) return
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    wheel.current.total += delta
    if (Math.abs(wheel.current.total) < WHEEL_THRESHOLD) return
    go(wheel.current.total > 0 ? at + 1 : at - 1)
    wheel.current = { total: 0, stepped: now }
  }

  const swipe = React.useRef<{ id: number; x: number; y: number } | null>(null)
  const onPointerDown = (event: React.PointerEvent) => {
    if (event.pointerType !== 'touch') return
    swipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
  }
  const onPointerUp = (event: React.PointerEvent) => {
    const start = swipe.current
    swipe.current = null
    if (!start || start.id !== event.pointerId) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return
    go(dx < 0 ? at + 1 : at - 1)
  }

  const position = `${at + 1} of ${count}`
  const caption = image?.caption
  const ownActions = image && actions ? actions(image, at) : null

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onIndexChange(null)}>
      <DialogPortal>
        <DialogPrimitive.Popup
          ref={popup}
          data-slot="image-viewer"
          className={cn(
            // The dark stage: theme.css's .dark block remaps the tokens for this subtree only.
            'dark scheme-dark fixed inset-0 z-50 flex flex-col bg-background text-foreground outline-none',
            'pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]',
            'duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
            className,
          )}
        >
          <header className="flex items-center gap-3 px-4 py-2">
            <DialogTitle className="min-w-0 flex-1 truncate type-section-title">{title}</DialogTitle>
            {count > 1 && (
              <span data-slot="image-viewer-counter" aria-hidden className="shrink-0 type-label text-muted-foreground tabular-nums">
                {position}
              </span>
            )}
            <DialogClose render={<Button variant="ghost" size="icon" aria-label="Close" />}>
              <XIcon />
            </DialogClose>
          </header>
          {/* What a screen reader hears on each step: where it is, and what it shows. */}
          <p aria-live="polite" aria-atomic className="sr-only">
            {image ? (count > 1 ? `${position}: ${image.alt}` : image.alt) : ''}
          </p>

          <div
            data-slot="image-viewer-frame"
            className="relative min-h-0 flex-1 touch-pan-y touch-pinch-zoom select-none"
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (swipe.current = null)}
          >
            {image && <ViewerImage key={image.src} image={image} />}
            {count > 1 && (
              <>
                <StepButton side="start" label="Previous Image" available={canBack} onClick={() => go(at - 1)} />
                <StepButton side="end" label="Next Image" available={canForward} onClick={() => go(at + 1)} />
              </>
            )}
          </div>

          {(caption || ownActions) && (
            <footer
              data-slot="image-viewer-footer"
              className="flex flex-col gap-3 px-4 pt-3 pb-4 md:flex-row md:items-center md:gap-6 md:px-6"
            >
              <div data-slot="image-viewer-caption" className="min-w-0 flex-1 type-body text-foreground">
                {caption}
              </div>
              {ownActions && (
                <div data-slot="image-viewer-actions" className="flex shrink-0 flex-wrap gap-2 max-md:[&>*]:flex-1">
                  {ownActions}
                </div>
              )}
            </footer>
          )}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}

type LoadState = 'loading' | 'loaded' | 'failed'

// One image in the frame, keyed by its src, so each new one starts loading
// from scratch: the spinner over an empty frame, never the last picture.
function ViewerImage({ image }: { image: ImageViewerImage }) {
  const [state, setState] = React.useState<LoadState>('loading')
  const [attempt, setAttempt] = React.useState(0)
  // A cached image may have finished before React heard its load event.
  const seeIfDone = React.useCallback((element: HTMLImageElement | null) => {
    if (element?.complete) setState(element.naturalWidth > 0 ? 'loaded' : 'failed')
  }, [])
  return (
    <div className="absolute inset-x-4 inset-y-2 md:inset-x-20 md:inset-y-4" data-state={state}>
      {state !== 'failed' && (
        <img
          key={attempt}
          ref={seeIfDone}
          src={image.src}
          alt={image.alt}
          decoding="async"
          draggable={false}
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
          className={cn('size-full object-contain transition-opacity duration-150', state === 'loading' && 'opacity-0')}
        />
      )}
      {state === 'loading' && (
        <div data-slot="image-viewer-loading" className="absolute inset-0 flex items-center justify-center">
          <Spinner className="size-8 text-muted-foreground" aria-label="Loading image" />
        </div>
      )}
      {state === 'failed' && (
        <div
          data-slot="image-viewer-error"
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center"
        >
          <ImageOffIcon aria-hidden className="size-10 text-muted-foreground" />
          <p className="type-body text-foreground">This image couldn&rsquo;t be loaded.</p>
          <p className="max-w-prose type-caption text-muted-foreground">{image.alt}</p>
          <Button
            variant="outline"
            onClick={() => {
              setAttempt((n) => n + 1)
              setState('loading')
            }}
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  )
}

// A step button at the frame's side. At an end it stays in the tab order,
// marked unavailable, so focus isn't dropped out of the viewer.
function StepButton({
  side,
  label,
  available,
  onClick,
}: {
  side: 'start' | 'end'
  label: string
  available: boolean
  onClick: () => void
}) {
  const Icon = side === 'start' ? ChevronLeftIcon : ChevronRightIcon
  return (
    <Button
      variant="secondary"
      size="icon-lg"
      aria-label={label}
      aria-disabled={!available || undefined}
      data-slot={side === 'start' ? 'image-viewer-previous' : 'image-viewer-next'}
      onClick={() => available && onClick()}
      className={cn(
        'absolute top-1/2 z-10 -translate-y-1/2 rounded-full shadow-sm',
        side === 'start' ? 'left-2 md:left-4' : 'right-2 md:right-4',
        'aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-secondary',
      )}
    >
      <Icon />
    </Button>
  )
}

// The images either side of the one shown, fetched ahead so a step shows
// one already in the browser's cache.
function usePreload(images: readonly ImageViewerImage[] | undefined, at: number) {
  const before = images?.[at - 1]?.src
  const after = images?.[at + 1]?.src
  React.useEffect(() => {
    for (const src of [after, before]) {
      if (!src) continue
      const preload = new Image()
      preload.decoding = 'async'
      preload.src = src
    }
  }, [before, after])
}

function clamp(index: number, count: number) {
  return Math.min(Math.max(Math.trunc(index), 0), count - 1)
}

const ARROW_ROLES = '[role=slider],[role=menu],[role=menubar],[role=listbox],[role=radiogroup],[role=tablist],[role=grid],[role=tree],[role=combobox],[role=spinbutton]'

function usesArrows(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target.closest(ARROW_ROLES)) return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  return target instanceof HTMLInputElement && !['button', 'checkbox', 'radio', 'submit', 'reset'].includes(target.type)
}
