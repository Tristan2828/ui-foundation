// A score out of a few (cell pattern 9, 4.117): `max` stars or hearts,
// the first `value` filled. "My Rating: 4 of 5" as ★★★★☆. The count of
// filled glyphs carries the value, so it survives greyscale.
//
// The filled glyphs are the ink (currentColor, `foreground`); the empty
// ones are outlines in `muted-foreground`, which clears 3:1 on the page in
// both themes, so an empty glyph is seen as a glyph, not as nothing. One
// image to a screen reader, named in words ("4 of 5"); pass the field's
// name in front where nothing near it gives it ("My Rating: 4 of 5").
//
// Fixed-size glyphs: the score is as wide at 1 as at 5, so a value edited
// in place never moves what's beside it.
import { cn } from 'cn'

export type RatingScoreGlyph = 'star' | 'heart'

export type RatingScoreProps = {
  /** How many glyphs are filled, 0…max (rounded). */
  value: number
  /** How many glyphs the score has. Defaults to 5. */
  max?: number
  /** Stars (the default) or hearts. */
  glyph?: RatingScoreGlyph
  /** A word shown after the glyphs, in the muted tone ("Loved"). */
  word?: string
  /** What a screen reader hears. Defaults to "4 of 5" (with the word first when given: "Loved, 4 of 5"). */
  label?: string
  className?: string
}

// Lucide's star and heart (24×24), so they match the icons around them.
const PATHS: Record<RatingScoreGlyph, string> = {
  star: 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z',
  heart:
    'M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5',
}

/** A score's spoken words: "4 of 5", or "Loved, 4 of 5" with a word. */
function ratingScoreName(value: number, max = 5, word?: string) {
  const filled = Math.min(Math.max(0, Math.round(value)), max)
  return `${word ? `${word}, ` : ''}${filled} of ${max}`
}

export function RatingScore({ value, max = 5, glyph = 'star', word, label, className }: RatingScoreProps) {
  const filled = Math.min(Math.max(0, Math.round(value)), max)
  const path = PATHS[glyph]
  return (
    <span
      role="img"
      aria-label={label ?? ratingScoreName(filled, max, word)}
      data-slot="rating-score"
      data-value={filled}
      data-glyph={glyph}
      className={cn('inline-flex shrink-0 items-center gap-1.5 align-middle text-foreground', className)}
    >
      <span aria-hidden="true" className="inline-flex shrink-0 items-center gap-0.5">
        {Array.from({ length: max }, (_, at) => (
          <svg
            key={at}
            viewBox="0 0 24 24"
            data-filled={at < filled ? '' : undefined}
            className={cn('size-4 shrink-0', at < filled ? 'text-current' : 'text-muted-foreground')}
          >
            <path
              d={path}
              className={at < filled ? 'fill-current stroke-current' : 'fill-none stroke-current'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ))}
      </span>
      {word && (
        <span aria-hidden="true" className="text-muted-foreground">
          {word}
        </span>
      )}
    </span>
  )
}
