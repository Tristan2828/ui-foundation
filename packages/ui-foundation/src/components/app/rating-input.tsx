// A score out of a few, set by clicking a star (cell pattern 9, 4.127):
// RatingScore's glyphs and tokens, as a control. "My Rating" as ★★★★☆,
// where a click on the second star makes it 2.
//
// - One radio group named by `label` (shadcn's RadioGroup on Base UI): one
//   tab stop, the arrow keys move along the stars and set the value, Space
//   or a click sets the star it's on. Each star is a radio named "2 of 5".
// - Pressing the star that's already set clears it (`null`): a click, or
//   Space on it. Nothing else can clear it, so a slip of the arrow keys
//   never empties a score.
// - Hovering previews: the stars up to the pointer fill as they would on a
//   click, and leaving puts the value back. A mouse's only: a finger has
//   no hover, and a tap's preview would stick.
// - Drawn as RatingScore draws: the filled glyphs in `foreground`, the
//   rest outlines in `muted-foreground` (3:1 on the page in both themes),
//   so the count carries the value and survives greyscale.
// - Compact on a mouse's screen (24px targets, the glyphs RatingScore's
//   16px), 44px targets on a touch screen (`pointer-coarse`), the glyphs
//   20px. Fixed-size: as wide at 1 as at 5, so setting it moves nothing.
// - `onChange`'s second argument says how it was set: `pointer` (a click
//   or a tap, a deliberate pick) or `keyboard` (an arrow, which may be one
//   of several on the way). `inPlace.rating` saves a pick at once and an
//   arrow's value a pause after the last one.
import { Radio } from '@base-ui/react/radio'
import { useRef, useState, type PointerEvent } from 'react'
import { cn } from 'cn'
import { RadioGroup } from '@/components/ui/radio-group'
import { RATING_GLYPH_PATHS } from '@/lib/rating-glyphs'
import type { RatingScoreGlyph } from './rating-score'

/** How a RatingInput's value was set: a click or tap, or the keyboard. */
export type RatingInputSource = 'pointer' | 'keyboard'

export type RatingInputProps = {
  /** How many stars are set, 1…max, or `null` for none (rounded, clamped). */
  value: number | null
  /** How many stars it has. Defaults to 5. */
  max?: number
  /** Stars (the default) or hearts. */
  glyph?: RatingScoreGlyph
  /** The new value: a star's number, or `null` when the set one was pressed again. */
  onChange: (value: number | null, source: RatingInputSource) => void
  /** The group's accessible name: the field's label ("My Rating"). */
  label: string
  disabled?: boolean
  /** The line describing it (a field's error or hint). */
  'aria-describedby'?: string
  invalid?: boolean
  id?: string
  className?: string
}

const clamp = (value: number | null, max: number) => (value == null ? null : Math.min(Math.max(0, Math.round(value)), max) || null)

export function RatingInput({
  value,
  max = 5,
  glyph = 'star',
  onChange,
  label,
  disabled = false,
  invalid = false,
  id,
  className,
  'aria-describedby': describedBy,
}: RatingInputProps) {
  const set = clamp(value, max)
  const [preview, setPreview] = useState<number | null>(null)
  // What started the change Base UI reports: a key (an arrow, Space) or a pointer.
  const source = useRef<RatingInputSource>('pointer')
  const filled = disabled ? (set ?? 0) : (preview ?? set ?? 0)
  const path = RATING_GLYPH_PATHS[glyph]

  const onKeyDown = () => {
    source.current = 'keyboard'
  }
  const onPointerDown = () => {
    source.current = 'pointer'
  }
  const hover = (star: number | null) => (event: PointerEvent) => {
    if (event.pointerType === 'mouse') setPreview(star)
  }

  return (
    <RadioGroup
      id={id}
      data-slot="rating-input"
      data-value={set ?? undefined}
      data-glyph={glyph}
      aria-label={label}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      value={set}
      onValueChange={(next: number | null) => {
        if (next != null && next !== set) onChange(next, source.current)
      }}
      disabled={disabled}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerLeave={hover(null)}
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-0 align-middle text-foreground',
        invalid && 'rounded-md ring-3 ring-destructive/20 dark:ring-destructive/40',
        className,
      )}
    >
      {Array.from({ length: max }, (_, at) => {
        const star = at + 1
        const on = star <= filled
        return (
          <Radio.Root
            key={star}
            value={star}
            data-star={star}
            aria-label={`${star} of ${max}`}
            onPointerEnter={hover(star)}
            // Pressing the set star again clears it (a click, a tap or
            // Space, which Base UI turns into a click). Base UI reports no
            // change for it. The arrow keys check a radio by focusing it,
            // never by a click, so they never clear.
            onClick={() => {
              if (disabled || star !== set) return
              onChange(null, source.current)
            }}
            className={cn(
              'inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm outline-none',
              'focus-visible:ring-3 focus-visible:ring-ring/50',
              'pointer-coarse:size-11',
              'data-disabled:cursor-not-allowed data-disabled:opacity-50',
            )}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              data-filled={on ? '' : undefined}
              className={cn('size-4 shrink-0 pointer-coarse:size-5', on ? 'text-current' : 'text-muted-foreground')}
            >
              <path
                d={path}
                className={on ? 'fill-current stroke-current' : 'fill-none stroke-current'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Radio.Root>
        )
      })}
    </RadioGroup>
  )
}
