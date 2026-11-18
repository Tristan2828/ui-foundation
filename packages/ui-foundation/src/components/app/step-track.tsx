// A row of numbered steps joined by a line, each done, current or upcoming:
// the marks of `EqualItems look="stepper"` (4.127), on their own and read
// only (4.128). For a display of where a sequence is (a list card showing a
// program's phases, a caption such as "Day 12" under the current one),
// where nothing is picked and no panel shows.
//
// The stepper draws its steps from the same parts (StepMark and StepName
// below, the cell and line classes and the keep-in-view hook in
// step-row.ts), so the two never
// drift apart: change a mark here and both change.
//
// It is not interactive, so it's a named list (`<ol>`), never a tablist:
// each step is a list item whose text is what it shows plus hidden words
// ("Step 2: Phase 2: Build, done"). Wider than its column (a phone, many
// steps), the row scrolls sideways in its own box, never the page, with the
// current step in view; only while it overflows is the box a tab stop
// (axe's scrollable-region-focusable), so the arrow keys can scroll it.
import { useEffect, useRef, useState, type RefObject } from 'react'
import { CheckIcon } from 'lucide-react'
import { cn } from 'cn'
import { STEP_CELL, STEP_ROW, stepLine, useKeepStepInView } from './step-row'

/**
 * Where a step is in a sequence: `done` (a filled step with a check),
 * `current` (ringed, "Current" or a caption under its name) or `upcoming`
 * (outlined, the default).
 */
export type StepTrackState = 'done' | 'current' | 'upcoming'

/**
 * One step. An `EqualItem` is one too (its `id`, `title`, `step` and
 * `attention`), so a record's stepper items can be passed as they are.
 */
export type StepTrackStep = {
  /** Unique in the track. */
  id: string
  /** Its name ("Phase 2: Build"). Plain text. */
  title: string
  /** Done, current or upcoming (the default). */
  step?: StepTrackState
  /**
   * A step that needs a look: a small warning dot on its mark, and these
   * words at the end of its name ("needs an answer").
   */
  attention?: string
}

export type StepTrackProps = {
  steps: readonly StepTrackStep[]
  /** The list's name for screen readers ("Phases"). */
  label: string
  /**
   * A few words under the current step in place of "Current" ("Day 12").
   * The step's name still says it's the current one.
   */
  caption?: string
  /** What no steps says. Defaults to "Nothing yet". */
  emptyText?: string
  className?: string
}

// The stepper's and the track's shared marks (step-row.ts has the row's
// classes and its keep-in-view hook). Internal: exported for
// equal-items.tsx only, never from the package's index.

/**
 * A step's numbered mark. `ring` is `active` for the stepper (a ring when
 * its tab is the one shown) or `on` (the track's current step).
 */
export function StepMark({
  step,
  number,
  attention,
  ring,
  slot,
}: {
  step: StepTrackState
  number: number
  attention: string | undefined
  ring: 'active' | 'on' | 'off'
  slot: string
}) {
  return (
    <span
      aria-hidden="true"
      data-slot={`${slot}-mark`}
      className={cn(
        'relative z-10 grid size-6.5 shrink-0 place-items-center rounded-full border-2 text-xs font-bold tabular-nums',
        step === 'done'
          ? 'border-primary bg-primary text-primary-foreground'
          : step === 'current'
            ? 'border-primary bg-card text-foreground'
            : 'border-border bg-card text-muted-foreground',
        ring === 'active' &&
          'group-data-active/step:ring-2 group-data-active/step:ring-ring group-data-active/step:ring-offset-2 group-data-active/step:ring-offset-card',
        ring === 'on' && 'ring-2 ring-ring ring-offset-2 ring-offset-card',
      )}
    >
      {step === 'done' ? <CheckIcon className="size-3.5" /> : number}
      {attention && (
        <span
          data-slot={`${slot}-attention`}
          className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border border-card bg-warning-text"
        />
      )}
    </span>
  )
}

/**
 * A step's name: what it shows plus hidden words ("Step 2: Phase 2: Build,
 * done"), never an aria-label, so the visible text stays in the name. The
 * hidden words sit inside the clamped line, with no gap a block would add.
 */
export function StepName({
  step,
  number,
  title,
  attention,
  current,
}: {
  step: StepTrackState
  number: number
  title: string
  attention: string | undefined
  /** Hidden ", current", where no visible "Current" says so. */
  current?: boolean
}) {
  return (
    <span className="line-clamp-3 max-w-full min-w-0 break-words">
      <span className="sr-only">{`Step ${number}: `}</span>
      {title}
      {step === 'done' && <span className="sr-only">, done</span>}
      {current && <span className="sr-only">, current</span>}
      {attention && <span className="sr-only">{`, ${attention}`}</span>}
    </span>
  )
}

// Whether the row is wider than its box, followed as either changes size.
function useOverflows(rowRef: RefObject<HTMLElement | null>) {
  const [overflows, setOverflows] = useState(false)
  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    const check = () => setOverflows(row.scrollWidth > row.clientWidth + 1)
    check()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(check)
    observer.observe(row)
    return () => observer.disconnect()
  }, [rowRef])
  return overflows
}

/**
 * A read-only row of numbered steps (4.128): the stepper look's marks
 * without its panels, for showing where a sequence is (a list card's
 * phases), with a `caption` under the current step.
 *
 * ```tsx
 * <StepTrack
 *   label="Phases"
 *   caption="Day 12"
 *   steps={[
 *     { id: 'p1', title: 'Phase 1', step: 'done' },
 *     { id: 'p2', title: 'Phase 2', step: 'current' },
 *     { id: 'p3', title: 'Phase 3' },
 *   ]}
 * />
 * ```
 *
 * A named list, not a tablist: nothing is picked. To look at each step's
 * details in turn, use `EqualItems look="stepper"` (design-language.md "A
 * few equal things").
 */
export function StepTrack({ steps, label, caption, emptyText = 'Nothing yet', className }: StepTrackProps) {
  const rowRef = useRef<HTMLOListElement>(null)
  const currentId = steps.find((step) => step.step === 'current')?.id
  useKeepStepInView(rowRef, '[data-slot="step-track-step"][aria-current]', currentId)
  const overflows = useOverflows(rowRef)
  if (steps.length === 0) {
    return (
      <p data-slot="step-track" data-state="empty" className={cn('type-body text-muted-foreground', className)}>
        {emptyText}
      </p>
    )
  }
  return (
    <ol
      ref={rowRef}
      data-slot="step-track"
      aria-label={label}
      tabIndex={overflows ? 0 : undefined}
      className={cn(STEP_ROW, 'm-0 list-none p-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50', className)}
    >
      {steps.map((item, index) => {
        const step = item.step ?? 'upcoming'
        const current = step === 'current'
        const showCaption = current && caption !== undefined && caption !== ''
        return (
          <li
            key={item.id}
            data-slot="step-track-step"
            data-step={step}
            aria-current={current ? 'step' : undefined}
            className={cn(STEP_CELL, stepLine(step), current && 'font-semibold text-foreground')}
          >
            <StepMark step={step} number={index + 1} attention={item.attention} ring={current ? 'on' : 'off'} slot="step-track-step" />
            <StepName step={step} number={index + 1} title={item.title} attention={item.attention} current={showCaption} />
            {current && (
              <span data-slot="step-track-caption" className="font-normal text-muted-foreground">
                {showCaption ? caption : 'Current'}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
