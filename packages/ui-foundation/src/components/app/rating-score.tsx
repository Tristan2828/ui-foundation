// A score out of a few (cell pattern 9): `max` stars or hearts,
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
import { RATING_GLYPH_PATHS, type RatingGlyph } from '@/lib/rating-glyphs'

export type RatingScoreGlyph = RatingGlyph

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


/** A score's spoken words: "4 of 5", or "Loved, 4 of 5" with a word. */
function ratingScoreName(value: number, max = 5, word?: string) {
  const filled = Math.min(Math.max(0, Math.round(value)), max)
  return `${word ? `${word}, ` : ''}${filled} of ${max}`
}

export function RatingScore({ value, max = 5, glyph = 'star', word, label, className }: RatingScoreProps) {
  const filled = Math.min(Math.max(0, Math.round(value)), max)
  const path = RATING_GLYPH_PATHS[glyph]
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
