// A form's save that doesn't overwrite (useFormVersion's FormVersionStore):
// the form keeps the record it opened with, its save carries that version,
// a 409 is a conflict the form shows (and fetches the newer version for),
// Keep Mine saves what's typed over it, Show Saved takes the newer record,
// and a form that doesn't send a version is unchanged. The Notice, its
// buttons and the typing kept are e2e/form-conflict.spec.ts's.
import { describe, expect, it, vi } from 'vitest'
import type { AppError } from '../src/api/contracts'
import { FormVersionStore } from '../src/hooks/use-form-version'

type Note = { id: number; text: string; updatedAt: string }
type NoteUpdate = { text?: string; baseUpdatedAt?: string }

const withVersion = (update: NoteUpdate, note: Note): NoteUpdate => ({ ...update, baseUpdatedAt: note.updatedAt })

// A PATCH that checks the version the way the template's backend does.
function versionedServer(initial: Note) {
  let record = { ...initial }
  let clock = 0
  return {
    get record() {
      return { ...record }
    },
    elsewhere(text: string) {
      record = { ...record, text, updatedAt: `v${++clock}-elsewhere` }
    },
    update(body: NoteUpdate): Note {
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

function setup() {
  const server = versionedServer({ id: 1, text: 'One', updatedAt: 'v0' })
  // The query: what it holds now, and its refetch (resolved by the test).
  let data: Note | undefined = server.record
  let release: () => void = () => {}
  const refetch = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        release = () => {
          data = server.record
          store.sync(data)
          resolve()
        }
      }),
  )
  const store = new FormVersionStore<Note, NoteUpdate>(withVersion, refetch)
  store.sync(data)
  // A save from the form: what it sends, or the error the server answered with.
  const save = (text: string) => {
    try {
      const saved = server.update(store.send({ text }))
      store.saved(saved)
      data = saved
      store.sync(data)
      return saved
    } catch (error) {
      return { refused: store.refused(error as AppError), error: error as AppError }
    }
  }
  const settle = async () => {
    release()
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  return { server, store, refetch, save, settle }
}

describe('a form opened on a record', () => {
  it("sends the version it was opened with, and a save that's current goes through", () => {
    const { store, save } = setup()
    expect(store.send({ text: 'Two' })).toEqual({ text: 'Two', baseUpdatedAt: 'v0' })
    expect(save('Two')).toMatchObject({ text: 'Two' })
    // The next save builds on the version this one wrote, not the opened one.
    expect(store.send({ text: 'Three' })).toEqual({ text: 'Three', baseUpdatedAt: 'v1' })
  })

  it('keeps the record it opened with when the query refetches a newer one', () => {
    const { server, store } = setup()
    const opened = store.getSnapshot().opened
    server.elsewhere('Theirs')
    store.sync(server.record)
    // What the form shows (its values) doesn't move under the typing...
    expect(store.getSnapshot().opened).toBe(opened)
    expect(store.shown(server.record)).toBe(opened)
    // ...and its save is still built on the version it opened with.
    expect(store.send({ text: 'Mine' }).baseUpdatedAt).toBe('v0')
  })

  it('a stale save is refused, nothing is written, and the conflict fetches the newer version', async () => {
    const { server, store, refetch, save, settle } = setup()
    server.elsewhere('Theirs')
    const result = save('Mine')
    expect(result).toMatchObject({ refused: true, error: { kind: 'conflict' } })
    expect(server.record.text).toBe('Theirs')
    expect(refetch).toHaveBeenCalledTimes(1)
    // Waiting for the newer version: both picks wait.
    expect(store.conflict()).toMatchObject({ loading: true })
    store.conflict()!.onKeepMine()
    expect(store.conflict()).toMatchObject({ loading: true })
    await settle()
    expect(store.conflict()).toMatchObject({ loading: false })
  })

  it('Keep Mine saves what was typed over the newer version, keeping what the form shows', async () => {
    const { server, store, save, settle } = setup()
    const opened = store.getSnapshot().opened
    server.elsewhere('Theirs')
    save('Mine')
    await settle()
    store.conflict()!.onKeepMine()
    expect(store.conflict()).toBeUndefined()
    // The form's values weren't reset: what's typed is still what it holds.
    expect(store.getSnapshot().opened).toBe(opened)
    expect(store.send({ text: 'Mine' }).baseUpdatedAt).toBe('v1-elsewhere')
    expect(save('Mine')).toMatchObject({ text: 'Mine' })
    expect(server.record.text).toBe('Mine')
  })

  it('Show Saved takes the newer record, and the next save builds on it', async () => {
    const { server, store, save, settle } = setup()
    server.elsewhere('Theirs')
    save('Mine')
    await settle()
    store.conflict()!.onShowSaved()
    expect(store.conflict()).toBeUndefined()
    expect(store.getSnapshot().opened).toMatchObject({ text: 'Theirs', updatedAt: 'v1-elsewhere' })
    expect(save('Theirs, edited')).toMatchObject({ text: 'Theirs, edited' })
  })

  it('a save of the old version again while the conflict stands is refused again, never written', async () => {
    const { server, save, settle } = setup()
    server.elsewhere('Theirs')
    save('Mine')
    await settle()
    expect(save('Mine')).toMatchObject({ refused: true })
    expect(server.record.text).toBe('Theirs')
  })

  it("a refetch that fails still lets the person pick, and Keep Mine can't overwrite on the old version", async () => {
    const server = versionedServer({ id: 1, text: 'One', updatedAt: 'v0' })
    const store = new FormVersionStore<Note, NoteUpdate>(withVersion, () => Promise.reject(new Error('offline')))
    store.sync(server.record)
    server.elsewhere('Theirs')
    try {
      server.update(store.send({ text: 'Mine' }))
    } catch (error) {
      expect(store.refused(error)).toBe(true)
    }
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(store.conflict()).toMatchObject({ loading: false })
    store.conflict()!.onKeepMine()
    expect(() => server.update(store.send({ text: 'Mine' }))).toThrow()
    expect(server.record.text).toBe('Theirs')
  })

  it("takes the newer version from a TanStack refetch's answer, before a render syncs it", async () => {
    const server = versionedServer({ id: 1, text: 'One', updatedAt: 'v0' })
    const store = new FormVersionStore<Note, NoteUpdate>(withVersion, () => Promise.resolve({ data: server.record }))
    store.sync(server.record)
    server.elsewhere('Theirs')
    try {
      server.update(store.send({ text: 'Mine' }))
    } catch (error) {
      store.refused(error)
    }
    await new Promise((resolve) => setTimeout(resolve, 0))
    store.conflict()!.onKeepMine()
    expect(server.update(store.send({ text: 'Mine' }))).toMatchObject({ text: 'Mine' })
  })

  it("isn't a conflict for any other refusal: the app shows those as before", () => {
    const { store } = setup()
    expect(store.refused({ kind: 'validation', message: 'Check the name', fieldErrors: { text: ['Too long'] } })).toBe(false)
    expect(store.refused({ kind: 'server', message: 'Down' })).toBe(false)
    expect(store.refused(undefined)).toBe(false)
    expect(store.conflict()).toBeUndefined()
  })

  it('a form moved to another record opens with that one', () => {
    const { store } = setup()
    store.sync({ id: 2, text: 'Other', updatedAt: 'w5' })
    expect(store.getSnapshot().opened).toMatchObject({ id: 2 })
    expect(store.send({ text: 'x' }).baseUpdatedAt).toBe('w5')
  })

  it('a create form (no record) sends what it was given', () => {
    const store = new FormVersionStore<Note, NoteUpdate>(withVersion, () => undefined)
    store.sync(undefined)
    expect(store.send({ text: 'New' })).toEqual({ text: 'New' })
    expect(store.shown(undefined)).toBeUndefined()
  })
})
