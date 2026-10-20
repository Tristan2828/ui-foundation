// An ordered enum of a few bands, best to worst (cell pattern 9's
// variant): a short bar of steps, the first `value` filled, with the
// band's word beside it. Narrower than five stars, and reads as a scale,
// not a rating. "Quality: High" as ■■■■□ High.
//
// The filled steps are the ink (currentColor, `foreground`), clearing 3:1
// on the page in both themes; the empty steps are the track (`border`),
// deliberately faint and carrying nothing on their own: the count of
// filled steps and the word carry the value. One image to a screen
// reader, named with both ("Quality: High, 4 of 5").
import { cn } from 'cn'

export type StepBarProps = {
  /** How many steps are filled, 0…steps. */
  value: number
  /** How many steps the scale has. Defaults to 5. */
  steps?: number
  /** The band's word, shown beside the bar ("High"). */
  word?: string
  /**
   * What a screen reader hears. Defaults to the word and the count
   * ("High, 4 of 5"); pass the field's name in front when the cell
   * doesn't give it ("Quality: High, 4 of 5").
   */
  label?: string
  className?: string
}

// Each step 4×8 with a 1.5 gap, in a 16-high box, so the bar sits on the
// text's line like the other glyphs.
const STEP_WIDTH = 4
const STEP_GAP = 1.5
const STEP_HEIGHT = 8

export function StepBar({ value, steps = 5, word, label, className }: StepBarProps) {
  const filled = Math.min(Math.max(0, Math.round(value)), steps)
  const width = steps * STEP_WIDTH + (steps - 1) * STEP_GAP
  const name = label ?? `${word ? `${word}, ` : ''}${filled} of ${steps}`
  return (
    <span
      role="img"
      aria-label={name}
      data-slot="step-bar"
      data-value={filled}
      className={cn('inline-flex shrink-0 items-center gap-1.5 text-foreground', className)}
    >
      <svg viewBox={`0 0 ${width} 16`} aria-hidden="true" className="h-4 shrink-0" style={{ width: `${width / 16}rem` }}>
        {Array.from({ length: steps }, (_, step) => (
          <rect
            key={step}
            x={step * (STEP_WIDTH + STEP_GAP)}
            y={(16 - STEP_HEIGHT) / 2}
            width={STEP_WIDTH}
            height={STEP_HEIGHT}
            rx="1"
            className={step < filled ? 'fill-current' : 'fill-border'}
          />
        ))}
      </svg>
      {word && (
        <span aria-hidden="true" className="text-muted-foreground">
          {word}
        </span>
      )}
    </span>
  )
}
