import type { Meta, StoryObj } from '@/fixtures/types'
import { useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DeleteAction } from './delete-action'

// DeleteAction (D1) on made-up books: a soft delete from a row's icon (the
// toast's Undo puts the row back), a hard delete in words, a Retire, one
// the server refuses until the second try, and an open confirm for axe in
// both themes (e2e/fixtures-visual.spec.ts). A remove that asks a reason
// (4.96), refused once, shows what reached `onDelete`. e2e/feedback.spec.ts
// drives them.

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function Rows({ kind }: { kind: 'soft' | 'hard' }) {
  const [rows, setRows] = useState(['The Long Walk', 'Harbor Light', 'Paper Atlas'])
  return (
    <ul className="flex max-w-md flex-col divide-y rounded-lg border">
      {rows.map((name, index) => (
        <li key={name} className="flex items-center gap-3 px-3 py-2">
          <span className="flex-1 type-body">{name}</span>
          <DeleteAction
            name={name}
            kind={kind}
            size="sm"
            onDelete={async () => {
              await wait(300)
              setRows((current) => current.filter((row) => row !== name))
            }}
            onRestore={
              kind === 'soft'
                ? async () => {
                    await wait(100)
                    setRows((current) => [...current.slice(0, index), name, ...current.slice(index)])
                  }
                : undefined
            }
          />
        </li>
      ))}
      {rows.length === 0 && <li className="px-3 py-4 text-center text-muted-foreground">Nothing left.</li>}
    </ul>
  )
}

const meta: Meta = {
  title: 'app/DeleteAction',
  parameters: { controls: { disable: true } },
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
        <Toaster />
      </TooltipProvider>
    ),
  ],
}

export default meta

export const Soft: StoryObj = { render: () => <Rows kind="soft" /> }

function HardDelete() {
  const [gone, setGone] = useState(false)
  return gone ? (
    <p className="type-body">The Nov 1 balance is gone.</p>
  ) : (
    <DeleteAction trigger="button" name="the Nov 1 balance" kind="hard" onDelete={() => wait(200)} onDeleted={() => setGone(true)} />
  )
}

function RefusedOnce() {
  const [tries, setTries] = useState(0)
  return (
    <DeleteAction
      trigger="button"
      name="Harbor Light"
      kind="soft"
      onDelete={async () => {
        await wait(200)
        setTries((count) => count + 1)
        if (tries === 0) throw new Error('The server didn’t answer. Try again.')
      }}
    />
  )
}

export const Hard: StoryObj = { render: () => <HardDelete /> }

export const Retire: StoryObj = {
  render: () => (
    <DeleteAction trigger="button" verb="Retire" name="Corner Market" kind="soft" onDelete={() => wait(200)} onRestore={() => wait(100)} />
  ),
}

export const Refused: StoryObj = { render: () => <RefusedOnce /> }

export const Open: StoryObj = {
  render: () => <DeleteAction trigger={null} open name="The Long Walk" kind="soft" onDelete={() => wait(200)} />,
}

const REASON = { label: 'Why remove it?', hint: 'Kept with its history.', placeholder: 'Optional' }

function WithReasonRows() {
  const [tries, setTries] = useState(0)
  const [removed, setRemoved] = useState<string | null>(null)
  return removed !== null ? (
    <p className="type-body">
      Removed Corner Market. Reason: <output data-testid="reason">{removed === '' ? '(none)' : removed}</output>
    </p>
  ) : (
    <DeleteAction
      trigger="button"
      verb="Remove"
      verbDone="Removed"
      name="Corner Market"
      kind="hard"
      description="It comes off the list; its history stays."
      reason={REASON}
      onDelete={async (reason) => {
        await wait(200)
        setTries((count) => count + 1)
        if (tries === 0) throw new Error('The server didn’t answer. Try again.')
        setRemoved(reason)
      }}
    />
  )
}

export const WithReason: StoryObj = { render: () => <WithReasonRows /> }

export const OpenWithReason: StoryObj = {
  render: () => (
    <DeleteAction trigger={null} open verb="Remove" verbDone="Removed" name="Corner Market" kind="hard" reason={REASON} onDelete={() => wait(200)} />
  ),
}
