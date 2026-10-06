// One record's fields saved on their own, straight from the screen showing
// them (a quick action on the view, a switch in a table row), instead of
// through the form. A PATCH of what changed, optimistic everywhere the
// record is cached: its detail query (what the view shows) and every list
// page holding it. The piece any save-without-the-form reuses.
//
// - **Shown at once.** The change is applied to the cached record before
//   the request goes out, so the screen moves when the user does.
// - **The server's record wins.** When the save answers, the cache takes
//   the record the server returned, not the one sent, so a server-side
//   effect (a computed field, a flag one change clears) shows at once.
// - **Rapid changes don't lose each other.** Saves of one record run one
//   at a time (a TanStack mutation scope per record), and each request is
//   built when it is sent, from the server's latest record. Ticking two
//   checklist items quickly sends the whole list twice, and the second
//   request already holds the first tick. A change can be a function of
//   the record for exactly this: `(record) => ({ checklist: ... })`.
// - **A refusal rolls back only itself.** The cache goes back to the
//   server's latest record with every change still waiting re-applied on
//   top, and a toast gives the server's reason (the field's 422 message,
//   or the AppError's).
// - **The lists refetch once the last save settles**, so a filter on the
//   field drops the row once the server agrees.
import {
  hashKey,
  useMutation,
  useQueryClient,
  type MutationOptions,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AppError, Page } from '@/api/contracts'

type RecordId = string | number

/**
 * What one save changes: the fields to send (`{ status: 'done' }`), or a
 * function building them from the record (`(task) => ({ checklist: ... })`).
 * Use the function when the new value depends on the current one, like a
 * whole list with one item changed: it is applied to the record on screen
 * at once, and again to the server's latest record when the request is
 * sent, so a change made while another is saving builds on it.
 */
export type RecordChange<TRecord, TUpdate> = TUpdate | ((record: TRecord) => TUpdate)

export type RecordUpdateOptions<TRecord extends { id: RecordId }, TUpdate extends Partial<TRecord>> = {
  /** The record's id: list items with this id are the ones updated. */
  id: TRecord['id']
  /** The record's detail query key, the one its view reads. */
  detailKey: QueryKey
  /** The prefix every list query of the entity starts with; each holds a `Page<TRecord>`. */
  listsKey: QueryKey
  /** The gateway's PATCH: sends `update`, resolves with the saved record, rejects with an `AppError`. */
  update: (id: TRecord['id'], update: TUpdate) => Promise<TRecord>
  /** What a refusal's toast calls the record: "Couldn't update <name>: <reason>". */
  name: (record: TRecord) => string
}

type Entry<TRecord, TUpdate> = { change: RecordChange<TRecord, TUpdate> }

// Per record (by detail key) while any of its saves is in flight: the
// server's latest record, and the changes not yet answered, oldest first.
// The cache always shows `confirmed` with every pending change applied.
type RecordState<TRecord, TUpdate> = { confirmed: TRecord | undefined; pending: Entry<TRecord, TUpdate>[] }

const states = new WeakMap<QueryClient, Map<string, RecordState<unknown, unknown>>>()

function recordStates(queryClient: QueryClient) {
  let map = states.get(queryClient)
  if (!map) states.set(queryClient, (map = new Map()))
  return map
}

function resolve<TRecord, TUpdate>(change: RecordChange<TRecord, TUpdate>, record: TRecord): TUpdate {
  return typeof change === 'function' ? (change as (record: TRecord) => TUpdate)(record) : change
}

/**
 * Why a save was refused, in the server's words: for a 422, the message
 * on a field the save sent (the first field error otherwise), else the
 * `AppError`'s message.
 */
export function refusalReason(error: AppError, sent?: object): string {
  const fieldErrors = Object.entries(error.fieldErrors ?? {})
  const fields = Object.keys(sent ?? {})
  const onSentField = fieldErrors.find(([key]) => fields.some((field) => key === field || key.startsWith(`${field}.`)))
  return (onSentField ?? fieldErrors[0])?.[1][0] ?? error.message
}

/**
 * The mutation options behind `useRecordUpdate`, for a given QueryClient.
 * Exported for tests and for code outside React; screens use the hook.
 */
