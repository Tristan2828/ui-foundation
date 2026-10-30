// A card's picture (DataTable's card layouts): a box of a fixed shape, a
// poster's 2:3, a square cover's 1:1 or a video's 16:9, holding the
// record's image, or a neutral placeholder when it has none (or it fails
// to load), so a grid of cards keeps its rows even. Overlays sit on top:
// `topStart`/`topEnd`/`bottomStart`/`bottomEnd` corners for a badge, a
// length, or a round button such as Read or Owned.
//
// The image is decorative by default (`alt=""`): the card's title, beside
// it, already names the record. Give `alt` only when the picture says
// something the card doesn't.
import { useState, type ReactNode } from 'react'
import { ImageIcon } from 'lucide-react'
import { cn } from 'cn'
import type { IconComponent } from './icon-component'

export type ArtworkAspect = '2:3' | '1:1' | '16:9'

const ASPECT_CLASS: Record<ArtworkAspect, string> = {
  '2:3': 'aspect-[2/3]',
  '1:1': 'aspect-square',
  '16:9': 'aspect-video',
}

export type ArtworkProps = {
  /** The image's URL; null or undefined for the placeholder. */
  src?: string | null
  alt?: string
  aspect: ArtworkAspect
  /** The placeholder's icon (the list's own: a book, a die); a picture icon when left out. */
  placeholderIcon?: IconComponent
  /** Words under the placeholder's icon, often the title, for a grid where most records have no picture. */
  placeholderLabel?: ReactNode
  topStart?: ReactNode
  topEnd?: ReactNode
  bottomStart?: ReactNode
  bottomEnd?: ReactNode
  /** Dims the picture (a watched video), never its overlays. */
  dimmed?: boolean
  className?: string
}

const CORNER_CLASS = 'absolute z-10 flex items-center gap-1'

export function Artwork({
  src,
  alt = '',
  aspect,
  placeholderIcon: PlaceholderIcon = ImageIcon,
  placeholderLabel,
  topStart,
  topEnd,
  bottomStart,
  bottomEnd,
  dimmed,
  className,
}: ArtworkProps) {
  // The src that failed, so a new one gets its own try.
  const [failed, setFailed] = useState<string | null>(null)
  const showImage = Boolean(src) && failed !== src
  return (
    <div
      data-slot="artwork"
      data-aspect={aspect}
      className={cn('relative w-full overflow-hidden rounded-md bg-muted', ASPECT_CLASS[aspect], className)}
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(src ?? null)}
          className={cn('size-full object-cover', dimmed && 'opacity-55')}
        />
      ) : (
        <div
          data-slot="artwork-placeholder"
          className={cn(
            'flex size-full flex-col items-center justify-center gap-2 p-3 text-center text-muted-foreground',
            dimmed && 'opacity-55',
          )}
        >
          <PlaceholderIcon aria-hidden="true" className="size-6 shrink-0" />
          {/* The foreground's colour: muted text on the muted box is under 4.5:1. */}
          {placeholderLabel && (
            <span className="type-caption line-clamp-3 text-balance text-foreground">{placeholderLabel}</span>
          )}
        </div>
      )}
      {topStart && <div className={cn(CORNER_CLASS, 'top-1.5 left-1.5')}>{topStart}</div>}
      {topEnd && <div className={cn(CORNER_CLASS, 'top-1.5 right-1.5')}>{topEnd}</div>}
      {bottomStart && <div className={cn(CORNER_CLASS, 'bottom-1.5 left-1.5')}>{bottomStart}</div>}
      {bottomEnd && <div className={cn(CORNER_CLASS, 'right-1.5 bottom-1.5')}>{bottomEnd}</div>}
    </div>
  )
}

/**
 * A small label on a picture (a length, "Live", "Short"): the page's
 * foreground as its background, so it reads on any image in either theme.
 */
export function ArtworkTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      data-slot="artwork-tag"
      className={cn(
        'rounded-sm bg-foreground/85 px-1 font-mono text-[0.6875rem] leading-4 font-medium text-background tabular-nums',
        className,
      )}
    >
      {children}
    </span>
  )
}

export type ArtworkToggleProps = {
  /** What it marks, with the record ("Read: Saga"), for a screen reader and the tooltip. */
  label: string
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
  icon: IconComponent
  disabled?: boolean
}

/**
 * A round button on a picture that marks the record (Read, Owned): dark
 * on the picture while off, success's solid fill while on, so it reads on
 * any image. Goes in one of Artwork's corners.
 */
export function ArtworkToggle({ label, pressed, onPressedChange, icon: Icon, disabled }: ArtworkToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        'grid size-8 place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        'disabled:pointer-events-none disabled:opacity-50',
        pressed
          ? 'bg-success text-success-foreground hover:bg-success/90'
          : 'bg-foreground/85 text-background hover:bg-foreground',
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
    </button>
  )
}
