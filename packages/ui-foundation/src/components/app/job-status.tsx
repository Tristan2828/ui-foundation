// A job's progress beside the button that started it (4.90, the dialogs
// and feedback standard D8): "Checking 3 of 12…" with a spinner while it
// runs, then the result line ("Checked 12 · 2 deals"), which stays. Quiet:
// the muted caption, the result's check in the success tone. No toast
// while the page is on screen; for one when it was left before the job
// finished, run the job through useAction with `doneAway`.
//
// One live region, always there, so each step and the result are
// announced (politely: a screen reader isn't interrupted for every step).
import type { ReactNode } from 'react'
import { CheckIcon } from 'lucide-react'
import { cn } from 'cn'
import { Spinner } from '@/components/ui/spinner'

export type JobProgress = {
  /** How far it is: the 3 in "Checking 3 of 12…". */
  done: number
  /** How many there are, when it's known; without it the line is just "Checking…". */
  total?: number
}

export type JobStatusProps = {
  /** While it runs: how far along it is. Leave it out (or null) once it's finished. */
  state?: JobProgress | null
  /** The word for the work, as it goes: "Checking", "Fetching". */
  verb: string
  /** Once it's finished: what it found, "Checked 12 · 2 deals". Stays until the next run. */
  result?: ReactNode
  className?: string
}

export function JobStatus({ state, verb, result, className }: JobStatusProps) {
  return (
    <div
      role="status"
      data-slot="job-status"
      data-state={state ? 'running' : result ? 'done' : 'idle'}
      className={cn('flex min-h-5 items-center gap-1.5 type-caption text-muted-foreground empty:hidden', className)}
    >
      {state ? (
        <>
          <Spinner className="size-3.5" />
          <span className="tabular-nums">
            {state.total === undefined ? `${verb}…` : `${verb} ${state.done} of ${state.total}…`}
          </span>
        </>
      ) : result ? (
        <>
          <CheckIcon aria-hidden="true" className="size-3.5 text-success-text" />
          <span>{result}</span>
        </>
      ) : null}
    </div>
  )
}
