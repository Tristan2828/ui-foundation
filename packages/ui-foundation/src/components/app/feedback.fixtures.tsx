import type { Meta, StoryObj } from '@/fixtures/types'
import { useState } from 'react'
import { RefreshCwIcon, WifiOffIcon } from 'lucide-react'
import { useAction } from '@/hooks/use-action'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Toaster } from '@/components/ui/sonner'
import { Spinner } from '@/components/ui/spinner'
import { ActionError } from './action-error'
import { JobStatus, type JobProgress } from './job-status'
import { OfflineNotice } from './offline-notice'

// The dialogs and feedback standard's pieces on made-up books (D6 to D9):
// an action's error beside its button, a job's progress beside its
// button, the offline bar, and a list whose skeleton waits 300ms.
// AllStates is every one on screen at once, for axe and the glyph check in
// both themes (e2e/fixtures-visual.spec.ts); e2e/feedback.spec.ts drives
// the rest.

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function MarkAsRead() {
  const markRead = useAction(async () => {
    await wait(300)
    throw new Error('Couldn’t mark Harbor Light as read: the server didn’t answer.')
  })
  return (
    <div className="flex max-w-md flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-section-title">Harbor Light</h2>
        <Button variant="outline" size="sm" disabled={markRead.pending} onClick={() => void markRead.run()}>
          {markRead.pending && <Spinner className="size-4" />}
          Mark as Read
        </Button>
      </div>
      <ActionError action={markRead} />
    </div>
  )
}

function CheckPrices() {
  const [progress, setProgress] = useState<JobProgress | null>(null)
  const [result, setResult] = useState<string>()
  const check = useAction(
    async () => {
      for (let done = 1; done <= 12; done++) {
        setProgress({ done, total: 12 })
        await wait(120)
      }
      return 'Checked 12 · 2 deals'
    },
    { doneAway: (words) => words },
  )
  return (
    <div className="flex max-w-md flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-section-title">Planned purchases</h2>
        <Button
          variant="outline"
          size="sm"
          disabled={check.pending}
          onClick={async () => {
            setResult(undefined)
            const outcome = await check.run()
            setProgress(null)
            if (outcome.ok) setResult(outcome.value)
          }}
        >
          <RefreshCwIcon aria-hidden="true" />
          Check Prices
        </Button>
      </div>
      <JobStatus verb="Checking" state={progress} result={result} />
      <ActionError action={check} />
    </div>
  )
}

function Connection() {
  return (
    <div className="flex flex-col gap-3">
      <OfflineNotice />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => window.dispatchEvent(new Event('offline'))}>
          <WifiOffIcon aria-hidden="true" />
          Lose the Connection
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.dispatchEvent(new Event('online'))}>
          Get It Back
        </Button>
      </div>
    </div>
  )
}

// Starts an action, then leaves at once: what it says arrives as a toast.
function Leaving({ label, action, failed, doneAway }: { label: string; action: () => Promise<string>; failed?: string; doneAway?: (words: string) => string }) {
  const run = useAction(action, { failed, doneAway })
  return (
    <Button variant="outline" size="sm" onClick={() => void run.run()}>
      {label}
    </Button>
  )
}

function LeavesAtOnce() {
  const [left, setLeft] = useState(false)
  if (left) return <p className="type-body">Another page.</p>
  return (
    <div className="flex gap-2" onClickCapture={() => setTimeout(() => setLeft(true))}>
      <Leaving
        label="Mark as read and leave"
        failed="Couldn’t mark Harbor Light as read"
        action={async () => {
          await wait(300)
          throw new Error('the server didn’t answer.')
        }}
      />
      <Leaving label="Check prices and leave" doneAway={(words) => words} action={() => wait(300).then(() => 'Checked 12 · 2 deals')} />
    </div>
  )
}

const BOOKS = ['The Long Walk', 'Harbor Light', 'Paper Atlas']

function LoadingList() {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const load = async (ms: number) => {
    setState('loading')
    await wait(ms)
    setState('done')
  }
  return (
    <div className="flex max-w-md flex-col gap-3">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => void load(100)}>
          Load Fast
        </Button>
        <Button variant="outline" size="sm" onClick={() => void load(1500)}>
          Load Slowly
        </Button>
      </div>
      <ul className="flex flex-col divide-y rounded-lg border" data-state={state === 'loading' ? 'loading' : undefined}>
        {BOOKS.map((name) => (
          <li key={name} className="flex h-10 items-center px-3">
            {state === 'loading' ? <Skeleton className="h-4 w-3/5" /> : state === 'done' ? name : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

const meta: Meta = {
  title: 'app/Feedback',
  parameters: { controls: { disable: true } },
  decorators: [
    (Story) => (
      <>
        <Story />
        <Toaster />
      </>
    ),
  ],
}

export default meta

export const ActionFailed: StoryObj = { render: () => <MarkAsRead /> }
export const Job: StoryObj = { render: () => <CheckPrices /> }
export const Offline: StoryObj = { render: () => <Connection /> }
export const LeftThePage: StoryObj = { render: () => <LeavesAtOnce /> }
export const SkeletonDelay: StoryObj = { render: () => <LoadingList /> }

export const AllStates: StoryObj = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div className="flex flex-col gap-6">
      <OfflineNotice offline />
      <div className="flex max-w-md flex-col gap-4 px-6">
        <ActionError
          action={{ error: 'Couldn’t mark Harbor Light as read: the server didn’t answer.', pending: false, retry: () => {} }}
        />
        <JobStatus verb="Checking" state={{ done: 3, total: 12 }} />
        <JobStatus verb="Checking" result="Checked 12 · 2 deals" />
        <JobStatus verb="Fetching" state={{ done: 0 }} />
      </div>
    </div>
  ),
}
