// The step row's classes and its keep-in-view hook, shared by StepTrack
// (step-track.tsx) and the stepper look (equal-items.tsx), so the two rows
// never drift apart. Internal: never exported from the package's index.
import { useLayoutEffect, type RefObject } from 'react'
import { cn } from 'cn'

/** Where a step is in a sequence (StepTrackState). */
type StepState = 'done' | 'current' | 'upcoming'

/** A step's box: at least 4.5rem wide and 44px tall, sharing the row. */
export const STEP_CELL =
  'group/step relative flex min-h-11 min-w-18 flex-1 basis-0 flex-col items-center gap-1 rounded-md px-1 pt-1 pb-1.5 text-center text-xs text-muted-foreground'

/** The line from the step before, under the marks: the primary up to the current one. */
export const stepLine = (step: StepState) =>
  cn(
    'before:absolute before:top-4 before:right-1/2 before:h-0.5 before:w-full first:before:hidden',
    step === 'upcoming' ? 'before:bg-border' : 'before:bg-primary',
  )

/** The row's scroll box: sideways in its own box, never the page. */
export const STEP_ROW = 'relative flex max-w-full overflow-x-auto overflow-y-hidden [scrollbar-width:thin]'

/**
 * Keeps the step `selector` finds in the row's view when the row scrolls
 * sideways: the row only, never the page. Runs again when `key` changes.
 */
export function useKeepStepInView(rowRef: RefObject<HTMLElement | null>, selector: string, key: string | undefined) {
  useLayoutEffect(() => {
    const row = rowRef.current
    const step = row?.querySelector<HTMLElement>(selector)
    if (!row || !step || row.scrollWidth <= row.clientWidth) return
    const left = step.offsetLeft - row.offsetLeft
    if (left < row.scrollLeft || left + step.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollLeft = left - (row.clientWidth - step.offsetWidth) / 2
    }
  }, [rowRef, selector, key])
}