export function recordUpdateMutationOptions<TRecord extends { id: RecordId }, TUpdate extends Partial<TRecord>>(
  queryClient: QueryClient,
  { id, detailKey, listsKey, update, name }: RecordUpdateOptions<TRecord, TUpdate>,
): MutationOptions<TRecord, AppError, RecordChange<TRecord, TUpdate>, { entry: Entry<TRecord, TUpdate> }> {
  const key = hashKey(detailKey)
  const lists = { queryKey: listsKey }
  const map = recordStates(queryClient) as Map<string, RecordState<TRecord, TUpdate>>

  // The record as the caches hold it now: the detail, else a list's copy.
  function cached(): TRecord | undefined {
    const detail = queryClient.getQueryData<TRecord>(detailKey)
    if (detail) return detail
    for (const [, page] of queryClient.getQueriesData<Page<TRecord>>(lists)) {
      const item = page?.items.find((record) => record.id === id)
      if (item) return item
    }
    return undefined
  }

  // Writes confirmed + pending changes to the detail (when it's cached)
  // and to every list page holding the record.
  function render(state: RecordState<TRecord, TUpdate>) {
    if (!state.confirmed) return
    const shown = state.pending.reduce<TRecord>(
      (record, entry) => ({ ...record, ...resolve(entry.change, record) }),
      state.confirmed,
    )
    queryClient.setQueryData<TRecord>(detailKey, (detail) => detail && shown)
    queryClient.setQueriesData<Page<TRecord>>(lists, (page) =>
      page && { ...page, items: page.items.map((record) => (record.id === id ? shown : record)) },
    )
  }

  // A save has settled: drop its change and show what's left on top of
  // the server's latest record. After the last one, refetch the lists.
  function settle(state: RecordState<TRecord, TUpdate>, entry: Entry<TRecord, TUpdate>) {
    state.pending = state.pending.filter((pending) => pending !== entry)
    render(state)
    if (state.pending.length === 0) {
      map.delete(key)
      void queryClient.invalidateQueries(lists)
    }
  }

  return {
    // One save of this record at a time: the next waits for the last
    // one's answer, so its request is built on the server's latest record.
    scope: { id: `record-update:${key}` },
    mutationFn: (change) => {
      const confirmed = map.get(key)?.confirmed ?? cached()
      if (!confirmed) return Promise.reject(new Error('The record to update is not loaded'))
      return update(id, resolve(change, confirmed))
    },
    onMutate: async (change) => {
      let state = map.get(key)
      if (!state) map.set(key, (state = { confirmed: undefined, pending: [] }))
      const entry: Entry<TRecord, TUpdate> = { change }
      state.pending.push(entry)
      // A refetch landing now would overwrite the change on screen.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: detailKey }),
        queryClient.cancelQueries(lists),
      ])
      // The first change of a burst: the caches still hold the server's record.
      state.confirmed ??= cached()
      render(state)
      return { entry }
    },
    onError: (error, _change, context) => {
      const state = map.get(key)
      if (!state || !context) return
      // What was sent: the change built on the record it was sent against.
      const record = state.confirmed
      const sent = record && resolve(context.entry.change, record)
      settle(state, context.entry)
      toast.error(`Couldn't update ${record ? name(record) : 'this record'}: ${refusalReason(error, sent)}`)
    },
    onSuccess: (saved, _change, context) => {
      const state = map.get(key)
      if (!state || !context) return
      state.confirmed = saved
      settle(state, context.entry)
    },
  }
}

/**
 * Saves a record's fields on their own, optimistically, wherever the
 * record is cached (see the top of this file). Call it once per control,
 * with the entity's query keys and its gateway PATCH, then
 * `mutate({ field: value })` or `mutate((record) => ({ field: ... }))`.
 * `isPending` is that control's own save in flight. A refusal rolls back
 * and shows a toast by itself.
 */
export function useRecordUpdate<TRecord extends { id: RecordId }, TUpdate extends Partial<TRecord>>(
  options: RecordUpdateOptions<TRecord, TUpdate>,
) {
  const queryClient = useQueryClient()
  return useMutation(recordUpdateMutationOptions(queryClient, options))
}
