// A stage circle (cell pattern 19): where a record is in an ordered
// lifecycle, as a small circle that fills as it moves on. It sits beside
// the status word, which stays: the shape carries the stage in greyscale
// and the tone only reinforces it.
//
// Lucide has no part-filled circle, so it's drawn here, in currentColor
// (16×16 viewBox, the ring and fill in the tone, the tick cut out of the
// solid circle in the page's background).
import { cn } from 'cn'

/**
 * Where the record is: `0` the first stage (a dashed outline), `1`–`3` a
 * stage under way (a quarter, a half, three quarters filled), `'complete'`
 * the final stage (solid, with a tick), `'exit'` off the lifecycle (struck
 * through: dropped, cancelled).
 */
export type StageCircleStage = 0 | 1 | 2 | 3 | 'complete' | 'exit'

/**
 * The tone, as text on the page (`*-text` tokens). `muted` is the default:
 * colour only the stages that mean something (in progress `info`,
 * complete `success`), like a tone-mapped badge (cell pattern 5).
 */
export type StageCircleTone = 'muted' | 'info' | 'success' | 'warning' | 'destructive'

export interface StageCircleProps {
  stage: StageCircleStage
  tone?: StageCircleTone
  className?: string
}

const TONE_CLASS: Record<StageCircleTone, string> = {
  muted: 'text-muted-foreground',
  info: 'text-info-text',
  success: 'text-success-text',
  warning: 'text-warning-text',
  destructive: 'text-destructive-text',
}

// The filled part of a stage under way: a pie from twelve o'clock,
// clockwise, inside the ring with a gap so it reads as filling, not as a
// thicker ring.
const PIE: Record<1 | 2 | 3, string> = {
  1: 'M8 8V4.5A3.5 3.5 0 0 1 11.5 8Z',
  2: 'M8 8V4.5A3.5 3.5 0 0 1 8 11.5Z',
  3: 'M8 8V4.5A3.5 3.5 0 1 1 4.5 8Z',
}

const RING = { cx: 8, cy: 8, r: 6, strokeWidth: 1.5, className: 'fill-none stroke-current' } as const

/** The glyph only: put the status word beside it. Hidden from screen readers, which read the word. */
export function StageCircle({ stage, tone = 'muted', className }: StageCircleProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      data-slot="stage-circle"
      data-stage={stage}
      className={cn('size-4 shrink-0', TONE_CLASS[tone], className)}
    >
      {stage === 0 && <circle {...RING} strokeDasharray="2.4 2.3" />}
      {(stage === 1 || stage === 2 || stage === 3) && (
        <>
          <circle {...RING} />
          <path d={PIE[stage]} className="fill-current" />
        </>
      )}
      {stage === 'complete' && (
        <>
          <circle cx="8" cy="8" r="7" className="fill-current" />
          <path
            d="M5 8.2 7.1 10.2 11 6"
            className="fill-none stroke-background"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {stage === 'exit' && (
        <>
          <circle {...RING} />
          <path d="M4 12 12 4" className="fill-none stroke-current" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}
