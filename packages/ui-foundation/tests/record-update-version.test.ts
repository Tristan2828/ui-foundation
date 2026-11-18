// useRecordUpdate's version check (`withVersion`, Roadmap 405 / review F4):
// each save carries the version of the record it was built on, a burst of
// saves chains through the versions the server hands back (never a
// conflict with this tab's own save), and a 409 refetches the record.
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { AppError } from '../src/api/contracts'
import { recordUpdateMutationOptions, type RecordUpdateOptions } from '../src/hooks/use-record-update'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

type Note = { id: number; text: string; updatedAt: string }
type NoteUpdate = { text?: string; baseUpdatedAt?: string }

const detailKey = ['notes', 'detail', 1] as const
const listsKey = ['notes', 'list'] as const

// A PATCH that checks the version the way the template's backend does:
// a sent baseUpdatedAt that isn't the record's is a 409, and nothing is written.
function versionedServer(initial: Note) {
  let record = { ...initial }
  let clock = 0
  const bodies: NoteUpdate[] = []
  return {
    get record() {
      return record
    },
    bodies,
    // Another writer (a phone, an AI chat) saves in between.
    elsewhere(text: string) {
      record = { ...record, text, updatedAt: `v${++clock}-elsewhere` }
    },
    update: async (_id: number, body: NoteUpdate): Promise<Note> => {
      bodies.push(body)
      if (body.baseUpdatedAt !== undefined && body.baseUpdatedAt !== record.updatedAt) {
        throw { kind: 'conflict', message: 'This note changed since you opened it.' } satisfies AppError
      }
      const fields = { ...body }
      delete fields.baseUpdatedAt
      record = { ...record, ...fields, updatedAt: `v${++clock}` }
      return { ...record }
    },
  }
}

function setup(withVersion: RecordUpdateOptions<Note, NoteUpdate>['withVersion']) {
  const client = new QueryClient()
  const server = versionedServer({ id: 1, text: 'One', updatedAt: 'v0' })
  client.setQueryData(detailKey, { ...server.record })
  const options = recordUpdateMutationOptions<Note, NoteUpdate>(client, {
    id: 1,
    detailKey,
    listsKey,
    update: server.update,
    name: () => 'the note',
    optimistic: false,
    toastOnError: false,
    withVersion,
  })
  const save = (change: NoteUpdate) => new MutationObserver(client, options).mutate(change)
  return { client, server, save }
}

const versioned: RecordUpdateOptions<Note, NoteUpdate>['withVersion'] = (update, note) => ({
  ...update,
  baseUpdatedAt: note.updatedAt,
})

describe('useRecordUpdate with a version', () => {
  it('sends the version of the record the change was built on', async () => {
    const { server, save } = setup(versioned)
    await save({ text: 'One two' })
    expect(server.bodies).toEqual([{ text: 'One two', baseUpdatedAt: 'v0' }])
  })

  it("a burst of saves chains through the server's versions: never a conflict with its own", async () => {
    const { server, save } = setup(versioned)
    await Promise.all([save({ text: 'One two' }), save({ text: 'One two three' })])
    expect(server.bodies.map((body) => body.baseUpdatedAt)).toEqual(['v0', 'v1'])
    expect(server.record.text).toBe('One two three')
  })

  it('a save after another writer saved is refused (kind conflict), nothing is written, and the record refetches', async () => {
    const { client, server, save } = setup(versioned)
    const refetch = vi.spyOn(client, 'invalidateQueries')
    server.elsewhere('One, from the phone')
    await expect(save({ text: 'One two' })).rejects.toMatchObject({ kind: 'conflict' })
    expect(server.record.text).toBe('One, from the phone')
    expect(refetch).toHaveBeenCalledWith({ queryKey: detailKey })
  })

  it('without withVersion nothing is sent, so the same save overwrites (negative control)', async () => {
    const { server, save } = setup(undefined)
    server.elsewhere('One, from the phone')
    await save({ text: 'One two' })
    expect(server.bodies).toEqual([{ text: 'One two' }])
    expect(server.record.text).toBe('One two')
  })
})
