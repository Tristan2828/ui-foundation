// A three-value enum as one star (cell pattern 9's variant): yes, partly,
// no as a full, half or empty star, with the word beside it. The shape
// carries the value, so it survives greyscale. A half star alone reads as
// broken, so it's drawn as the left half filled over the whole outline.
//
// The star is the ink (currentColor, `foreground` by default; pass a
// `*-text` tone in `className` to tone it), clearing 3:1 on the page in
// both themes. One image to a screen reader, named in words.
import { useId } from 'react'
import { cn } from 'cn'

export type RatingStarValue = 'full' | 'half' | 'empty'

export type RatingStarProps = {
  value: RatingStarValue
  /** The value's word, shown beside the star ("Partly"). */
  word?: string
  /** What a screen reader hears. Defaults to the word, else "Full star", "Half star" or "Empty star". */
  label?: string
  className?: string
}

// Lucide's star (24×24), so it matches the icons around it.
const STAR =
  'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z'

const DEFAULT_NAME: Record<RatingStarValue, string> = {
  full: 'Full star',
  half: 'Half star',
  empty: 'Empty star',
}

export function RatingStar({ value, word, label, className }: RatingStarProps) {
  const clipId = useId()
  return (
    <span
      role="img"
      aria-label={label ?? word ?? DEFAULT_NAME[value]}
      data-slot="rating-star"
      data-value={value}
      className={cn('inline-flex shrink-0 items-center gap-1.5 text-foreground', className)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 shrink-0">
        {value === 'half' && (
          <defs>
            <clipPath id={clipId}>
              <rect x="0" y="0" width="12" height="24" />
            </clipPath>
          </defs>
        )}
        {value !== 'empty' && (
          <path d={STAR} className="fill-current" clipPath={value === 'half' ? `url(#${clipId})` : undefined} />
        )}
        <path
          d={STAR}
          className="fill-none stroke-current"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {word && <span aria-hidden="true">{word}</span>}
    </span>
  )
}
