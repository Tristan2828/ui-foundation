// An action's error beside its button (4.90, the dialogs and feedback
// standard D6): a destructive Notice with the reason and Try again, which
// runs the action again. Not a toast: the error stays next to what failed
// until it's tried again or the action works. Give it a useAction.
//
// The live region is always there (empty, it takes no room), so an error
// that appears is announced.
import { cn } from 'cn'
import type { ActionState } from '@/hooks/use-action'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Notice } from './notice'

export type ActionErrorProps = {
  /** The action, from useAction: its error, pending state and retry. */
  action: Pick<ActionState, 'error' | 'pending'> & { retry: () => unknown }
  /** A lead before the reason: "Couldn't mark it as read". */
  title?: string
  className?: string
}

export function ActionError({ action, title, className }: ActionErrorProps) {
  return (
    <div role="status" data-slot="action-error" className={cn('empty:hidden', className)}>
      {action.error && (
        <Notice
          tone="destructive"
          title={title}
          action={
            <Button type="button" size="sm" variant="outline" disabled={action.pending} onClick={() => void action.retry()}>
              {action.pending && <Spinner className="size-4" />}
              Try again
            </Button>
          }
        >
          {action.error}
        </Notice>
      )}
    </div>
  )
}
