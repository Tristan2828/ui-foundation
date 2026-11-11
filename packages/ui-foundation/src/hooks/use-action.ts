// One action's run, its pending state and its error, kept beside the
// button that started it (4.90, the dialogs and feedback standard D6).
//
//   const markRead = useAction(markReadMutation, { failed: "Couldn't mark The Long Walk as read" })
//   <Button onClick={() => markRead.run(book.id)} disabled={markRead.pending}>…</Button>
//   <ActionError action={markRead} />
//
// - `error` is the reason in the gateway's words, for ActionError to draw
//   as a destructive Notice with Try again (`retry`, the last run again).
// - If the component is gone when it fails (its page was left), the error
//   becomes a toast that stays: "<failed>: <reason>".
// - `doneAway`: what a toast says when it finishes after the component was
//   left (a job's "Checked 12 · 2 deals"). On screen, the component shows
//   its own result and no toast.
//
// Takes a TanStack mutation (its `mutateAsync`) or any async function.
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { messageOf } from '@/components/app/edit-in-place-store'
import { notify } from '@/components/app/notify'

type AsyncAction<TArgs extends unknown[], TResult> = (...args: TArgs) => Promise<TResult>

export type UseActionOptions<TResult> = {
  /** The lead of the toast when it fails off screen: "Couldn't mark The Long Walk as read". */
  failed?: string
  /** A toast's words when it finishes after the component was left. No toast when it's on screen. */
  doneAway?: (result: TResult) => string
}

export type ActionOutcome<TResult> = { ok: true; value: TResult } | { ok: false; error: string }

export type ActionState<TArgs extends unknown[] = unknown[], TResult = unknown> = {
  /** Runs it. Never rejects: resolves `{ ok: true, value }`, or `{ ok: false, error }` (also in `error`). */
  run: (...args: TArgs) => Promise<ActionOutcome<TResult>>
  /** The last run again, with the same arguments. */
  retry: () => Promise<ActionOutcome<TResult>>
  /** Clears the error. */
  reset: () => void
  pending: boolean
  /** Why the last run failed, in the gateway's words; null when it didn't. */
  error: string | null
}

export function useAction<TArgs extends unknown[], TResult>(
  action: AsyncAction<TArgs, TResult> | { mutateAsync: AsyncAction<TArgs, TResult> },
  { failed, doneAway }: UseActionOptions<TResult> = {},
): ActionState<TArgs, TResult> {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latest = useRef({ action, failed, doneAway })
  const lastArgs = useRef<TArgs | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    latest.current = { action, failed, doneAway }
  })
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const run = useCallback(async (...args: TArgs): Promise<ActionOutcome<TResult>> => {
    const { action: current } = latest.current
    const call = typeof current === 'function' ? current : current.mutateAsync
    lastArgs.current = args
    setPending(true)
    setError(null)
    try {
      const result = await call(...args)
      if (mounted.current) setPending(false)
      else {
        const words = latest.current.doneAway?.(result)
        if (words) toast.success(words)
      }
      return { ok: true, value: result }
    } catch (thrown) {
      const reason = messageOf(thrown)
      if (mounted.current) {
        setPending(false)
        setError(reason)
      } else {
        notify.failed(`${latest.current.failed ?? "Couldn't finish"}: ${reason}`)
      }
      return { ok: false, error: reason }
    }
  }, [])

  const retry = useCallback(() => run(...(lastArgs.current ?? ([] as unknown as TArgs))), [run])
  const reset = useCallback(() => setError(null), [])

  return { run, retry, reset, pending, error }
}
