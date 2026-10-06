// The optimistic single-record save behind quick actions
// (src/hooks/use-record-update.ts), run against a real QueryClient with a
// fake server whose answers the test releases one at a time. No React:
// each "control" is a MutationObserver, which is what useMutation wraps.
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppError, Page } from '../src/api/contracts'
import {
  recordUpdateMutationOptions,
  refusalReason,
  type RecordChange,
} from '../src/hooks/use-record-update'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
const { toast } = await import('sonner')

type Item = { text: string; done: boolean }
type Task = {
  id: number
  name: string
  status: 'todo' | 'doing' | 'done'
  flagged: boolean
  checklist: Item[]
  // Computed by the server on every write, never sent.
  progress: 'none' | 'open' | 'complete'
}
type TaskUpdate = Partial<Pick<Task, 'status' | 'flagged' | 'checklist'>>

const detailKey = ['tasks', 'detail', 1] as const
const listsKey = ['tasks', 'list'] as const
const listKey = [...listsKey, { page: 1 }] as const

function progressOf(checklist: Item[]): Task['progress'] {
  if (checklist.length === 0) return 'none'
  return checklist.every((item) => item.done) ? 'complete' : 'open'
}

// A PATCH endpoint that holds every request until the test answers it,
// with the app's side effects: leaving "doing" clears the flag, and
// progress is recomputed from the checklist.
function fakeServer(initial: Task) {
  let record = structuredClone(initial)
  const requests: { body: TaskUpdate; answer: () => void; refuse: (error: AppError) => void }[] = []
  return {
    get record() {
      return record
    },
    requests,
    update: (_id: number, body: TaskUpdate) =>
      new Promise<Task>((resolve, reject) => {
        requests.push({
          body: structuredClone(body),
          answer: () => {
            record = { ...record, ...structuredClone(body) }
            if (body.status && body.status !== 'doing') record.flagged = false
            record.progress = progressOf(record.checklist)
            resolve(structuredClone(record))
          },
          refuse: reject,
        })
      }),
  }
}

const TASK: Task = {
  id: 1,
  name: 'Write the report',
  status: 'doing',
  flagged: true,
  checklist: [
    { text: 'Outline', done: false },
    { text: 'Draft', done: false },
  ],
  progress: 'open',
}
const OTHER: Task = { ...TASK, id: 2, name: 'Another task', checklist: [], progress: 'none' }

function setup(extra: { optimistic?: boolean; toastOnError?: boolean } = {}) {
  const client = new QueryClient()
  const server = fakeServer(TASK)
  client.setQueryData(detailKey, structuredClone(TASK))
  client.setQueryData<Page<Task>>(listKey, {
    items: [structuredClone(TASK), structuredClone(OTHER)],
    total: 2,
    page: 1,
    pageSize: 10,
  })
  const options = recordUpdateMutationOptions<Task, TaskUpdate>(client, {
    id: 1,
    detailKey,
    listsKey,
    update: server.update,
    name: (task) => task.name,
    ...extra,
  })
  // One control's save, the way a component's useMutation runs it.
  const save = (change: RecordChange<Task, TaskUpdate>) =>
    new MutationObserver(client, options).mutate(change).catch(() => undefined)
  const detail = () => client.getQueryData<Task>(detailKey)
  const listed = () => client.getQueryData<Page<Task>>(listKey)?.items.find((task) => task.id === 1)
  return { client, server, save, detail, listed }
}

const tick = (index: number, done: boolean) => (task: Task) => ({
  checklist: task.checklist.map((item, i) => (i === index ? { ...item, done } : item)),
})

beforeEach(() => {
  vi.mocked(toast.error).mockClear()
})

describe('useRecordUpdate', () => {
  it('applies the change to the detail and every cached list page before the server answers', async () => {
    const { server, save, detail, listed, client } = setup()
    void save({ status: 'todo' })

    await vi.waitFor(() => expect(server.requests).toHaveLength(1))
    expect(detail()?.status).toBe('todo')
    expect(listed()?.status).toBe('todo')
    // Other records in the list are untouched.
    expect(client.getQueryData<Page<Task>>(listKey)?.items[1]).toEqual(OTHER)
    expect(server.requests[0].body).toEqual({ status: 'todo' })
  })

  it('replaces the record with the one the server returns, side effects included', async () => {
    const { server, save, detail, listed } = setup()
    const saved = save({ status: 'done' })
    await vi.waitFor(() => expect(server.requests).toHaveLength(1))
    // Optimistic: only what was sent. The flag is still on.
    expect(detail()).toMatchObject({ status: 'done', flagged: true })

    server.requests[0].answer()
    await saved
    // The server cleared the flag when the status left "doing".
    expect(detail()).toEqual(server.record)
    expect(detail()?.flagged).toBe(false)
    expect(listed()?.flagged).toBe(false)
  })

  it('rolls back on a refusal and toasts the server reason', async () => {
    const { server, save, detail, listed } = setup()
    const saved = save({ flagged: false })
    await vi.waitFor(() => expect(server.requests).toHaveLength(1))
    expect(detail()?.flagged).toBe(false)

    server.requests[0].refuse({
      kind: 'validation',
      message: 'Validation failed',
      fieldErrors: { flagged: ['A flagged task must stay flagged until it is done'] },
    })
    await saved
    expect(detail()?.flagged).toBe(true)
    expect(listed()?.flagged).toBe(true)
    expect(toast.error).toHaveBeenCalledWith(
      "Couldn't update Write the report: A flagged task must stay flagged until it is done",
    )
  })

  it('keeps two rapid edits to the same list: the second request builds on the first', async () => {
    const { server, save, detail, listed } = setup()
    const first = save(tick(0, true))
    const second = save(tick(1, true))

    // Both ticks show at once, before either is answered.
    await vi.waitFor(() => expect(detail()?.checklist.map((item) => item.done)).toEqual([true, true]))
    expect(listed()?.checklist.map((item) => item.done)).toEqual([true, true])
    // One request at a time per record.
    expect(server.requests).toHaveLength(1)
    expect(server.requests[0].body.checklist?.map((item) => item.done)).toEqual([true, false])

    server.requests[0].answer()
    await first
    // The first answer doesn't undo the second tick on screen.
    expect(detail()?.checklist.map((item) => item.done)).toEqual([true, true])
    await vi.waitFor(() => expect(server.requests).toHaveLength(2))
    expect(server.requests[1].body.checklist?.map((item) => item.done)).toEqual([true, true])

    server.requests[1].answer()
    await second
    expect(server.record.checklist.map((item) => item.done)).toEqual([true, true])
    expect(detail()).toEqual(server.record)
    expect(detail()?.progress).toBe('complete')
  })

  it('rolls back only the refused change and keeps the one still waiting', async () => {
    const { server, save, detail } = setup()
    const first = save(tick(0, true))
    const second = save(tick(1, true))
    await vi.waitFor(() => expect(server.requests).toHaveLength(1))

    server.requests[0].refuse({ kind: 'server', message: 'Database is down' })
    await first
    expect(detail()?.checklist.map((item) => item.done)).toEqual([false, true])
    expect(toast.error).toHaveBeenCalledWith("Couldn't update Write the report: Database is down")

    await vi.waitFor(() => expect(server.requests).toHaveLength(2))
    expect(server.requests[1].body.checklist?.map((item) => item.done)).toEqual([false, true])
    server.requests[1].answer()
    await second
    expect(server.record.checklist.map((item) => item.done)).toEqual([false, true])
    expect(detail()).toEqual(server.record)
  })

  it('refetches the lists once, after the last save settles', async () => {
    const { client, server, save } = setup()
    const first = save({ status: 'todo' })
    const second = save({ status: 'done' })
    await vi.waitFor(() => expect(server.requests).toHaveLength(1))

    server.requests[0].answer()
    await first
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(false)

    await vi.waitFor(() => expect(server.requests).toHaveLength(2))
    server.requests[1].answer()
    await second
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true)
    // The detail already holds the server's record; it isn't refetched.
    expect(client.getQueryState(detailKey)?.isInvalidated).toBe(false)
  })

  it('updates the list copy when the detail was never loaded (a table row)', async () => {
    const { client, server, save, listed } = setup()
    client.removeQueries({ queryKey: detailKey })
    const saved = save({ flagged: false })
    await vi.waitFor(() => expect(server.requests).toHaveLength(1))
    expect(listed()?.flagged).toBe(false)
    expect(client.getQueryData(detailKey)).toBeUndefined()

    server.requests[0].answer()
    await saved
    expect(listed()).toEqual(server.record)
    expect(client.getQueryData(detailKey)).toBeUndefined()
  })
})

describe('useRecordUpdate for editing in place (optimistic: false, toastOnError: false)', () => {
  it('shows nothing until the server answers, then the server record', async () => {
    const { server, save, detail, listed } = setup({ optimistic: false, toastOnError: false })
    const saved = save({ status: 'todo' })
    await vi.waitFor(() => expect(server.requests).toHaveLength(1))
    expect(detail()?.status).toBe('doing')
    expect(listed()?.status).toBe('doing')

    server.requests[0].answer()
    await saved
    expect(detail()).toEqual(server.record)
    expect(detail()?.status).toBe('todo')
  })

  it('hands a refusal back to the caller, with no toast and nothing to roll back', async () => {
    const { client, server, detail } = setup({ optimistic: false, toastOnError: false })
    const options = recordUpdateMutationOptions<Task, TaskUpdate>(client, {
      id: 1,
      detailKey,
      listsKey,
      update: server.update,
      name: (task) => task.name,
      optimistic: false,
      toastOnError: false,
    })
    const refusal: AppError = { kind: 'validation', message: 'Validation failed', fieldErrors: { status: ['Not now'] } }
    const result = new MutationObserver(client, options).mutate({ status: 'done' })
    await vi.waitFor(() => expect(server.requests).toHaveLength(1))
    server.requests[0].refuse(refusal)
    await expect(result).rejects.toEqual(refusal)
    expect(toast.error).not.toHaveBeenCalled()
    expect(detail()?.status).toBe('doing')
  })
})

describe('refusalReason', () => {
  it('prefers the field error on a field the save sent', () => {
    const error: AppError = {
      kind: 'validation',
      message: 'Validation failed',
      fieldErrors: { name: ['Too long'], 'checklist.1.text': ['Required'] },
    }
    expect(refusalReason(error, { checklist: [] })).toBe('Required')
  })

  it('falls back to the first field error, then to the message', () => {
    expect(refusalReason({ kind: 'validation', message: 'Validation failed', fieldErrors: { name: ['Too long'] } }, {})).toBe(
      'Too long',
    )
    expect(refusalReason({ kind: 'validation', message: 'Only 3 at a time', fieldErrors: {} })).toBe('Only 3 at a time')
    expect(refusalReason({ kind: 'server', message: 'Database is down' })).toBe('Database is down')
  })
})
